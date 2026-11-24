"""Espelho Firestore (IHMs Python) -> Realtime Database (Nexus). Credenciais somente no servidor.

Cada IHM Python grava em maquinas/{id} no Firestore (cadastro) e nas subcoleções
historico_sensores, ordens_producao e paradas_maquina. Esta ponte:

* descobre as máquinas em maquinas/ (inclusive as que surgirem depois) e mantém
  assets/{id} e iot_device_config/PY-{ID} no Realtime Database;
* espelha leituras (telemetry/latest e telemetry/history), lote atual
  (telemetry/firestoreProduction) e paradas (telemetry/firestoreStops);
* gera alertas IoT quando temperatura/vibração passam dos limites e marca a máquina
  como parada (offline) quando a IHM fica mais de 5 minutos sem enviar leitura.

Uma única ponte atende todas as IHMs do mesmo projeto Firebase.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import queue
import threading
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

LOG = logging.getLogger("nexus.sync")
MACHINES = "maquinas"
STALE_MS = 300000
HEARTBEAT_S = 30
FIELDS = {"temp_motor": ("temperature", -50, 500), "vibracao": ("vibration", 0, 100),
          "rpm_fuso": ("rpm", 0, 30000), "nivel_fluido": ("fluidLevel", 0, 100),
          "pecas_produzidas": ("producedPieces", 0, 1000000), "oee_valor": ("oee", 0, 100)}
# Campos do ativo que pertencem à IHM; o restante (fabricante, modelo, custos...) é editado na Nexus
OWNED_ASSET_FIELDS = ("name", "tag", "area", "assetClass", "tempWarning", "tempCritical", "source", "pythonMachineId")


def key(value):
    value = str(value)
    if not value or len(value) > 120 or any(c in value for c in ".#$[]/\\") or any(ord(c) < 32 for c in value):
        raise ValueError("Identificador de máquina/dispositivo inválido.")
    return value


def now_ms():
    return round(datetime.now(timezone.utc).timestamp() * 1000)


def milliseconds(value, zone="America/Sao_Paulo"):
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        raise ValueError("Data de origem ausente ou inválida.")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=ZoneInfo(zone))
    return round(parsed.timestamp() * 1000)


def revision(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str, ensure_ascii=False).encode()).hexdigest()


def device_id(machine_id):
    return key("PY-" + str(machine_id).upper())


def _number(value, default):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else default


def machine_from_doc(doc_id, data):
    """Converte maquinas/{id} do Firestore no cadastro usado pela Nexus."""
    data = data or {}
    asset_id = key(doc_id)
    warning, critical = _number(data.get("temp_atencao"), 70), _number(data.get("temp_critica"), 85)
    if warning >= critical:
        warning, critical = 70, 85
    return {"assetId": asset_id, "deviceId": device_id(asset_id),
            "name": str(data.get("nome") or asset_id)[:120], "tag": str(data.get("tag") or asset_id)[:60],
            "area": str(data.get("area") or "")[:80], "assetClass": str(data.get("classe") or "")[:80],
            "tempWarning": warning, "tempCritical": critical}


def asset_fields(machine):
    return {"name": machine["name"], "tag": machine["tag"], "area": machine["area"],
            "assetClass": machine["assetClass"], "tempWarning": machine["tempWarning"],
            "tempCritical": machine["tempCritical"], "source": "firestore-python",
            "pythonMachineId": machine["assetId"]}


def merged_asset(current, machine, now):
    """Ativo novo com valores padrão, ou o existente com os campos da IHM atualizados."""
    if current:
        return {**current, **asset_fields(machine)}
    return {**asset_fields(machine), "status": "offline", "criticality": "B",
            "maintenanceStrategy": "Baseada em condição", "createdAt": now}


def reading(data, doc_id, machine, now, zone="America/Sao_Paulo"):
    measured = milliseconds(data.get("criado_em") or (str(data.get("data", "")) + "T" + str(data.get("horario", ""))), zone)
    if measured > now + 300000:
        raise ValueError("Leitura com data futura incompatível com o relógio do servidor.")
    result = {"assetId": machine["assetId"], "deviceId": machine["deviceId"],
              "source": "firestore-python", "sourceDocument": doc_id,
              "sourceRevision": revision(data), "sourceMachineId": machine["assetId"],
              "orderCode": str(data.get("ordem", ""))[:100],
              "measuredAt": measured, "receivedAt": measured, "syncedAt": now}
    count = 0
    for source, (target, minimum, maximum) in FIELDS.items():
        value = data.get(source)
        if value is None:
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not minimum <= value <= maximum:
            raise ValueError("Grandeza fora do contrato do Python: " + source)
        result[target] = value
        count += 1
    if not count:
        raise ValueError("Documento sem grandezas de sensores/produção.")
    if isinstance(data.get("dados_simulados"), bool):
        result["simulated"] = data["dados_simulados"]
    return result


def severity(record, config):
    for level in ("Critical", "Warning"):
        if any(isinstance(record.get(field), (int, float)) and record[field] >= config[limit + level]
               for field, limit in (("temperature", "temp"), ("vibration", "vibration"))):
            return "critical" if level == "Critical" else "warning"
    return "ok"


def asset_status(record, now):
    """Situação do ativo na Nexus a partir da última leitura."""
    if not record or now - record.get("measuredAt", 0) > STALE_MS:
        return "offline"
    return "danger" if record.get("severity") == "critical" else "online"


def preset(machine):
    return {"label": "IHM Python · " + str(machine.get("tag") or machine.get("name") or machine["assetId"])[:90],
            "assetId": machine["assetId"], "tempWarning": machine["tempWarning"], "tempCritical": machine["tempCritical"],
            "vibrationWarning": 4.5, "vibrationCritical": 7.1, "active": True, "source": "firestore-python"}


class Mirror:
    def __init__(self, app, config):
        from firebase_admin import db, firestore
        self.config = config
        self.zone = config.get("sourceTimezone", "America/Sao_Paulo")
        self.client = firestore.client(app)
        self.root = db.reference("/", app, url=config["databaseURL"])
        self.lock = threading.RLock()
        self.stop_event = threading.Event()
        self.pending = queue.Queue()
        self.watches = []
        self.errors = {}
        self.machines = {}
        self.assets = self.root.child("assets").get() or {}
        self.current = self.root.child("telemetry").get() or {}

    # ---- máquinas ---------------------------------------------------------
    def discover(self):
        return [machine_from_doc(doc.id, doc.to_dict()) for doc in self.client.collection(MACHINES).stream()]

    def register(self, machine):
        """Cria/atualiza o ativo e o dispositivo IoT da máquina no Realtime Database."""
        now = now_ms()
        asset_ref = self.root.child("assets").child(machine["assetId"])
        asset = asset_ref.transaction(lambda current: merged_asset(current, machine, now))
        config_ref = self.root.child("iot_device_config").child(machine["deviceId"])
        config = config_ref.transaction(lambda current: current or preset(machine))
        if config.get("assetId") != machine["assetId"]:
            raise ValueError("O dispositivo " + machine["deviceId"] + " está vinculado a outro ativo na Nexus.")
        with self.lock:
            self.assets[machine["assetId"]] = asset
            is_new = machine["assetId"] not in self.machines
            self.machines[machine["assetId"]] = machine
        if is_new:
            LOG.info("Máquina %s vinculada (%s).", machine["assetId"], machine["deviceId"])
        return is_new

    def sources(self, machine):
        scope = self.client.collection(MACHINES).document(machine["assetId"])
        for collection, field, limit in (("historico_sensores", "criado_em", 100),
                                          ("ordens_producao", "inicio_em", 100),
                                          ("paradas_maquina", "criado_em", 30)):
            yield collection, scope.collection(collection).order_by(field, direction="DESCENDING").limit(limit)

    # ---- espelhamento -----------------------------------------------------
    def status(self, state=None, error=""):
        error = error or "; ".join(sorted(set(self.errors.values())))
        state = state or ("error" if error else "connected")
        self.root.child("telemetry/integrations/firestorePython").update({
            "state": state, "checkedAt": now_ms(), "projectId": self.config["projectId"],
            "mappedAssets": len(self.machines), "lastError": error[:300]})

    def mark_stale(self):
        """Máquina sem leitura há mais de 5 minutos aparece como parada na Nexus."""
        now, updates = now_ms(), {}
        with self.lock:
            for machine in self.machines.values():
                latest = self.current.get("latest", {}).get(machine["deviceId"])
                if asset_status(latest, now) == "offline" and (self.assets.get(machine["assetId"]) or {}).get("status") != "offline":
                    updates["assets/" + machine["assetId"] + "/status"] = "offline"
            if updates:
                self.root.update(updates)
                for path in updates:
                    self.assets.setdefault(path.split("/")[1], {})["status"] = "offline"

    def apply(self, machine, collection, docs):
        with self.lock:
            now = now_ms()
            updates = {}
            asset_id, device = machine["assetId"], machine["deviceId"]
            if collection == "historico_sensores":
                config = self.root.child("iot_device_config").child(device).get()
                if not config or not config.get("active"):
                    return
                if config.get("assetId") != asset_id:
                    raise ValueError("O vínculo do dispositivo foi alterado na Nexus.")
                history = self.current.setdefault("history", {}).setdefault(device, {})
                candidates = []
                for doc in docs:
                    try:
                        record = reading(doc.to_dict(), doc.id, machine, now, self.zone)
                    except (TypeError, ValueError) as exc:
                        LOG.warning("Documento de sensores ignorado (%s): %s", doc.id, exc)
                        continue
                    history_key = "fs-" + hashlib.sha256(doc.reference.path.encode()).hexdigest()
                    old = history.get(history_key, {})
                    if old.get("sourceRevision") == record["sourceRevision"]:
                        record = old
                    else:
                        record["severity"] = severity(record, config)
                        updates["telemetry/history/" + device + "/" + history_key] = record
                    candidates.append(record)
                previous = self.current.get("latest", {}).get(device, {})
                if candidates:
                    latest = max(candidates, key=lambda row: (row["measuredAt"], row["sourceDocument"]))
                    if latest["measuredAt"] >= previous.get("measuredAt", 0) and latest.get("sourceRevision") != previous.get("sourceRevision"):
                        updates["telemetry/latest/" + device] = latest
                        # Situação e últimos valores no próprio ativo (risco, disponibilidade, mapa)
                        updates["assets/" + asset_id + "/status"] = asset_status(latest, now)
                        for field, target in (("temperature", "temp"), ("vibration", "vibration")):
                            if isinstance(latest.get(field), (int, float)):
                                updates["assets/" + asset_id + "/" + target] = latest[field]
                        if now - latest["measuredAt"] <= STALE_MS and latest["severity"] != "ok" and latest["severity"] != previous.get("severity"):
                            alert_id = "fs-" + hashlib.sha256((device + latest["sourceRevision"]).encode()).hexdigest()
                            updates["iot_alerts/" + alert_id] = {"deviceId": device, "assetId": asset_id,
                                "severity": latest["severity"], "message": "IHM Python · limite de temperatura/vibração excedido",
                                "acknowledged": False, "createdAt": latest["measuredAt"]}
                combined = dict(history)
                for path, record in updates.items():
                    if path.startswith("telemetry/history/"):
                        combined[path.rsplit("/", 1)[1]] = record
                owned = sorted(((name, value) for name, value in combined.items() if value.get("source") == "firestore-python"),
                               key=lambda pair: pair[1].get("measuredAt", 0), reverse=True)
                for name, _ in owned[100:]:
                    updates["telemetry/history/" + device + "/" + name] = None
            elif collection == "ordens_producao":
                if docs:
                    doc = max(docs, key=lambda item: str(item.to_dict().get("inicio_em", "")))
                    data = doc.to_dict()
                    row = {"assetId": asset_id, "source": "firestore-python", "sourceDocument": doc.id,
                           "sourceRevision": revision(data), "orderCode": str(data.get("op_codigo", doc.id))[:100],
                           "product": str(data.get("produto", ""))[:120], "operator": str(data.get("operador", ""))[:100],
                           "shift": str(data.get("turno", ""))[:100], "status": str(data.get("status", ""))[:60],
                           "producedPieces": data.get("pecas_produzidas", 0), "targetPieces": data.get("meta_total", 0),
                           "startedAt": data.get("inicio_em", ""), "endedAt": data.get("fim_em", "") or "", "syncedAt": now,
                           "sourceUpdatedAt": milliseconds(getattr(doc, "update_time", None) or data.get("inicio_em"), self.zone)}
                    if isinstance(data.get("oee_final"), (int, float)):
                        row["oee"] = data["oee_final"]
                    old = self.current.get("firestoreProduction", {}).get(asset_id, {})
                    if row["startedAt"] >= old.get("startedAt", "") and (row["sourceRevision"] != old.get("sourceRevision") or row["sourceUpdatedAt"] != old.get("sourceUpdatedAt")):
                        updates["telemetry/firestoreProduction/" + asset_id] = row
            elif collection == "paradas_maquina":
                for doc in docs:
                    data = doc.to_dict()
                    stop_key = hashlib.sha256(doc.reference.path.encode()).hexdigest()
                    old = self.current.get("firestoreStops", {}).get(asset_id, {}).get(stop_key, {})
                    if old.get("sourceRevision") != revision(data):
                        updates["telemetry/firestoreStops/" + asset_id + "/" + stop_key] = {
                            "assetId": asset_id, "sourceRevision": revision(data), "code": str(data.get("codigo", doc.id)),
                            "orderCode": str(data.get("ordem", "")), "reason": str(data.get("motivo", ""))[:300],
                            "note": str(data.get("obs", ""))[:500], "createdAt": milliseconds(data["criado_em"], self.zone)}
            if updates:
                self.root.update(updates)
                for path, value in updates.items():
                    parts = path.split("/")
                    if parts[0] == "assets":
                        self.assets.setdefault(parts[1], {})[parts[2]] = value
                        continue
                    if parts[0] != "telemetry":
                        continue
                    target = self.current
                    for part in parts[1:-1]:
                        target = target.setdefault(part, {})
                    if value is None:
                        target.pop(parts[-1], None)
                    else:
                        target[parts[-1]] = value

    def sync_once(self):
        for machine in self.discover():
            self.register(machine)
            for collection, query in self.sources(machine):
                self.apply(machine, collection, list(query.stream(timeout=20)))
        self.status()

    # ---- tempo real -------------------------------------------------------
    def _callback(self, machine, collection):
        def changed(docs, changes, read_time):
            if self.stop_event.is_set():
                return
            try:
                self.apply(self.machines.get(machine["assetId"], machine), collection, docs)
                self.errors.pop(machine["assetId"] + collection, None)
            except Exception as exc:
                LOG.error("Falha no espelhamento: %s", type(exc).__name__)
                self.errors[machine["assetId"] + collection] = "Sincronização interrompida: " + type(exc).__name__
        return changed

    def _machines_changed(self, docs, changes, read_time):
        # Chamado na thread do Firestore: só enfileira; o laço principal registra e assina.
        for doc in docs:
            self.pending.put((doc.id, doc.to_dict()))

    def _attach(self, doc_id, data):
        try:
            machine = machine_from_doc(doc_id, data)
            if self.register(machine):
                for collection, query in self.sources(machine):
                    self.watches.append(query.on_snapshot(self._callback(machine, collection)))
            self.errors.pop(doc_id + "register", None)
        except Exception as exc:
            LOG.error("Máquina %s não vinculada: %s", doc_id, exc)
            self.errors[doc_id + "register"] = "Máquina " + str(doc_id)[:40] + " não vinculada: " + type(exc).__name__

    def run(self):
        try:
            self.watches.append(self.client.collection(MACHINES).on_snapshot(self._machines_changed))
            ticks = 0
            while not self.stop_event.wait(1):
                attached = not self.pending.empty()
                while not self.pending.empty():
                    self._attach(*self.pending.get())
                ticks += 1
                if attached or ticks % HEARTBEAT_S == 0:
                    self.mark_stale()
                    self.status()
        except Exception as exc:
            LOG.error("Ponte Firestore indisponível: %s", type(exc).__name__)
        finally:
            for watch in self.watches:
                watch.unsubscribe()

    def start(self):
        self.thread = threading.Thread(target=self.run, name="nexus-firestore", daemon=True)
        self.thread.start()
        return self

    def close(self):
        self.stop_event.set()
        if hasattr(self, "thread"):
            self.thread.join(timeout=8)
        try:
            self.status("paused")
        except Exception:
            pass


def load(args):
    import firebase_admin
    from firebase_admin import credentials
    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    account = json.loads(Path(args.credentials).read_text(encoding="utf-8"))
    if account.get("project_id") != config["projectId"]:
        raise SystemExit("A credencial e o arquivo de configuração precisam pertencer ao mesmo projeto Firebase.")
    app = firebase_admin.initialize_app(credentials.Certificate(args.credentials), {"databaseURL": config["databaseURL"]}, name="nexus-sync")
    return app, config


def arguments(description):
    import os
    parser = argparse.ArgumentParser(description=description, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--credentials", default=os.environ.get("NEXUS_SERVICE_ACCOUNT_FILE") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"),
                        help="JSON da conta de serviço (fora da pasta publicada)")
    parser.add_argument("--config", default=str(Path(__file__).with_name("nexus-machines.json")))
    return parser


def main():
    parser = arguments(__doc__)
    parser.add_argument("--once", action="store_true", help="sincroniza uma vez e sai")
    args = parser.parse_args()
    if not args.credentials:
        parser.error("Informe --credentials com o JSON privado usado pelo Python, fora da pasta publicada.")
    app, config = load(args)
    mirror = Mirror(app, config)
    if args.once:
        mirror.sync_once()
        mirror.status("paused")
        print("Máquinas sincronizadas do Firestore: " + str(len(mirror.machines)))
    else:
        try:
            mirror.run()
        except KeyboardInterrupt:
            mirror.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
