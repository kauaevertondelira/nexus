# Nexus Gateway MQTT — Sprint 4

Este módulo roda no PC e envia **somente telemetria** ao Firebase. Ele não assina tópicos de comando e não liga, desliga ou altera máquinas.

## Teste completo no PC

1. Instale Python 3.11+ e Docker Desktop.
2. Nesta pasta, execute `docker compose up -d` para iniciar o broker MQTT apenas em `127.0.0.1`.
3. Crie um ambiente virtual e instale `pip install -r requirements.txt`.
4. Copie `.env.example` para `.env`.
5. No Firebase Console, crie uma conta de serviço apenas para o gateway e salve o JSON como `service-account.json` nesta pasta. Nunca coloque esse arquivo no site ou em repositório.
6. Em um terminal, execute `python gateway.py`.
7. Em outro terminal, execute `python simulator.py`.
8. Abra **Central IoT** no Nexus. As leituras aparecem em tempo real.

Para um teste curto, use `python simulator.py --count 5`.

## Produção

- Use broker autenticado e TLS (`MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_TLS=true` e CA válida).
- Mantenha tópicos separados por ambiente e limite o usuário MQTT a `nexus/telemetry/+`.
- Execute primeiro em um projeto Firebase de homologação.
- Não exponha a chave da conta de serviço no front-end.
- Este Sprint não possui canal de comando físico.

