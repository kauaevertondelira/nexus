# Nexus Industrial — segurança e execução

## Central de Suporte e Acessibilidade

A Central é adicionada pelo componente compartilhado a todas as páginas protegidas que possuem barra lateral e reúne três funções:

- **Assistente Nexus:** chatbot local e somente leitura. Ele consulta uma base local de orientações, explica alertas, orienta a criação de O.S., apresenta os indicadores já visíveis e aponta onde cada módulo está localizado. Não escreve no Firebase nem executa ações administrativas ou industriais.
- **VLibras:** integração sob demanda com o widget oficial. O recurso externo só é carregado depois que o usuário seleciona a aba VLibras e confirma a ativação.
- **Aplicativo:** permite instalar o Nexus como PWA e solicitar notificações locais de novos alertas críticos.

A integração utiliza `https://vlibras.gov.br/app/vlibras-plugin.js` e inicializa o widget em `https://vlibras.gov.br/app`. Não é necessária chave de API. O carregamento possui limite de espera e permite nova tentativa quando o serviço externo ou a internet estiver indisponível.

O assistente não substitui procedimentos de segurança, avaliação técnica ou permissões de cargo.

## Aplicativo e notificações

O manifesto e o Service Worker tornam a interface instalável em navegadores compatíveis. A estrutura essencial e a tela offline são armazenadas localmente; autenticação, ativos, O.S., estoque e demais dados continuam exigindo conexão com o Firebase.

As notificações são opcionais, dependem da autorização do usuário e avisam sobre novos alertas detectados pelo painel enquanto o sistema está aberto ou em segundo plano. Envio remoto com o navegador totalmente fechado exigiria configurar Firebase Cloud Messaging ou outro servidor de push com credenciais próprias.

## Como executar

Sirva a pasta por HTTP usando Live Server ou outro servidor estático. Abra `index.html` pelo endereço gerado pelo servidor.

Não abra os arquivos HTML com duplo clique (`file://`). Caso isso aconteça, o sistema agora mostra uma orientação em vez de permanecer em branco.

## Regras do Firebase

O arquivo `database.rules.json` contém as regras recomendadas do Realtime Database. Elas precisam ser publicadas no projeto Firebase para que a proteção exista também no servidor:

```bash
firebase deploy --only database
```

Use esse comando somente em uma máquina autenticada com permissão no projeto `nexus-iot-senai`.

## Administradores

O cadastro público aceita apenas Técnico de Manutenção e Almoxarifado. O primeiro administrador deve ser promovido manualmente no Firebase. Depois disso, o administrador acessa **Financeiro → Gestão de usuários**, escolhe o cargo Administrador e confirma a autorização. A própria conta administrativa não pode ser rebaixada pela interface nem pelas regras.

As páginas protegidas permanecem ocultas até o Firebase confirmar o cargo, evitando que conteúdo restrito apareça por alguns instantes durante o carregamento.

## Dados utilizados

- Ativos: estado, temperatura, área, energia mensal e custo mensal de MRO.
- Ordens de serviço: ativo relacionado, custo estimado e horas de parada.
- Financeiro: calcula valores usando ativos e ordens reais.
- Histórico: registra login, logout, cadastro, alteração de cargo, criação, edição, mudança de quantidade/status e exclusão.

## Inteligência operacional sem hardware

- **Risco preventivo:** pontuação por regras baseada no estado e na temperatura cadastrada do ativo. É um apoio de priorização, não um diagnóstico de máquina.
- **Etiqueta QR:** gera e imprime um QR Code que abre o ativo correspondente no Parque de Ativos.
- **SLA de O.S.:** sugere prazos por prioridade, destaca atrasos e registra a aprovação da conclusão com usuário, data e observação.
- **Previsão de estoque:** usa o consumo médio mensal informado para estimar dias de cobertura e destacar ruptura em até 30 dias.
- **Eficiência energética:** compara equipamentos com a média da própria área e sinaliza desvios a partir de 25%. A redução apresentada é uma estimativa comparativa.

Esses recursos funcionam somente com os dados cadastrados no sistema. A futura integração MQTT poderá substituir valores manuais por telemetria real, mas não é necessária para utilizar as análises atuais.

## Testes

Execute `npm test` na raiz para conferir sintaxe, rotas internas, permissões, arquivos obrigatórios e requisitos estruturais de acessibilidade (idioma, texto alternativo, foco, teclado e movimento reduzido).
