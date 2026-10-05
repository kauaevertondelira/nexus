# NEXUS / Industrial Operating System 4.0

Gestão de máquinas industriais, manutenção e suprimentos em uma aplicação estática pronta para GitHub Pages. Abra `index.html` e escolha **Explorar demonstração**, ou publique a pasta completa e conecte sua conta Firebase.

**Para publicar, comece por [LEIA-ME-PUBLICACAO.md](LEIA-ME-PUBLICACAO.md).** O fluxo usa GitHub Desktop e Console Firebase. Não há instalação, build, Firebase CLI ou servidor obrigatório para o site.

## O que foi resgatado

O ZIP recebido continha 16 arquivos na raiz. As pastas `public/`, `scripts/`, `tests/`, `gateway/` e `functions/` mencionadas nos documentos não estavam no arquivo. O HTML inicial apontava para recursos ausentes, o que explicava a tela vazia.

As 24 páginas listadas pelo service worker original foram reconstruídas. Os oito cargos, a configuração Web do Firebase e os caminhos principais do Realtime Database foram mantidos. Os comportamentos foram implementados a partir dessas rotas, das regras e da proposta documentada. Não é possível afirmar equivalência exata com código que não veio no ZIP. Os dados do seu Firebase não foram alterados durante esta reconstrução.

## Módulos disponíveis

| Área | Páginas e funções |
| --- | --- |
| Acesso | Login, solicitação de conta, recuperação de senha, recuperação de perfil, aprovação administrativa |
| Operação | Visão global, ativos, ficha técnica, documentos HTTPS, etiqueta QR e ficha PDF |
| Manutenção | O.S. em tabela ou Kanban, detalhes, checklist, horas, peças, comentários, conclusão e relatório |
| Programação | Agenda de sete dias, planos preventivos e geração de O.S., solicitações e conversão em ordens |
| Campo | Meu trabalho, rotas de inspeção, medições e histórico de resultados |
| Inteligência | Confiabilidade, priorização por condição, MTBF/MTTR, mapa 3D, energia e consumo |
| IoT | Cadastro de dispositivos, limites de atenção/críticos, leituras, indicação de dado antigo e reconhecimento de alertas |
| Suprimentos | Estoque com transação de saldo e histórico, fornecedores, compras e etapas de aprovação/recebimento |
| Gestão | Contratos, garantias, financeiro operacional, painel executivo e exportações CSV/PDF |
| Sistema | Notificações, perfil, tema claro/escuro, busca global, backups, auditoria, usuários e PWA |

