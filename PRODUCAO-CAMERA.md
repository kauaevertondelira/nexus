# Nexus 4.2 — produção por câmera

Esta atualização acrescenta contagem de passagens por máquina, sem substituir o design existente. Web, PWA e APK usam a mesma aplicação e o mesmo Firebase. A câmera funciona como uma simulação de sensor: qualquer objeto ou mão que atravesse a região calibrada pode gerar uma peça.

## Ativar no sistema existente

1. Faça uma exportação do Realtime Database pelo Console antes de atualizar a instalação.
2. Publique o conteúdo desta pasta no mesmo endereço HTTPS da Nexus, preservando `public/`, `index.html`, `.nojekyll` e o `service-worker.js` atualizado. O site continua estático, sem build obrigatório.
3. No Console Firebase do projeto já configurado, publique **todo** o novo `database.rules.json` em Realtime Database → Regras. São regras adicionais; não há importação de dados de demonstração ou redefinição de contadores existentes.
4. Entre com uma conta aprovada. Administrador, Técnico de Manutenção, Gestor de Manutenção e Supervisor de Produção podem contar. Os demais cargos aprovados podem acompanhar os totais. Restrições pessoais de páginas continuam sendo respeitadas pela interface.
5. Em **Produção → Nova sessão**, escolha a máquina cadastrada e identifique o turno ou operação. A máquina e o responsável ficam vinculados à sessão.
6. No celular, ative a câmera, autorize o acesso, fixe o aparelho e toque em **Calibrar área livre**. Mantenha o retângulo vazio até aparecer **Sensor pronto**.
7. Passe um objeto pelo retângulo e retire-o completamente. A passagem soma **+1**. Um objeto parado conta uma vez; uma nova peça exige área livre e o intervalo mínimo configurado.
8. Em outro computador, abra Produção, Visão global, Painel executivo ou a ficha da máquina na mesma instalação. Os totais acompanham as confirmações do banco pelo listener Firebase existente.

Os contadores começam em zero nas máquinas sem registros de produção. Iniciar ou encerrar uma sessão preserva o total acumulado da máquina. A tela mostra também o total de cada sessão e os 30 eventos mais recentes da máquina selecionada. CSV e PDF exportam os totais apresentados no filtro.

## APK Android

O código Android está em `android/`. O APK entregue é uma compilação **debug para teste**, com pacote `br.com.nexus.industrial`, versão 4.2.0 e Android mínimo 8.0. A assinatura de distribuição deve ser configurada pelo responsável antes de publicar em loja ou distribuir uma versão definitiva.

Ao abrir o APK pela primeira vez, informe a URL HTTPS da pasta da Nexus publicada, por exemplo `https://seu-dominio/nexus/`. Use o endereço da aplicação web, não a URL do banco Firebase. O APK abre o site informado e usa o mesmo login, os mesmos ativos e o mesmo banco. Não há uma segunda base Android para manter sincronizada.

A permissão Android é solicitada quando a página pede a câmera. Somente captura de vídeo da origem HTTPS configurada é liberada. Microfone, acesso público ao banco e credenciais de servidor não são necessários. Links externos abrem no navegador. A câmera pausa quando o aplicativo sai do primeiro plano. Para trocar o endereço, use Voltar até a opção **Configurar endereço**.

Para recompilar, abra a pasta `android/` no Android Studio, instale SDK 35 e use **Build APK(s)**. Alternativamente, com JDK 17 ou 21 e SDK configurados, execute `gradlew.bat assembleDebug lintDebug` nessa pasta no Windows, ou `bash gradlew assembleDebug lintDebug` no Linux. O resultado fica em `android/app/build/outputs/apk/debug/app-debug.apk`. O workflow manual **Gerar APK Nexus** oferece a mesma compilação no GitHub Actions.

## Confirmação, desconexão e recuperação

Cada peça recebe um UUID antes do envio e é guardada na fila local deste aparelho. O total real só muda quando o servidor confirma a escrita. O envio grava o evento, incrementa o total da máquina e incrementa o total da sessão em uma única atualização atômica.

Se a conexão cair, a fila mostra as peças pendentes e tenta sincronizar novamente. Uma resposta perdida depois de gravar não duplica a peça: o reenvio usa o mesmo ID e confere o evento já existente. A fila sobrevive à recarga e é isolada por conta, instalação e modo. O modo demonstração permanece separado do Firebase real.

Não apague dados do aplicativo ou armazenamento do site enquanto houver peças na fila. Entre novamente na mesma conta e no mesmo endereço para reenviá-las. A fila aceita até 300 peças pendentes; ao atingir o limite ou falhar o armazenamento, a câmera pausa com uma mensagem. Revise a peça que estava passando quando ocorreu a pausa antes de retomar.

