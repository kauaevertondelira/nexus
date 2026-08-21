"""Gateway MQTT -> Firebase do Nexus Industrial.

Assina exclusivamente nexus/telemetry/+ e não possui código de comando físico.
As credenciais Firebase permanecem no PC/servidor e nunca são enviadas ao front-end.
"""

from __future__ import annotations

import json
import logging
import os
import re
import signal
import ssl
import sys
import threading
import time
from dataclasses import dataclass
from typing import Any

import firebase_admin
import paho.mqtt.client as mqtt
from dotenv import load_dotenv
from firebase_admin import credentials, db

load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
LOG = logging.getLogger("nexus-gateway")
DEVICE_RE = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
TOPIC_RE = re.compile(r"^nexus/telemetry/([A-Za-z0-9_-]{1,80})$")
MAX_PAYLOAD_BYTES = 4096
DEFAULTS = {"tempWarning": 70.0, "tempCritical": 85.0, "vibrationWarning": 4.5, "vibrationCritical": 7.1}


def numeric(payload: dict[str, Any], field: str, minimum: float, maximum: float) -> float:
    value = float(payload.get(field, 0))
    if not minimum <= value <= maximum:
        raise ValueError(f"{field} fora do intervalo permitido")
    return value


@dataclass
class CachedConfig:
    value: dict[str, Any]
    expires_at: float


