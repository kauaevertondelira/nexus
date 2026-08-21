"""Simulador de sensores para homologação local do Nexus.

Publica somente em nexus/telemetry/<device-id>. Não assina tópicos e não envia
comandos para equipamentos.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import signal
import ssl
import sys
import time
from dataclasses import dataclass

import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv()


@dataclass
class DeviceState:
    device_id: str
    phase: float
    energy_kwh: float
    sequence: int = 0

    def reading(self) -> dict[str, float | int | str]:
        self.phase += random.uniform(0.10, 0.24)
        self.sequence += 1
        base = 48 + 9 * math.sin(self.phase)
        event = random.random()
        temperature = base + (34 if event > 0.985 else 13 if event > 0.94 else 0) + random.uniform(-1.3, 1.3)
        vibration = 2.1 + 1.2 * abs(math.sin(self.phase * 1.7)) + (5.7 if event > 0.985 else 2.3 if event > 0.94 else 0)
        power_kw = max(0.2, 6.8 + 2.2 * math.sin(self.phase * 0.7) + random.uniform(-0.35, 0.35))
        self.energy_kwh += power_kw / 720
        return {
            "deviceId": self.device_id,
            "temperature": round(temperature, 2),
            "vibration": round(vibration, 3),
            "energyKwh": round(self.energy_kwh, 4),
            "currentA": round(power_kw * 1.7, 2),
            "rpm": round(max(0, 1750 + 85 * math.sin(self.phase) + random.uniform(-12, 12))),
            "sequence": self.sequence,
            "sampledAt": int(time.time() * 1000),
            "source": "nexus-pc-simulator",
        }


def secure_client(client: mqtt.Client, host: str) -> None:
    username = os.getenv("MQTT_USERNAME", "").strip()
    password = os.getenv("MQTT_PASSWORD", "")
    use_tls = os.getenv("MQTT_TLS", "false").lower() == "true"
    if host not in {"127.0.0.1", "localhost", "::1"} and (not username or not use_tls):
        raise RuntimeError("Broker remoto exige MQTT_USERNAME e MQTT_TLS=true.")
    if username:
        client.username_pw_set(username, password)
    if use_tls:
        client.tls_set(ca_certs=os.getenv("MQTT_CA_FILE") or None, tls_version=ssl.PROTOCOL_TLS_CLIENT)


def main() -> int:
    parser = argparse.ArgumentParser(description="Simulador MQTT somente telemetria do Nexus")
    parser.add_argument("--count", type=int, default=0, help="Quantidade de ciclos; 0 executa continuamente")
    args = parser.parse_args()
    host = os.getenv("MQTT_HOST", "127.0.0.1")
    port = int(os.getenv("MQTT_PORT", "1883"))
    interval = max(1.0, float(os.getenv("SIMULATOR_INTERVAL_SECONDS", "5")))
    ids = [item.strip() for item in os.getenv("SIMULATOR_DEVICES", "ESP32-COMP-01").split(",") if item.strip()]
    if not ids:
        raise RuntimeError("Configure ao menos um SIMULATOR_DEVICES.")

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"nexus-simulator-{os.getpid()}")
    secure_client(client, host)
    client.connect(host, port, keepalive=30)
    client.loop_start()
    devices = [DeviceState(device_id, random.random() * math.pi, random.uniform(120, 900)) for device_id in ids]
    running = True

    def stop(*_: object) -> None:
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    cycle = 0
    print(f"Simulando {len(devices)} dispositivos em {host}:{port}. Somente publicação de telemetria.")
    try:
        while running and (args.count <= 0 or cycle < args.count):
            for device in devices:
                payload = device.reading()
                topic = f"nexus/telemetry/{device.device_id}"
                result = client.publish(topic, json.dumps(payload, separators=(",", ":")), qos=1, retain=False)
                result.wait_for_publish(timeout=5)
                print(f"{topic} temp={payload['temperature']} vib={payload['vibration']} seq={payload['sequence']}")
            cycle += 1
            if running and (args.count <= 0 or cycle < args.count):
                time.sleep(interval)
    finally:
        client.disconnect()
        client.loop_stop()
    return 0


if __name__ == "__main__":
    sys.exit(main())

