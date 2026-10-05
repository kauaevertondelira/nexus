# Registro de validação — 05/10/2026

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
