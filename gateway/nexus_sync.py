"""Espelho Firestore -> Realtime Database. Credenciais somente no servidor."""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import threading
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

LOG = logging.getLogger("nexus.sync")
FIELDS = {"temp_motor": ("temperature", -50, 500), "vibracao": ("vibration", 0, 100),
          "rpm_fuso": ("rpm", 0, 30000), "nivel_fluido": ("fluidLevel", 0, 100),
          "pecas_produzidas": ("producedPieces", 0, 1000000), "oee_valor": ("oee", 0, 100)}


def key(value):
    value = str(value)
    if not value or len(value) > 120 or any(c in value for c in ".#$[]/\\") or any(ord(c) < 32 for c in value):
        raise ValueError("Identificador de máquina/dispositivo inválido.")
    return value


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


def preset(machine, asset):
    warning = asset.get("tempWarning", 70)
    critical = asset.get("tempCritical", 85)
    if not isinstance(warning, (int, float)) or not isinstance(critical, (int, float)) or warning >= critical:
        warning, critical = 70, 85
    return {"label": "IHM Python · " + str(asset.get("tag") or asset.get("name") or machine["assetId"])[:90],
            "assetId": machine["assetId"], "tempWarning": warning, "tempCritical": critical,
            "vibrationWarning": 4.5, "vibrationCritical": 7.1, "active": True}


