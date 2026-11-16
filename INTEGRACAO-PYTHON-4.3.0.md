# Nexus 4.3.0 — integração com a IHM Python

## Atualizar os dois sistemas

1. Publique o conteúdo da pasta `nexus-atual/` do ZIP atualizado no mesmo endereço HTTPS da Nexus. Preserve a organização de `public/`, `index.html` e `service-worker.js`.
2. Extraia o ZIP `python-tcc-atualizado.zip` no computador que executa a IHM. Antes de substituir uma instalação anterior, preserve seu arquivo privado `firebase_credentials.json`, seu `.env` e sua pasta `data/`.
3. Copie o `firebase_credentials.json` que já é usado pelo Python para a raiz da nova pasta `python-tcc/`. Essa chave não está nos ZIPs atualizados e nunca deve ser copiada para o site da Nexus.
4. No Windows, execute `INICIAR-IHM.bat`. Na primeira execução, ele cria o ambiente Python e instala as dependências. Depois, abra `http://127.0.0.1:8000` e selecione a máquina.
5. Mantenha a IHM Python em execução. Com o backend Firebase ativo, ela inicia automaticamente a sincronização com a Nexus. Não é necessário executar um segundo programa de sincronização.
6. Entre na Nexus com sua conta aprovada e abra **Central IoT**. Use o filtro de máquina para consultar os sensores, as últimas leituras, os lotes e as paradas recebidas da IHM.

O APK existente abre o mesmo site HTTPS e recebe a nova interface pela publicação web. Esta entrega não recompila o aplicativo Android.

## O que foi conectado

O Python utiliza Cloud Firestore. O site utiliza Firebase Authentication e Realtime Database. A ponte de servidor em `gateway/nexus_sync.py`, também incluída na raiz do projeto Python, escuta as alterações do Firestore e atualiza os caminhos que a Nexus já acompanha.

| Máquina cadastrada | Dispositivo definido |
| --- | --- |
| CNC01 / Torno 1 | `PY-TORNO01` |
| Prensa hidráulica / Prensa 1 | `PY-PRENSA01` |
| Forno Industrial 01 / Forno 1 | `PY-FORNO01` |
| Esteira 01 / Esteira 1 | `PY-ESTEIRA01` |
| Prensa Hidráulica 04 / PH-004 | `PY-PRENSA04` |

Os identificadores exatos dos ativos estão em `gateway/nexus-machines.json` e no arquivo equivalente na raiz do Python. O catálogo Python atualiza nomes e máquinas a partir dos ativos do Realtime Database quando inicia com o Firebase.

O fluxo legado `cnc/torno01` e as coleções Firestore da raiz continuam vinculados exclusivamente ao **CNC01 / Torno 1**. Os outros equipamentos têm estado e persistência próprios em `maquinas/{assetId}/...` no Firestore. Uma leitura do torno não é replicada como se fosse uma medição das outras máquinas.

## Dados exibidos

| Campo recebido do Python | Apresentação na Nexus |
| --- | --- |
| `temp_motor` | Temperatura em °C |
| `vibracao` | Vibração em mm/s |
| `rpm_fuso` | Rotação em RPM |
| `nivel_fluido` | Nível de fluido em % |
| `pecas_produzidas`, `meta_total` | Peças e meta da OP na IHM |
| `ordens_producao` | Lote, produto, turno, operador e situação |
| `paradas_maquina` | Motivos e observações das paradas |

Nível de fluido não representa umidade. Grandezas ausentes aparecem como `—`. Os horários são os das medições, considerando `America/Sao_Paulo` para os horários sem fuso do Python. Sincronizar uma leitura antiga não a transforma em leitura recente. Após cinco minutos, a Nexus sinaliza que a leitura está antiga.

As peças informadas pela IHM aparecem em **Lotes do sistema Python**. Elas não são somadas automaticamente aos eventos da câmera, para manter as origens de contagem identificadas.

## Simulação e máquinas

A tela inicial da IHM apresenta as máquinas. Ao clicar em uma, suas métricas, ordens e históricos são carregados. Iniciar, finalizar ou consultar um lote afeta somente a máquina selecionada. Máquinas sem lote apresentam **Sem OP ativa**, sem criar uma ordem fictícia.

O fallback local pode produzir e salvar medições simuladas quando houver uma OP em operação. Esses registros são enviados com `dados_simulados: true`. Configure `PERSIST_SIMULATED_TELEMETRY=false` para impedir que o fallback seja persistido, ou `MOCK_TELEMETRY_FALLBACK=false` para desativá-lo.

Para simular MQTT com Mosquitto em execução:

```text
python scripts/simulate_machines.py --all
python scripts/simulate_machines.py --machine PY-PRENSA01
```

O simulador utiliza os tópicos `nexus/{assetId}/sensores` e `nexus/{assetId}/producao`. Os tópicos antigos do torno continuam aceitos. Pacotes que informam outra OP são ignorados na contagem do lote atual. As sugestões de operador/produto do formulário também são guardadas por máquina.

## Banco preservado e sincronização inicial

Não foi necessário limpar o banco. Foi salvo um backup antes de criar os cinco vínculos e copiar as leituras existentes. Foram alterados apenas `iot_device_config` e `telemetry`; cadastros, usuários, estoque, manutenção e eventos de produção por câmera foram preservados. As regras existentes do Realtime Database foram mantidas, incluindo a proibição de escrita de telemetria pelo navegador.

A sincronização inicial copiou **57 leituras** do torno, a OP e a parada existentes. A leitura mais recente encontrada é de **10/11/2026, 16:30:41**, com 43 °C, 0,24 mm/s, 1.191 RPM e 87% de fluido. Novos dados dependem de voltar a executar o Python. Os demais dispositivos aguardam suas próprias leituras.

O espelho usa chaves estáveis para não duplicar registros ao reconectar e mantém até 100 leituras espelhadas por dispositivo. Os documentos originais do Firestore permanecem preservados. A sincronização é marcada como pausada quando a IHM é encerrada.

## Executar apenas a ponte, opcionalmente

Se preferir manter uma IHM antiga sem a nova interface, é possível executar a ponte separada, em um computador de confiança:

```text
python -m pip install -r gateway/requirements-sync.txt
python gateway/nexus_sync.py --credentials "CAMINHO_PRIVADO/firebase_credentials.json"
```

Não execute essa opção simultaneamente com a ponte automática da nova IHM. O argumento `--once` permite apenas copiar os dados atuais, sem manter a escuta ativa.

## Referências técnicas

A implementação segue as APIs oficiais de [escuta do Firestore](https://firebase.google.com/docs/firestore/query-data/listen) e [atualizações do Realtime Database no servidor](https://firebase.google.com/docs/database/admin/save-data). O arquivo de conta de serviço é usado somente pelo [Admin SDK no servidor](https://firebase.google.com/docs/admin/setup).