class NexusGateway:
    def __init__(self) -> None:
        self.host = os.getenv("MQTT_HOST", "127.0.0.1")
        self.port = int(os.getenv("MQTT_PORT", "1883"))
        self.running = True
        self.config_cache: dict[str, CachedConfig] = {}
        self.message_count = 0
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"nexus-gateway-{os.getpid()}")
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message
        self.configure_security()

    def configure_security(self) -> None:
        username = os.getenv("MQTT_USERNAME", "").strip()
        password = os.getenv("MQTT_PASSWORD", "")
        use_tls = os.getenv("MQTT_TLS", "false").lower() == "true"
        if self.host not in {"127.0.0.1", "localhost", "::1"} and (not username or not use_tls):
            raise RuntimeError("Broker remoto exige usuário, senha e TLS. Use o broker local para homologação.")
        if username:
            self.client.username_pw_set(username, password)
        if use_tls:
            self.client.tls_set(ca_certs=os.getenv("MQTT_CA_FILE") or None, tls_version=ssl.PROTOCOL_TLS_CLIENT)

    def on_connect(self, client: mqtt.Client, _userdata: Any, _flags: Any, reason_code: Any, _properties: Any) -> None:
        if int(reason_code) != 0:
            LOG.error("Conexão MQTT recusada: %s", reason_code)
            return
        client.subscribe("nexus/telemetry/+", qos=1)
        LOG.info("Gateway conectado. Assinatura somente em nexus/telemetry/+.")
        self.write_heartbeat("online")

    def on_disconnect(self, _client: mqtt.Client, _userdata: Any, _flags: Any, reason_code: Any, _properties: Any) -> None:
        LOG.warning("Gateway desconectado do MQTT: %s", reason_code)

    def config_for(self, device_id: str) -> dict[str, Any]:
        cached = self.config_cache.get(device_id)
        if cached and cached.expires_at > time.time():
            return cached.value
        value = db.reference(f"iot_device_config/{device_id}").get() or {}
        config = {**DEFAULTS, **value}
        self.config_cache[device_id] = CachedConfig(config, time.time() + 60)
        return config

    @staticmethod
    def severity(reading: dict[str, Any], config: dict[str, Any]) -> str:
        if reading["temperature"] >= float(config["tempCritical"]) or reading["vibration"] >= float(config["vibrationCritical"]):
            return "critical"
        if reading["temperature"] >= float(config["tempWarning"]) or reading["vibration"] >= float(config["vibrationWarning"]):
            return "warning"
        return "normal"

    def validate(self, topic: str, raw: bytes) -> tuple[str, dict[str, Any]]:
        match = TOPIC_RE.fullmatch(topic)
        if not match or len(raw) > MAX_PAYLOAD_BYTES:
            raise ValueError("tópico ou tamanho de payload inválido")
        device_id = match.group(1)
        payload = json.loads(raw.decode("utf-8"))
        if not isinstance(payload, dict) or payload.get("deviceId", device_id) != device_id or not DEVICE_RE.fullmatch(device_id):
            raise ValueError("identificador do dispositivo inválido")
        reading = {
            "deviceId": device_id,
            "temperature": numeric(payload, "temperature", -40, 250),
            "vibration": numeric(payload, "vibration", 0, 100),
            "energyKwh": numeric(payload, "energyKwh", 0, 1_000_000_000),
            "currentA": numeric(payload, "currentA", 0, 10_000),
            "rpm": numeric(payload, "rpm", 0, 100_000),
            "sequence": int(numeric(payload, "sequence", 0, 9_000_000_000)),
            "sampledAt": int(numeric(payload, "sampledAt", 0, 9_000_000_000_000)),
            "receivedAt": int(time.time() * 1000),
            "source": str(payload.get("source", "mqtt"))[:80],
        }
        return device_id, reading

    def on_message(self, _client: mqtt.Client, _userdata: Any, message: mqtt.MQTTMessage) -> None:
        try:
            device_id, reading = self.validate(message.topic, message.payload)
            config = self.config_for(device_id)
            reading["severity"] = self.severity(reading, config)
            reading["assetId"] = str(config.get("assetId", ""))[:160]
            reading["deviceName"] = str(config.get("label", device_id))[:120]
            history_ref = db.reference(f"telemetry/history/{device_id}").push()
            updates: dict[str, Any] = {
                f"telemetry/latest/{device_id}": reading,
                f"telemetry/history/{device_id}/{history_ref.key}": reading,
            }
            asset_id = reading["assetId"]
            if asset_id:
                updates[f"assets/{asset_id}/temp"] = max(0, reading["temperature"])
                updates[f"assets/{asset_id}/energyKwh"] = reading["energyKwh"]
                updates[f"assets/{asset_id}/status"] = "danger" if reading["severity"] == "critical" else "online"
                updates[f"assets/{asset_id}/telemetryUpdatedAt"] = reading["receivedAt"]
            if reading["severity"] in {"warning", "critical"}:
                bucket = reading["receivedAt"] // 3_600_000
                alert_id = f"{device_id}-{reading['severity']}-{bucket}"
                updates[f"iot_alerts/{alert_id}"] = {
                    "deviceId": device_id,
                    "assetId": asset_id,
                    "severity": reading["severity"],
                    "title": "Telemetria crítica" if reading["severity"] == "critical" else "Telemetria em atenção",
                    "message": f"{reading['deviceName']}: {reading['temperature']:.1f} °C e {reading['vibration']:.2f} mm/s.",
                    "acknowledged": False,
                    "createdAt": reading["receivedAt"],
                    "source": "nexus-mqtt-gateway",
                }
            db.reference().update(updates)
            self.message_count += 1
            if self.message_count % 50 == 0:
                self.prune_history(device_id)
            LOG.info("%s seq=%s severity=%s", device_id, reading["sequence"], reading["severity"])
        except Exception as error:  # mantém o gateway vivo após mensagem inválida
            LOG.warning("Mensagem MQTT descartada: %s", error)

    @staticmethod
    def prune_history(device_id: str, keep: int = 500) -> None:
        reference = db.reference(f"telemetry/history/{device_id}")
        values = reference.order_by_child("receivedAt").get() or {}
        excess = max(0, len(values) - keep)
        if excess:
            reference.update({key: None for key in list(values)[:excess]})

    def write_heartbeat(self, status: str) -> None:
        db.reference("iot_gateway/status").set({
            "status": status,
            "heartbeatAt": int(time.time() * 1000),
            "broker": "local" if self.host in {"127.0.0.1", "localhost", "::1"} else "remote-tls",
            "version": "4.0.0",
            "topic": "nexus/telemetry/+",
            "commandChannel": False,
        })

    def heartbeat_loop(self) -> None:
        while self.running:
            try:
                self.write_heartbeat("online")
            except Exception as error:
                LOG.warning("Falha no heartbeat: %s", error)
            time.sleep(15)

    def run(self) -> None:
        threading.Thread(target=self.heartbeat_loop, daemon=True).start()
        self.client.connect(self.host, self.port, keepalive=30)
        self.client.loop_forever(retry_first_connection=True)

    def stop(self, *_: object) -> None:
        self.running = False
        try:
            self.write_heartbeat("offline")
        finally:
            self.client.disconnect()


def initialize_firebase() -> None:
    credential_path = os.getenv("FIREBASE_CREDENTIALS", "service-account.json")
    database_url = os.getenv("FIREBASE_DATABASE_URL", "").strip()
    if not database_url or not os.path.isfile(credential_path):
        raise RuntimeError("Configure FIREBASE_DATABASE_URL e o arquivo FIREBASE_CREDENTIALS.")
    firebase_admin.initialize_app(credentials.Certificate(credential_path), {"databaseURL": database_url})


def main() -> int:
    initialize_firebase()
    gateway = NexusGateway()
    signal.signal(signal.SIGINT, gateway.stop)
    signal.signal(signal.SIGTERM, gateway.stop)
    LOG.info("Iniciando Nexus Gateway em modo somente telemetria.")
    gateway.run()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        LOG.error("Gateway não iniciado: %s", exc)
        sys.exit(1)
