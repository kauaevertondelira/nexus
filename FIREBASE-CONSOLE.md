# Firebase pelo Console, sem instalação

O acesso real usa Firebase Authentication e Realtime Database. O SDK Web é buscado pelo navegador somente quando necessário, seguindo a [configuração oficial do SDK](https://firebase.google.com/docs/web/setup). Você não precisa baixar Firebase ou executar sua CLI.

## Configuração do projeto

1. Abra o Console Firebase e o projeto da Nexus. A configuração recebida foi preservada para `nexus-iot-senai`.
2. Em **Authentication → Sign-in method**, habilite **E-mail/Senha**.
3. Em **Authentication → Settings → Authorized domains**, adicione o domínio do seu GitHub Pages, por exemplo `seuusuario.github.io`, sem caminho. Inclua o domínio próprio se usar um. Para desenvolvimento local, confira a autorização de localhost conforme sua configuração.
4. Em **Realtime Database**, confira a URL do banco. A Nexus está configurada para `https://nexus-iot-senai-default-rtdb.firebaseio.com`.
5. Em **Configurações do projeto → Seus aplicativos → Aplicativo Web**, compare os valores com `public/assets/js/firebase-config.js`. Se usar outro projeto, substitua os valores nesse arquivo e envie a atualização pelo GitHub Desktop.
6. Em **Realtime Database → Regras**, copie todo o conteúdo de `database.rules.json`, valide no editor e clique **Publicar**.

A configuração Web identifica o aplicativo e pode estar no site. Chaves privadas de conta de serviço pertencem somente ao servidor e nunca devem entrar no repositório. A proteção dos dados depende de Authentication e das [regras oficiais do Realtime Database](https://firebase.google.com/docs/database/security).

## Primeiro administrador

O formulário público cria uma conta com `accessStatus: "pending"`, sem acesso aos dados da planta. O cargo público é limitado a Técnico, Suprimentos ou Supervisor. Para liberar a primeira conta:

1. Pelo site, use **Solicitar acesso**. Se a conta já existe, entre normalmente; se faltar o perfil, use **Completar perfil**.
2. No Console, abra **Authentication → Users** e copie o UID da sua conta.
3. Em **Realtime Database → Dados → users → SEU_UID**, preserve nome/e-mail e defina `role` como `Administrador` e `accessStatus` como `active`.
4. Entre novamente no site. Em **Continuidade e auditoria → Usuários**, o administrador aprova ou bloqueia as demais contas e atribui os oito cargos.

Exemplo de perfil inicial no Console, substituindo os dados pela sua conta:

```json
{
  "name": "Seu nome",
  "email": "seu-email@empresa.com.br",
  "role": "Administrador",
  "accessStatus": "active"
}
```

Os perfis anteriores sem `accessStatus` continuam compatíveis; revise e aprove explicitamente os usuários existentes. Perfis `pending`, `blocked`, `disabled` ou `suspended` não têm acesso operacional. A conta não pode promover o próprio cargo; a criação do primeiro administrador ocorre pelo Console, com acesso de proprietário do projeto.

## Dados existentes

Não importe a demonstração para o banco real. Ela foi isolada em armazenamento local e identificada como fictícia. A aplicação inicia as coleções operacionais vazias se seu banco não possui registros.

Os caminhos originais foram mantidos, incluindo `assets`, `inventory`, `work_orders`, `maintenance_plans`, `maintenance_requests`, `suppliers`, `purchase_requests`, `supplier_contracts`, `asset_warranties`, `inspection_routes`, `inspection_executions`, `inspection_results`, `asset_documents`, os lançamentos `work_order_*`, `telemetry`, `iot_device_config` e `iot_alerts`.

As ordens reconhecem status anteriores `new`, `pending`, `planned`, `progress`, `done` e `closed`, além dos status atuais. A gravação normal de um cadastro atualiza apenas os campos editados e metadados, preservando saldo concorrente e campos extras. Registros antigos com campos fora do novo contrato de validação podem precisar de ajuste no Console. Faça uma exportação do banco antes de uma migração de dados; o ZIP recebido não continha uma exportação dos seus registros.

## O que as regras fazem

- Negam a raiz por padrão e exigem uma conta com perfil aprovado para os dados operacionais.
- Protegem cargo e aprovação de conta, liberando ao usuário somente campos pessoais como nome e empresa.
- Limitam gravações pelo cargo. O técnico atua em O.S. próprias ou sem atribuição; gestores e planejadores gerenciam ordens; compras/suprimentos controlam saldo e fornecedores; contratos são editados por administrador/financeiro.
- Validam campos, números, saldos não negativos e vínculos principais, inclusive quando uma atualização atômica cria cadastros relacionados.
- Mantêm telemetria e registros de gateway sem escrita pelo browser. Alertas existentes podem ser reconhecidos por manutenção; o cliente não cria medições como se viessem de sensores.
- Permitem anexar entradas de auditoria ao usuário aprovado, sem editar entradas anteriores pelo cliente. A auditoria do cliente não é uma garantia independente de integridade de todas as ações.

`allowedPages`, quando presente, restringe o menu e a navegação além do cargo. Esse campo não implementa isolamento de leitura de coleções por empresa. Este banco foi preparado para uma unidade/equipe confiável. Para operação com clientes separados, adapte as regras e consultas por tenant.

## Verificação após publicar

Confira no simulador de regras do Console: visitante sem login não lê ativos; perfil pendente não lê dados operacionais; perfil ativo consegue abrir seus módulos; técnico não altera ordem atribuída a outro UID; saída de estoque não fica negativa; browser não escreve em `telemetry`. A referência de linguagem usada é a [API de regras do Firebase](https://firebase.google.com/docs/reference/security/database).

Depois, use uma conta aprovada para cadastrar um ativo de validação e uma O.S., confirmar a gravação no Console e abrir em outra sessão. Esta entrega verificou os arquivos e os fluxos em demonstração; não publicou as regras nem executou gravações no seu Firebase real.

Para sensores, veja [gateway/README.md](gateway/README.md). A aplicação mostra o momento de recebimento e considera antiga uma leitura com mais de cinco minutos. Ausência de leitura não é convertida em medição fictícia no ambiente real.
