"""Testes da ponte Firestore -> Realtime Database e da limpeza (sem acesso ao Firebase).

    python -m pytest tests/test_nexus_sync.py
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "gateway"))

from nexus_reset import plan_reset  # noqa: E402
from nexus_sync import asset_status, machine_from_doc, merged_asset, preset, reading, severity  # noqa: E402

NOW = 1_800_000_000_000

# Documento exatamente como a IHM Python grava (app/repositories/firestore_docs.py)
LEITURA_PYTHON = {
    "temp_motor": 43.1, "vibracao": 0.21, "rpm_fuso": 1204, "nivel_fluido": 88,
    "pecas_produzidas": 15, "meta_total": 100, "oee_valor": 92, "ordem": "OP-4590-B",
    "status_operacao": "OPERANDO", "dados_simulados": True,
    # NOW = 2027-01-15 05:00:00 em São Paulo; a leitura é de 10 s antes
    "criado_em": "2027-01-15T04:59:50.000-03:00", "data": "2027-01-15", "horario": "04:59:50",
}


def maquina(doc_id="torno-cnc-01", **extra):
    return machine_from_doc(doc_id, {"nome": "Torno CNC #01", "tag": "TORNO-01", "area": "Usinagem",
                                     "classe": "Torno CNC", "temp_atencao": 70, "temp_critica": 85, **extra})


def test_maquina_do_firestore_vira_ativo_e_dispositivo():
    m = maquina()
    assert m["assetId"] == "torno-cnc-01" and m["deviceId"] == "PY-TORNO-CNC-01"
    asset = merged_asset(None, m, NOW)
    assert asset["name"] == "Torno CNC #01" and asset["status"] == "offline" and asset["source"] == "firestore-python"
    config = preset(m)
    assert config["assetId"] == "torno-cnc-01" and config["active"] is True and config["tempCritical"] == 85


def test_edicoes_feitas_na_nexus_sao_mantidas():
    atual = {"name": "Nome antigo", "manufacturer": "Romi", "status": "online", "mroCost": 250}
    asset = merged_asset(atual, maquina(), NOW)
    assert asset["name"] == "Torno CNC #01"
    assert asset["manufacturer"] == "Romi" and asset["mroCost"] == 250 and asset["status"] == "online"


def test_ids_e_limites_invalidos():
    with pytest.raises(ValueError):
        machine_from_doc("a/b", {})
    m = machine_from_doc("prensa-01", {"temp_atencao": 90, "temp_critica": 80})
    assert (m["tempWarning"], m["tempCritical"]) == (70, 85)


def test_leitura_da_ihm_python_e_aceita_pela_ponte():
    m = maquina()
    record = reading(LEITURA_PYTHON, "doc1", m, NOW)
    assert record["temperature"] == 43.1 and record["vibration"] == 0.21
    assert record["rpm"] == 1204 and record["fluidLevel"] == 88 and record["oee"] == 92
    assert record["orderCode"] == "OP-4590-B" and record["simulated"] is True
    assert record["deviceId"] == "PY-TORNO-CNC-01"
    record["severity"] = severity(record, preset(m))
    assert record["severity"] == "ok"
    assert asset_status(record, record["measuredAt"] + 1000) == "online"
    assert asset_status(record, record["measuredAt"] + 400000) == "offline"
    assert asset_status({**record, "severity": "critical"}, record["measuredAt"]) == "danger"


def test_limpeza_remove_maquinas_fora_do_firestore_e_dependencias():
    tree = {
        "assets": {"-Oz7Rlysexgko4VUqZpq": {"name": "CNC01"}, "torno-cnc-01": {"name": "x", "manufacturer": "Romi"}},
        "asset_documents": {"-Oz7Rlysexgko4VUqZpq": {"d": {}}},
        "iot_device_config": {"PY-TORNO01": {"assetId": "-Oz7Rlysexgko4VUqZpq"}, "PY-TORNO-CNC-01": {"assetId": "torno-cnc-01", "tempCritical": 99}},
        "iot_alerts": {"a1": {"assetId": "torno-cnc-01"}},
        "telemetry": {"latest": {}},
        "work_orders": {"OS1": {"assetId": "-Oz7Rlysexgko4VUqZpq"}, "OS2": {"assetId": "torno-cnc-01"}},
        "work_order_checklists": {"OS1": {"1": {}}, "OS2": {"1": {}}},
        "maintenance_plans": {"PM1": {"assetId": "-Oz7Rlysexgko4VUqZpq"}},
        "maintenance_requests": {"S1": {"assetId": "-Oz7Rlysexgko4VUqZpq"}, "S2": {"title": "sem ativo"}},
        "inspection_routes": {"R1": {"assetIds": ["-Oz7Rlysexgko4VUqZpq"]}, "R2": {"assetIds": ["-Oz7Rlysexgko4VUqZpq", "torno-cnc-01"]}},
        "inspection_executions": {"E1": {"routeId": "R1"}, "E2": {"routeId": "R2"}},
        "inspection_results": {"E1": {"x": {}}},
        "production_sessions": {"P1": {"assetId": "-Oz7Rlysexgko4VUqZpq"}},
        "production_session_totals": {"P1": {"count": 3}},
        "production_totals": {"-Oz7Rlysexgko4VUqZpq": {"count": 3}},
        "users": {"u": {"name": "Admin"}}, "inventory": {"i": {"qty": 1}},
    }
    updates, removed, kept = plan_reset(tree, [maquina()], NOW)

    for path in ("assets/-Oz7Rlysexgko4VUqZpq", "asset_documents/-Oz7Rlysexgko4VUqZpq", "iot_device_config/PY-TORNO01",
                 "iot_alerts/a1", "telemetry", "work_orders/OS1", "work_order_checklists/OS1", "maintenance_plans/PM1",
                 "maintenance_requests/S1", "inspection_routes/R1", "inspection_executions/E1", "inspection_results/E1",
                 "production_sessions/P1", "production_session_totals/P1", "production_totals/-Oz7Rlysexgko4VUqZpq"):
        assert updates[path] is None, path
    for path in ("work_orders/OS2", "work_order_checklists/OS2", "maintenance_requests/S2",
                 "inspection_executions/E2", "users", "inventory"):
        assert path not in updates, path
    assert updates["inspection_routes/R2/assetIds"] == ["torno-cnc-01"]
    assert updates["assets/torno-cnc-01"]["manufacturer"] == "Romi"
    assert updates["assets/torno-cnc-01"]["name"] == "Torno CNC #01"
    assert updates["iot_device_config/PY-TORNO-CNC-01"]["tempCritical"] == 85
    assert removed["assets"] == 1 and kept["work_orders"] == 1
    # Nenhum caminho é ancestral de outro (exigência da atualização multi-caminho do Firebase)
    paths = sorted(updates)
    assert not any(b.startswith(a + "/") for a in paths for b in paths if a != b)