O visual combina tipografia ampla, azul cobalto, detalhes em verde ácido e uma interface de trabalho em fundo claro. As referências indicadas foram [Nine to Five Studio](https://www.9to5studio.it/) e [Pizzato](https://www.pizzatoits.it/); os layouts, ícones e modelos 3D deste projeto são próprios.

## Movimento e navegação

GSAP + ScrollTrigger animam a entrada e a leitura dos blocos. Swup navega entre arquivos HTML reais. Three.js desenha um motor procedural na abertura e uma planta esquemática nos ativos. Fontes e bibliotecas visuais estão incluídas no projeto, com versões fixas e avisos em [THIRD-PARTY.md](THIRD-PARTY.md).

Os dados e formulários continuam disponíveis com movimento reduzido ou sem WebGL. A animação é complementar. Todas as páginas têm uma mensagem estática de recuperação caso o JavaScript falhe. O SDK Firebase é carregado por CDN somente quando se usa uma conta real; a demonstração funciona separadamente em armazenamento local.

## Dados e permissões

Os oito cargos são Administrador, Técnico de Manutenção, Almoxarifado / Suprimentos, Gestor de Manutenção, Planejador de Manutenção, Comprador, Supervisor de Produção e Gestor Financeiro. O menu acompanha o cargo e as regras protegem gravações no banco. Consulte [FIREBASE-CONSOLE.md](FIREBASE-CONSOLE.md) para configurar e aprovar o primeiro administrador.

Este modelo atende uma unidade/equipe confiável por banco. `companyId` e a empresa do perfil são cadastros, sem isolamento de clientes por empresa. Uma instalação para empresas independentes exige regras e consultas de segregação antes de receber seus dados.

## Uso operacional

1. Cadastre os equipamentos e sua condição, setor, criticidade, limites e dados técnicos.
2. Abra uma O.S. ou converta uma solicitação. Defina prazo e responsável; escolha a conta do técnico para vincular o trabalho.
3. Registre checklist, horas e peças. Para encerrar, confirme todas as etapas e descreva o resultado. A O.S. concluída preserva seus apontamentos na interface.
4. Registre a saída física das peças no Estoque MRO. O registro na O.S. documenta o uso e o custo; a baixa exige a confirmação do almoxarifado. O recebimento de uma compra também precisa de entrada no estoque.
5. Nos planos preventivos, gerar uma ordem avança a próxima execução. Uma geração pelo planejador mantém o procedimento na descrição; os checklists são lançados pelo técnico ou administrador.
6. Na inspeção, confirme cada ponto e informe as medições. Condições de atenção/críticas exigem observação.

Os indicadores têm limites explícitos: disponibilidade atual é a proporção de ativos cadastrados como operacionais; energia e custo MRO são valores cadastrados para o mês. MTTR usa paradas de corretivas concluídas e MTBF usa horas de operação divididas por corretivas concluídas. Os registros devem cobrir o mesmo período para uma comparação útil. Não há cálculo de OEE sem produção planejada, produção real e qualidade. A pontuação de condição prioriza inspeções e não prevê falhas. O mapa 3D é ilustrativo e não reproduz a geometria real da planta.

## Continuidade

O administrador exporta um JSON com os dados que sua sessão conseguiu carregar. A restauração aceita backups Nexus 4.0 de até 10 MB, verifica campos e vínculos e mescla cadastros, configuração IoT, documentos, checklists, horas, peças, comentários e inspeções pelos IDs. Dados ausentes no arquivo não são excluídos. Contas, auditoria, atividade imutável das O.S., telemetria e alertas não são sobrescritos pela restauração na interface. Backups de demonstração não entram no Firebase real.

Guarde o backup completo antes de uma restauração: os saldos e campos presentes no arquivo podem substituir valores mais recentes. O log do navegador registra ações do cliente e não substitui uma trilha independente gerada por servidor. O cache PWA guarda arquivos da interface; não contém um backup operacional. O acesso real requer conexão para confirmar perfil e gravar alterações.

As notificações locais dependem do navegador e da página em uso. Não foi incluído um serviço de Web Push ou agendamento de backup remoto. VLibras é opcional, carregado pelo botão de acessibilidade e depende de conexão ao serviço oficial.

## Arquitetura

```text
nexus/
  index.html                   Abertura
  public/pages/                24 páginas de acesso e operação
  public/assets/css/           Design responsivo
  public/assets/js/            Regras da interface, dados, telas e movimento
  public/assets/vendor/        Bibliotecas visuais incluídas
  public/assets/fonts/         Fontes locais
  database.rules.json          Regras para colar no Console
  service-worker.js            Cache da interface
  gateway/server.mjs           Ponte HTTP opcional para sensores
  scripts/                     Auditoria e servidor de prévia opcional
  tests/                       Testes de lógica
```

O browser fala diretamente com Authentication e Realtime Database. O [gateway opcional](gateway/README.md) usa Node e REST autenticado em um servidor confiável para receber sensores. GitHub Pages hospeda os arquivos do site; o gateway precisa executar separadamente.

## Verificação opcional para desenvolvedores

Com Node 22 ou superior, `npm test` verifica rotas, referências, imports, sintaxe, cache e lógica. `npm run preview` abre um servidor local em `http://127.0.0.1:4173/nexus/`. Esses comandos usam bibliotecas nativas e os arquivos incluídos, sem instalar dependências. Eles não são necessários para publicar pelo Desktop.

O workflow em `.github/workflows/verificar-pages.yml` executa essa auditoria a cada atualização no GitHub. Veja o registro de entrega em [VALIDACAO.md](VALIDACAO.md). Login, permissões e gravações reais devem ser conferidos após publicar as regras no seu projeto Firebase.
