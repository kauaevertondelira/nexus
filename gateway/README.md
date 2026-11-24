# Integração com as IHMs Python (Firestore)

Cada IHM Python (projeto `python-tcc`, `DATA_BACKEND=firebase`) grava a sua máquina em `maquinas/{MACHINE_ID}` no Firestore: cadastro, `historico_sensores`, `ordens_producao` e `paradas_maquina`. A ponte `nexus_sync.py` espelha isso para o Realtime Database que o site lê:

| Firestore (Python) | Realtime Database (Nexus) |
| --- | --- |
| `maquinas/{id}` | `assets/{id}` (nome, tag, área, classe, limites; o resto continua editável no site) e `iot_device_config/PY-{ID}` |
| `historico_sensores` | `telemetry/latest`, `telemetry/history` (últimas 100), `iot_alerts`, situação e temperatura/vibração do ativo |
| `ordens_producao` | `telemetry/firestoreProduction/{id}` (lote atual) |
| `paradas_maquina` | `telemetry/firestoreStops/{id}` |

Máquinas novas aparecem sozinhas: basta iniciar outra IHM com outro `MACHINE_ID`. Uma máquina sem leitura há mais de 5 minutos aparece como **Parada**. Uma ponte atende todas as IHMs do projeto.

```powershell
pip install -r gateway/requirements-sync.txt
python gateway/nexus_sync.py --credentials C:\chaves\nexus-iot-senai.json          # tempo real (deixe rodando)
python gateway/nexus_sync.py --credentials C:\chaves\nexus-iot-senai.json --once   # uma sincronização
```

`nexus-machines.json` guarda só o projeto, a URL do Realtime Database e o fuso das IHMs; a lista de máquinas vem do Firestore.

## Limpar e refazer o parque a partir do Firestore

> Passo a passo para rodar no navegador (Google Cloud Shell), sem instalar nada: [../LIMPEZA-FIREBASE.md](../LIMPEZA-FIREBASE.md).

`nexus_reset.py` deixa na Nexus somente as máquinas que existem em `maquinas/` e remove o que depende das outras: ativos, documentos e garantias; toda a IoT (recriada em seguida); ordens de serviço com checklists, horas, peças, comentários e atividade; planos preventivos e solicitações; máquinas das rotas de inspeção (rota vazia é removida com as execuções); produção por câmera. Usuários, estoque, fornecedores, compras, contratos e auditoria ficam.

```powershell
python gateway/nexus_reset.py --credentials C:\chaves\nexus-iot-senai.json            # mostra o plano, não altera nada
python gateway/nexus_reset.py --credentials C:\chaves\nexus-iot-senai.json --aplicar  # pede "LIMPAR", salva backup e aplica
```

Antes de aplicar, o banco inteiro é salvo em `%USERPROFILE%\nexus-backups\rtdb-AAAAMMDD-HHMMSS.json` (ou `--backup`). Para desfazer, importe esse JSON no Console do Realtime Database (*⋮ → Importar JSON* na raiz). A alteração é uma única atualização atômica; depois dela a ponte sincroniza leituras, lotes e paradas uma vez.

Inicie as IHMs com `DATA_BACKEND=firebase` **antes** da limpeza: sem nenhuma máquina no Firestore o script não faz nada.

# Gateway de sensores opcional

O site e os cadastros usam diretamente o Firebase Web. Esta ponte é necessária somente para integrar sensores que enviem leituras por HTTP. Ela executa em um servidor confiável, separado do GitHub Pages, usando Node 22+ e bibliotecas nativas. Não usa Firebase CLI nem depende de instalar pacotes.

## Fluxo

1. Na Central IoT, cadastre o ID do dispositivo, vincule um ativo e configure limites coerentes de temperatura/vibração.
2. No servidor, configure uma conta de serviço com acesso ao seu Realtime Database. Guarde o JSON privado fora da pasta publicada e do repositório; o programa recusa um arquivo localizado dentro deste projeto.
3. Defina `NEXUS_SERVICE_ACCOUNT_FILE`, `NEXUS_DATABASE_URL` e `NEXUS_GATEWAY_KEY` no ambiente do servidor. A chave do gateway deve ter pelo menos 32 caracteres aleatórios. `NEXUS_GATEWAY_PORT` é opcional; o padrão é 8787.
4. Execute `node gateway/server.mjs`. Ele escuta somente `127.0.0.1`. Para conectar equipamentos remotos, disponibilize um proxy HTTPS autenticado/restrito na rede da planta, encaminhando para esse endereço.
5. O dispositivo envia o payload abaixo. O gateway valida a leitura, consulta o dispositivo/ativo e escreve `telemetry/latest`, `telemetry/history` e, quando a gravidade muda para atenção/crítica, `iot_alerts` em uma atualização atômica.

Exemplo de protocolo, substituindo a chave pelo valor configurado no servidor:

```http
POST /readings HTTP/1.1
Content-Type: application/json
X-Nexus-Key: CHAVE-DO-GATEWAY-CONFIGURADA-NO-SERVIDOR

{
  "deviceId": "SEN-M204",
  "temperature": 62.4,
  "vibration": 2.7,
  "energyKwh": 1240
}
```

`energyKwh` é opcional; envie um acumulado consistente para seu equipamento/período. Temperatura aceita -40 a 250 °C; vibração, 0 a 100 mm/s. O ID aceita letras, números, hífen e sublinhado, até 100 caracteres. O corpo aceita até 8 KB. Leituras concorrentes ou com intervalo inferior a um segundo para o mesmo dispositivo são recusadas com HTTP 429.

O instante `receivedAt` é gerado no servidor. A resposta válida é HTTP 201 com `accepted: true`. `/health` retorna o estado do processo; não confirma conectividade do Firebase. Erros de JSON/limites/credencial retornam 400, 401, 403, 413, 415 ou 422; falhas de serviço retornam 503.

## Credenciais e integração

A conta de serviço obtém um token OAuth assinado e usa REST com `Authorization: Bearer`. A implementação segue a [autenticação REST do Realtime Database](https://firebase.google.com/docs/database/rest/auth) e o [protocolo OAuth de conta de serviço](https://developers.google.com/identity/protocols/oauth2/service-account). Ela aceita somente URLs HTTPS da raiz de `firebaseio.com` ou `firebasedatabase.app`.

Uma credencial administrativa confiável pode escrever independentemente das regras do cliente. Restrinja quem controla esse servidor e o arquivo privado. O site não carrega essa credencial. O programa não registra chaves, tokens ou payloads no console.

Esta versão recebe HTTP e monitora condição; não inclui driver MQTT/OPC-UA, comandos de acionamento de máquinas, envio de Web Push, retenção automática do histórico ou agendamento remoto de backups. Configure retenção e transporte industrial no servidor conforme o hardware real. O gateway foi verificado localmente com entradas de teste, sem conexão ao seu banco ou aos seus equipamentos.