**Fechar / pausar** libera a câmera e mantém a sessão aberta. **Continuar sessão** permite usar a mesma sessão depois. **Encerrar sessão** exige que suas peças pendentes estejam confirmadas; a sessão encerrada mantém seu histórico e recusa novas contagens. Use uma sessão por aparelho. A interface evita a mesma sessão com câmera em duas abas do mesmo navegador quando Web Locks está disponível. Use um único celular por ponto físico de passagem para não medir a mesma peça em sensores diferentes.

O lançamento **Registrar +1 manual** funciona com a câmera pausada e fica identificado como Manual no histórico. A câmera registra origem Câmera. Os totais incluem ambas as origens; não há botão para apagar eventos ou zerar a produção.

## Dados e implementação

| Caminho | Conteúdo |
| --- | --- |
| `production_sessions/{sessionId}` | Máquina, identificação, responsável, início e encerramento |
| `production_events/{assetId}/{eventId}` | Passagem imutável, origem, sessão, responsável, horário detectado e horário recebido |
| `production_totals/{assetId}` | Total acumulado da máquina e referência da última passagem |
| `production_session_totals/{sessionId}` | Total da sessão e referência da última passagem |

O envio usa PATCH REST autenticado pelo token Firebase da própria conta, com incrementos e timestamps do servidor. Essa escrita não cria um incremento otimista na instância do SDK que alimenta a interface. As telas continuam acompanhando o Realtime Database pelo SDK já existente. A gravação REST segue a [documentação do Firebase](https://firebase.google.com/docs/database/rest/save-data).

As regras exigem uma conta aprovada com cargo de produção, uma sessão aberta do próprio usuário e uma máquina existente. O evento e os dois incrementos precisam estar presentes juntos. Eventos existentes não podem ser alterados ou apagados; os totais só podem subir de um em um, vinculados a um evento novo. A coleção `telemetry` permanece exclusiva do gateway.

O detector em `production-engine.js` usa uma região central, referência de exposição fora da região, calibração, limiares diferentes para ocupação/liberação e um intervalo entre peças. Os frames são processados localmente; o aplicativo não armazena nem envia vídeo ou fotografias da contagem. A aquisição da câmera depende de [contexto seguro e permissão](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

O backup da interface exporta as coleções carregadas pela sessão, incluindo os resumos de produção. Ele não carrega todo o arquivo histórico de eventos. A restauração pela interface não sobrescreve produção. Use exportação e backup do Realtime Database para preservar o histórico completo e mantenha uma política de retenção no servidor.

## Limites da simulação e teste de aceite

O detector mede alteração de imagem, sem reconhecer tipos de peça, qualidade ou refugo. Uma mão conta como peça por definição desta simulação. Câmera em movimento, sombras, objetos parecidos com o fundo, iluminação instável, peças sobrepostas ou passagens rápidas demais podem causar erro. Mantenha a faixa superior da imagem livre para a referência de exposição. Ajuste sensibilidade e intervalo e calibre novamente ao mudar o cenário.

O intervalo padrão é 800 ms; o ajuste permite 300 a 10.000 ms, além do tempo necessário para detectar ocupação e área livre. O APK precisa de um Android System WebView atualizado. O uso operacional deve ser conferido no celular e na iluminação reais; não foi feita homologação de sensor industrial ou integração de acionamento de máquinas.

Para aceitar a instalação, abra a mesma máquina no celular e no computador. Passe 10 objetos separados, segure um objeto por alguns segundos e retire-o. Confira 11 registros, sem repetição enquanto o objeto ficou parado. Interrompa a conexão depois de iniciar uma sessão, gere duas passagens, reconecte e confirme que as duas peças entram uma vez. Encerre a sessão e confira os totais no Console. Faça esse ensaio em uma máquina de validação, com uma conta aprovada para testes.

## Verificação de desenvolvimento

- `npm test`: integridade dos arquivos e testes nativos de lógica, incluindo detector, fila, repetição, desconexão e papéis. Sem instalar pacotes.
- `npm ci --prefix qa`: dependências opcionais dos testes de integração.
- Com a prévia aberta por `npm run preview`, execute `npm --prefix qa run browser`; instale o navegador de teste com `npx --prefix qa playwright install chromium --only-shell` se necessário. `NEXUS_PREVIEW_URL` aceita outro endereço ou uma URL `file:///.../nexus-main/` para QA da demonstração sem servidor HTTP.
- Com Java disponível, `npm --prefix qa run firebase` inicia um banco emulado local do projeto fictício `demo-nexus-production` e verifica escritas concorrentes, permissões e integridade. Não usa o Firebase do usuário. Em ambientes de QA com restrição ao transporte GET local, `NEXUS_QA_METHOD_OVERRIDE=1` usa o [método alternativo documentado](https://firebase.google.com/docs/reference/rest/database#method_override), somente no teste.

Consulte `VALIDACAO-4.2.md` para os resultados e os limites da validação desta entrega.
