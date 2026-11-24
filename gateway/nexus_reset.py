"""Limpa as máquinas do Realtime Database da Nexus e refaz o cadastro a partir do Firestore.

As máquinas que ficam são exatamente as que existem em maquinas/ no Firestore (uma por IHM
Python). Todo o resto ligado a máquinas que não estão lá é removido:

  * assets que não vieram do Firestore e seus documentos e garantias;
  * toda a IoT (iot_device_config, iot_alerts e telemetry): a ponte recria em seguida;
  * ordens de serviço dessas máquinas (com checklists, horas, peças, comentários e atividade),
    planos preventivos e solicitações;
  * rotas de inspeção: a máquina sai da rota; rota sem máquinas é removida com suas execuções;
  * produção por câmera dessas máquinas (sessões, totais e eventos).

Usuários, estoque, fornecedores, compras, contratos e auditoria não são tocados.

Uso:
    python gateway/nexus_reset.py --credentials C:\\chaves\\nexus.json            # só mostra o plano
    python gateway/nexus_reset.py --credentials C:\\chaves\\nexus.json --aplicar  # backup + limpeza

Antes de aplicar, o banco inteiro é salvo em um JSON (padrão: pasta nexus-backups no seu
usuário). Para desfazer, importe esse arquivo no Console do Realtime Database.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from nexus_sync import MACHINES, Mirror, arguments, load, machine_from_doc, merged_asset, now_ms, preset  # noqa: E402

WORK_ORDER_CHILDREN = ("work_order_checklists", "work_order_time_entries", "work_order_parts",
                       "work_order_comments", "work_order_activity")
CONFIRMATION = "LIMPAR"


def _items(tree, name):
    value = tree.get(name) or {}
    return value.items() if isinstance(value, dict) else []


def plan_reset(tree, machines, now):
    """Monta a atualização multi-caminho (atômica) e um resumo do que muda."""
    keep = {machine["assetId"] for machine in machines}
    devices = {machine["deviceId"] for machine in machines}
    updates, removed, kept = {}, Counter(), Counter()

    def drop(path, label):
        updates[path] = None
        removed[label] += 1

    def gone(record):
        asset = (record or {}).get("assetId") if isinstance(record, dict) else None
        return bool(asset) and asset not in keep

    for asset_id, _ in _items(tree, "assets"):
        if asset_id not in keep:
            drop("assets/" + asset_id, "assets")
    for asset_id, _ in _items(tree, "asset_documents"):
        if asset_id not in keep:
            drop("asset_documents/" + asset_id, "asset_documents")
    for record_id, record in _items(tree, "asset_warranties"):
        if gone(record):
            drop("asset_warranties/" + record_id, "asset_warranties")

    # IoT: recriada do zero a partir do Firestore
    for device, _ in _items(tree, "iot_device_config"):
        if device not in devices:
            drop("iot_device_config/" + device, "iot_device_config")
    for alert_id, _ in _items(tree, "iot_alerts"):
        drop("iot_alerts/" + alert_id, "iot_alerts")
    if tree.get("telemetry"):
        drop("telemetry", "telemetry")

    # Manutenção
    for order_id, order in _items(tree, "work_orders"):
        if gone(order):
            drop("work_orders/" + order_id, "work_orders")
            for child in WORK_ORDER_CHILDREN:
                if order_id in (tree.get(child) or {}):
                    drop(child + "/" + order_id, child)
        else:
            kept["work_orders"] += 1
    for name in ("maintenance_plans", "maintenance_requests"):
        for record_id, record in _items(tree, name):
            if gone(record):
                drop(name + "/" + record_id, name)

    # Inspeções
    executions = dict(_items(tree, "inspection_executions"))
    for route_id, route in _items(tree, "inspection_routes"):
        ids = list((route or {}).get("assetIds") or [])
        remaining = [asset for asset in ids if asset in keep]
        if ids and not remaining:
            drop("inspection_routes/" + route_id, "inspection_routes")
            for execution_id, execution in executions.items():
                if (execution or {}).get("routeId") == route_id:
                    drop("inspection_executions/" + execution_id, "inspection_executions")
                    if execution_id in (tree.get("inspection_results") or {}):
                        drop("inspection_results/" + execution_id, "inspection_results")
        elif len(remaining) != len(ids):
            updates["inspection_routes/" + route_id + "/assetIds"] = remaining
            kept["inspection_routes ajustadas"] += 1

    # Produção por câmera
    for session_id, session in _items(tree, "production_sessions"):
        if gone(session):
            drop("production_sessions/" + session_id, "production_sessions")
            if session_id in (tree.get("production_session_totals") or {}):
                drop("production_session_totals/" + session_id, "production_session_totals")
    for name in ("production_totals", "production_events"):
        for asset_id, _ in _items(tree, name):
            if asset_id not in keep:
                drop(name + "/" + asset_id, name)

    # Cadastro refeito a partir do Firestore
    assets = tree.get("assets") or {}
    for machine in machines:
        updates["assets/" + machine["assetId"]] = merged_asset(assets.get(machine["assetId"]), machine, now)
        updates["iot_device_config/" + machine["deviceId"]] = preset(machine)
    return updates, removed, kept


def backup_path(target, project):
    path = Path(target).expanduser().resolve()
    if path.is_relative_to(Path(project).resolve()):
        raise SystemExit("Salve o backup fora da pasta do projeto: ele contém dados de usuários.")
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def main():
    parser = arguments(__doc__)
    parser.add_argument("--aplicar", action="store_true", help="faz o backup e aplica a limpeza (sem isso, só mostra o plano)")
    parser.add_argument("--backup", default=str(Path.home() / "nexus-backups" / ("rtdb-" + datetime.now().strftime("%Y%m%d-%H%M%S") + ".json")))
    parser.add_argument("--sim", action="store_true", help="não pede para digitar a confirmação")
    args = parser.parse_args()
    if not args.credentials:
        parser.error("Informe --credentials com o JSON da conta de serviço, fora da pasta publicada.")

    app, config = load(args)
    from firebase_admin import db, firestore
    client = firestore.client(app)
    machines = [machine_from_doc(doc.id, doc.to_dict()) for doc in client.collection(MACHINES).stream()]
    root = db.reference("/", app, url=config["databaseURL"])
    tree = root.get() or {}

    print("Máquinas no Firestore (ficam na Nexus):")
    for machine in machines:
        print("  " + machine["assetId"] + "  ·  " + machine["name"] + "  ·  dispositivo " + machine["deviceId"])
    if not machines:
        print("  nenhuma. Inicie ao menos uma IHM Python com DATA_BACKEND=firebase antes de limpar.")
        return 1

    updates, removed, kept = plan_reset(tree, machines, now_ms())
    print("\nSerá removido:")
    for label, count in sorted(removed.items()):
        print("  " + label + ": " + str(count))
    if not removed:
        print("  nada")
    for label, count in sorted(kept.items()):
        print("Mantido · " + label + ": " + str(count))

    if not args.aplicar:
        print("\nNada foi alterado. Rode de novo com --aplicar para fazer o backup e limpar.")
        return 0
    if not args.sim and input("\nDigite " + CONFIRMATION + " para continuar: ").strip() != CONFIRMATION:
        print("Cancelado. Nada foi alterado.")
        return 1

    target = backup_path(args.backup, Path(__file__).resolve().parent.parent)
    target.write_text(json.dumps(tree, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Backup salvo em " + str(target))
    root.update(updates)
    print("Limpeza aplicada. Sincronizando leituras, lotes e paradas do Firestore...")
    mirror = Mirror(app, config)
    mirror.sync_once()
    mirror.status("paused")
    print("Pronto: " + str(len(mirror.machines)) + " máquina(s). Deixe a ponte (nexus_sync.py) rodando para manter em tempo real.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
