# Registro de validação — 20/10/2026

## Correção 4.1.1 — movimento e logo

O navegador da prévia sinalizou `prefers-reduced-motion: reduce`. Na 4.1.0 isso desligava as entradas e deixava o motor estático; a verificação anterior de carregamento das bibliotecas não comprovava o movimento completo. A aplicação agora permite escolher **Ativar animações** na landing ou **Movimento completo** no perfil, com preferência persistente restrita ao site. O padrão continua seguindo o dispositivo.

- `npm test`: **40 testes aprovados**. Cinco casos novos cobrem a escolha completa sobre o movimento reduzido do sistema, persistência, modos acessíveis, espera das transições e interrupção da navegação.
- Auditoria estática: **24 páginas e 670 referências locais**.
- Three.js: rotação contínua do conjunto, eixo girando, resposta ao ponteiro e pausa fora da área visível/aba em segundo plano. Duas capturas em instantes diferentes estão em `artifacts/validacao/motor-frame-a.png` e `motor-frame-b.png`.
- Swup + GSAP: saída e entrada aguardadas por Promise; a área de conteúdo anima enquanto a navegação permanece visível. Entrada na demonstração, saída e login passam pela navegação Swup. Entrada dos blocos, linhas e tela de acesso; feedback Motion nos botões e entrada de diálogos.
- Navegador: confirmado `data-motion=full` com `data-system-motion=reduced`, animação Anime.js visível nas letras e uma navegação real com classes `is-changing is-animating is-leaving` e opacidade/transformação variando na área de trabalho.
- Logo fornecida pelo usuário preservada em `public/assets/images/nexus-logo.png` e aplicada como máscara com a cor do contexto em todas as marcas ao lado de NEXUS. Favicon SVG atualizado. O PNG original não foi redesenhado.

As observações da 4.1.0 abaixo são históricas; a demonstração sem erros naquele registro estava com o movimento reduzido da prévia. O acesso ao Firebase real continua fora desta validação local.

## Atualização 4.1.0

- `npm test`: **35 testes aprovados** (19 de lógica/perfil/telas, 6 de gateway, 7 de regras e 3 de PWA), com Node 24.15.0. O teste HTTP usa servidores locais simulados e precisou de execução com acesso à rede local.
- Auditoria estática aprovada para **24 páginas e 667 referências locais**, incluindo as bibliotecas, fontes, sintaxe de JS, JSON, imports e lista de cache.
- Navegador: landing com motor WebGL; entrada na demonstração; seleção de PNG real do projeto, compressão, prévia, salvamento, permanência ao reabrir e remoção de foto; navegação pelos módulos de operação, manutenção, inteligência, suprimentos, gestão e sistema. Nenhum erro/aviso de console durante a passagem pelos módulos.
- A foto de exemplo utilizada foi o ícone do próprio projeto. Captura em `artifacts/validacao/perfil-com-foto.png`.
- Duas voltas entre acesso e landing via Swup mantiveram exatamente um canvas do motor e nenhum erro/aviso de console. Captura da landing em `artifacts/validacao/landing.png`.
- Corrigidos o arquivo `.nojekyll` ausente, a atualização do perfil após restaurar a demonstração e a limpeza/reinicialização de efeitos e cenas durante as navegações.
- Anime.js 4.5.0 e Motion 14.4.0 incluídos com licenças e versões fixas, junto a Three.js, GSAP/ScrollTrigger e Swup já existentes. A interface continua visível sem as bibliotecas de movimento; há ilustração SVG para ausência de WebGL e respeito à preferência por movimento reduzido.

Esta validação é local. Não houve alteração no GitHub Pages nem nos dados ou regras do Firebase real. As gravações reais do perfil foram verificadas com uma interface Firebase simulada, e as expressões das regras com o modelo local; esses testes não substituem login/gravação autenticados nem o simulador do Console Firebase. A execução em sensores reais, Web Push, instalação PWA, desconexão real do navegador e dispositivos móveis físicos não foi validada nesta sessão.

Para publicar, siga `LEIA-ME-PUBLICACAO.md`, envie a pasta completa ao repositório e publique `database.rules.json` no Realtime Database. O formato de backup continua na versão 4.

## Registro anterior — 05/10/2026

## Arquivos e lógica

A auditoria final passou para as 24 páginas previstas, 589 referências locais, fontes, imports do Three.js, sintaxe de JavaScript, JSON e precache da PWA. Os 26 testes locais passaram: 11 de dados/telas/backup, seis do gateway, seis das expressões de regras e três do cache.

Os testes verificam cálculo de indicadores sem duplicar custos, os oito cargos, atribuição de O.S., saldo não negativo, preservação de saldo em atualizações concorrentes de cadastro, isolamento da demonstração, renderização de todas as páginas com dados e vazias, restauração com vínculos e rejeição de backups indevidos. Ordens canceladas permanecem no Kanban e ordens concluídas preservam a ficha.

O gateway foi exercitado por HTTP em localhost com um REST simulado, incluindo autenticação, entrada inválida, gravação atômica e limite de frequência. Nenhuma credencial real foi utilizada.

O modelo local compila e avalia expressões de regras para casos importantes. Ele não é o compilador nem o emulador do Firebase. A validação definitiva deve ocorrer no editor/simulador do Console do projeto.

## Navegador

A aplicação foi servida sob `/nexus/`, reproduzindo o prefixo de um repositório GitHub Pages. Todas as 23 páginas protegidas abriram na demonstração administrativa, sem tela vazia, erro de renderização ou overflow horizontal da página. O login e a abertura pública foram inspecionados separadamente.

Em 390 × 844, foram verificadas navegação, painel, estoque, ordens/detalhes, planejamento, preventiva, inspeções, IoT, mapa e financeiro. As tabelas mantêm rolagem dentro do painel. Foram corrigidos o tamanho dos valores monetários, o bloqueio residual do menu mobile e a validação de 1,5 h nos apontamentos.

Fluxos concluídos na demonstração:

- Cadastro de ativo e O.S.; início, checklist, 1,5 h de trabalho, peça e conclusão com resultado.
- Recusa de saída acima do saldo, seguida de baixa válida com histórico.
- Geração de O.S. preventiva com quatro etapas e avanço do plano.
- Execução de inspeção em dois ativos, seis pontos e consulta de temperatura/vibração no histórico.
- Exportação de PDF, CSV, etiqueta PNG e backup JSON; arquivos gerados foram encontrados e conferidos.
- Prévia e restauração de backup com 47 registros, mantendo contas e auditoria; testes adicionais cobrem vínculos, modo de produção e chaves inválidas.
- Troca de cargo para técnico e bloqueio da página financeira.
- Renderização efetiva da planta Three.js, além da alternativa em lista.
- Servidor local interrompido e abertura do Parque de ativos por cache, com os oito ativos e CSS preservados. O servidor foi reiniciado em seguida.

A demonstração foi restaurada aos exemplos iniciais após as verificações. Os testes não modificaram os dados do seu Firebase.

## Limites da validação

Não houve publicação no GitHub, gravação real no Firebase, aplicação de regras no Console, teste com contas reais ou sensores industriais. Esses passos exigem seu ambiente configurado e estão descritos nos guias. PWA, WebGL, notificações e VLibras dependem dos recursos/permissões do navegador. A leitura real exige internet; o cache da interface não replica o banco operacional.

Não foi possível verificar equivalência exata com páginas/scripts/functions ausentes no ZIP original. A entrega reconstrói as rotas e módulos identificáveis, preserva o contrato principal de dados e documenta as funcionalidades externas que precisam de implantação separada.