class Mirror:
    def __init__(self, app, config):
        from firebase_admin import db, firestore
        self.config = config
        self.client = firestore.client(app)
        self.root = db.reference("/", app, url=config["databaseURL"])
        self.lock = threading.RLock()
        self.stop_event = threading.Event()
        self.watches = []
        self.errors = {}
        self.assets = self.root.child("assets").get() or {}
        self.machines = [m for m in config["machines"] if m["assetId"] in self.assets]
        for machine in self.machines:
            key(machine["assetId"]); key(machine["deviceId"])
            reference = self.root.child("iot_device_config").child(machine["deviceId"])
            reference.transaction(lambda current, m=machine: current or preset(m, self.assets[m["assetId"]]))
        self.current = self.root.child("telemetry").get() or {}

    def sources(self):
        for machine in self.machines:
            scopes = [self.client.collection("maquinas").document(machine["assetId"])]
            if machine["assetId"] == self.config["legacyAssetId"]:
                scopes.insert(0, self.client)
            for scope in scopes:
                for collection, field, limit in (("historico_sensores", "criado_em", 100),
                                                  ("ordens_producao", "inicio_em", 100),
                                                  ("paradas_maquina", "criado_em", 30)):
                    yield machine, collection, scope.collection(collection).order_by(field, direction="DESCENDING").limit(limit)

    def status(self, state=None, error=""):
        error = error or "; ".join(sorted(set(self.errors.values())))
        state = state or ("error" if error else "connected")
        self.root.child("telemetry/integrations/firestorePython").update({
            "state": state, "checkedAt": round(datetime.now(timezone.utc).timestamp() * 1000),
            "projectId": self.config["projectId"], "mappedAssets": len(self.machines), "lastError": error[:300]})

    def apply(self, machine, collection, docs):
        with self.lock:
            now = round(datetime.now(timezone.utc).timestamp() * 1000)
            updates = {}
            asset_id, device_id = machine["assetId"], machine["deviceId"]
            if collection == "historico_sensores":
                config = self.root.child("iot_device_config").child(device_id).get()
                if not config or not config.get("active"):
                    return
                if config.get("assetId") != asset_id:
                    raise ValueError("O vínculo do dispositivo foi alterado; revise nexus-machines.json.")
                history = self.current.setdefault("history", {}).setdefault(device_id, {})
                candidates = []
                for doc in docs:
                    try:
                        record = reading(doc.to_dict(), doc.id, machine, now, self.config.get("sourceTimezone", "America/Sao_Paulo"))
                    except (TypeError, ValueError) as exc:
                        LOG.warning("Documento de sensores ignorado (%s): %s", doc.id, exc)
                        continue
                    history_key = "fs-" + hashlib.sha256(doc.reference.path.encode()).hexdigest()
                    old = history.get(history_key, {})
                    if old.get("sourceRevision") == record["sourceRevision"]:
                        record = old
                    else:
                        record["severity"] = severity(record, config)
                        updates["telemetry/history/" + device_id + "/" + history_key] = record
                    candidates.append(record)
                previous = self.current.get("latest", {}).get(device_id, {})
                if candidates:
                    latest = max(candidates, key=lambda row: (row["measuredAt"], row["sourceDocument"]))
                    if latest["measuredAt"] >= previous.get("measuredAt", 0) and latest.get("sourceRevision") != previous.get("sourceRevision"):
                        updates["telemetry/latest/" + device_id] = latest
                        if now - latest["measuredAt"] <= 300000 and latest["severity"] != "ok" and latest["severity"] != previous.get("severity"):
                            alert_id = "fs-" + hashlib.sha256((device_id + latest["sourceRevision"]).encode()).hexdigest()
                            updates["iot_alerts/" + alert_id] = {"deviceId": device_id, "assetId": asset_id,
                                "severity": latest["severity"], "message": "IHM Python · limite de temperatura/vibração excedido",
                                "acknowledged": False, "createdAt": latest["measuredAt"]}
                combined = dict(history)
                for path, record in updates.items():
                    if path.startswith("telemetry/history/"):
                        combined[path.rsplit("/", 1)[1]] = record
                owned = sorted(((name, value) for name, value in combined.items() if value.get("source") == "firestore-python"),
                               key=lambda pair: pair[1].get("measuredAt", 0), reverse=True)
                for name, _ in owned[100:]:
                    updates["telemetry/history/" + device_id + "/" + name] = None
            elif collection == "ordens_producao":
                if docs:
                    doc = max(docs, key=lambda item: str(item.to_dict().get("inicio_em", "")))
                    data = doc.to_dict()
                    row = {"assetId": asset_id, "source": "firestore-python", "sourceDocument": doc.id,
                           "sourceRevision": revision(data), "orderCode": str(data.get("op_codigo", doc.id))[:100],
                           "product": str(data.get("produto", ""))[:120], "operator": str(data.get("operador", ""))[:100],
                           "shift": str(data.get("turno", ""))[:100], "status": str(data.get("status", ""))[:60],
                           "producedPieces": data.get("pecas_produzidas", 0), "targetPieces": data.get("meta_total", 0),
                           "startedAt": data.get("inicio_em", ""), "endedAt": data.get("fim_em", ""), "syncedAt": now,
                           "sourceUpdatedAt": milliseconds(getattr(doc, "update_time", None) or data.get("inicio_em"), self.config.get("sourceTimezone", "America/Sao_Paulo"))}
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
                            "note": str(data.get("obs", ""))[:500], "createdAt": milliseconds(data["criado_em"], self.config.get("sourceTimezone", "America/Sao_Paulo"))}
            if updates:
                self.root.update(updates)
                for path, value in updates.items():
                    if not path.startswith("telemetry/"):
                        continue
                    parts = path.split("/")[1:]
                    target = self.current
                    for part in parts[:-1]:
                        target = target.setdefault(part, {})
                    if value is None:
                        target.pop(parts[-1], None)
                    else:
                        target[parts[-1]] = value

    def sync_once(self):
        for machine, collection, query in self.sources():
            self.apply(machine, collection, list(query.stream(timeout=20)))
        self.status()

    def _callback(self, machine, collection):
        def changed(docs, changes, read_time):
            if self.stop_event.is_set():
                return
            try:
                self.apply(machine, collection, docs)
                self.errors.pop(machine["assetId"] + collection, None)
                if not self.stop_event.is_set():
                    self.status()
            except Exception as exc:
                LOG.error("Falha no espelhamento: %s", type(exc).__name__)
                self.errors[machine["assetId"] + collection] = "Sincronização interrompida: " + type(exc).__name__
                try:
                    self.status("error", "Sincronização interrompida: " + type(exc).__name__)
                except Exception:
                    pass
        return changed

    def run(self):
        try:
            for machine, collection, query in self.sources():
                self.watches.append(query.on_snapshot(self._callback(machine, collection)))
            while not self.stop_event.wait(30):
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


def main():
    import os
    import firebase_admin
    from firebase_admin import credentials
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--credentials", default=os.environ.get("NEXUS_SERVICE_ACCOUNT_FILE") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"))
    parser.add_argument("--config", default=str(Path(__file__).with_name("nexus-machines.json")))
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if not args.credentials:
        parser.error("Informe --credentials com o JSON privado usado pelo Python, fora da pasta publicada.")
    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    account = json.loads(Path(args.credentials).read_text(encoding="utf-8"))
    if account.get("project_id") != config["projectId"]:
        parser.error("A credencial e o mapa precisam pertencer ao mesmo projeto Firebase.")
    app = firebase_admin.initialize_app(credentials.Certificate(args.credentials), {"databaseURL": config["databaseURL"]}, name="nexus-sync")
    mirror = Mirror(app, config)
    if args.once:
        mirror.sync_once()
        mirror.status("paused")
        print("Máquinas e dados do Firestore sincronizados.")
    else:
        try:
            mirror.run()
        except KeyboardInterrupt:
            mirror.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
