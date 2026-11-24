# Limpar as máquinas antigas e refazer o parque pelo Firebase

Este roteiro roda **inteiro no navegador**, no Google Cloud Shell: um terminal Linux do próprio
Google, ligado ao seu projeto Firebase. Nada é instalado no seu computador e a chave de acesso é
criada e apagada lá mesmo.

**Resultado:** a Nexus fica só com as máquinas que existem em `maquinas/` no Firestore (uma por
IHM Python). Tudo o que dependia das máquinas antigas sai:

- ativos, documentos e garantias das máquinas antigas;
- toda a IoT: dispositivos, alertas e telemetria (a ponte recria para as máquinas novas);
- ordens de serviço dessas máquinas (com checklists, horas, peças, comentários e atividade),
  planos preventivos e solicitações;
- as máquinas antigas saem das rotas de inspeção (rota que ficar vazia é removida com as execuções);
- produção por câmera dessas máquinas.

Usuários, estoque, fornecedores, compras, contratos e auditoria **não** são tocados.

Tempo: uns 15 minutos. Você precisa ser **proprietário** (Owner) do projeto `nexus-iot-senai`.

---

## 1. Antes de começar: as máquinas novas precisam estar no Firestore

1. Ligue cada IHM Python com `DATA_BACKEND=firebase` e o seu `MACHINE_ID` (veja o README do
   projeto Python, seção 10). Ao iniciar, a IHM grava a máquina no Firestore.
2. No [Console do Firebase](https://console.firebase.google.com/) → projeto **nexus-iot-senai** →
   **Firestore Database**, confira a coleção **`maquinas`**: deve haver um documento para cada
   máquina (por exemplo `torno-cnc-01`).

> Se `maquinas` estiver vazia, o script não apaga nada e avisa.

## 2. Backup pelo Console (recomendado, além do backup automático)

1. No Console do Firebase → **Realtime Database** → aba **Dados**.
2. Menu **⋮** (canto direito, na raiz) → **Exportar JSON**. Guarde o arquivo.

## 3. Abrir o Cloud Shell no projeto

1. Abra <https://console.cloud.google.com/> com a mesma conta do Firebase.
2. No seletor de projeto (topo da página), escolha **nexus-iot-senai**.
3. Clique no ícone **Ativar o Cloud Shell** (`>_`, canto superior direito). Um terminal abre na
   parte de baixo da página. Na primeira vez, clique em **Continuar/Autorizar**.

## 4. Enviar o projeto para o Cloud Shell

1. No terminal, menu **⋮** → **Fazer upload** → escolha o arquivo **`nexus-atual.zip`**.
2. Descompacte:

```bash
cd ~
unzip -o nexus-atual.zip
cd ~/nexus-main
```

## 5. Criar a chave de acesso (dentro do Cloud Shell)

O script usa a conta de serviço do Firebase (`firebase-adminsdk-…`). A chave é criada direto no
Cloud Shell, fora da pasta do projeto:

```bash
gcloud config set project nexus-iot-senai
SA=$(gcloud iam service-accounts list --filter="email~firebase-adminsdk" --format="value(email)")
echo "$SA"
gcloud iam service-accounts keys create ~/chave-nexus.json --iam-account="$SA"
```

O `echo` deve mostrar algo como `firebase-adminsdk-abc12@nexus-iot-senai.iam.gserviceaccount.com`.

> Se aparecer erro de política (`disableServiceAccountKeyCreation`), gere a chave no Console do
> Firebase → **Configurações do projeto → Contas de serviço → Gerar nova chave privada** e envie o
> arquivo pelo **⋮ → Fazer upload** do Cloud Shell; depois rode `mv ~/*.json ~/chave-nexus.json`.
> Apague o arquivo baixado do seu computador em seguida.

## 6. Instalar as dependências

```bash
python3 -m venv ~/.venv-nexus
source ~/.venv-nexus/bin/activate
pip install -r gateway/requirements-sync.txt
```

## 7. Ver o plano (não altera nada)

```bash
python gateway/nexus_reset.py --credentials ~/chave-nexus.json
```

Confira na saída:

- **Máquinas no Firestore (ficam na Nexus):** a lista das suas IHMs;
- **Será removido:** quantos ativos, ordens, planos, rotas etc. saem.

Se algo estiver errado, pare aqui: nada foi alterado.

## 8. Aplicar

```bash
python gateway/nexus_reset.py --credentials ~/chave-nexus.json --aplicar
```

1. Digite **`LIMPAR`** quando pedir.
2. O banco inteiro é salvo em `~/nexus-backups/rtdb-AAAAMMDD-HHMMSS.json` (no Cloud Shell).
3. A limpeza é aplicada de uma vez (atualização atômica: ou tudo, ou nada).
4. Em seguida o script sincroniza leituras, lotes e paradas do Firestore e mostra
   `Pronto: N máquina(s)`.

Abra a Nexus → **Parque de ativos** e **Central IoT**: devem aparecer só as máquinas das IHMs.

## 9. Manter a sincronização ligada

A limpeza sincroniza uma vez. Para os valores continuarem chegando na Nexus, a ponte precisa ficar
rodando em algum lugar:

```bash
python gateway/nexus_sync.py --credentials ~/chave-nexus.json
```

- **No Cloud Shell:** funciona enquanto a aba estiver aberta. O Google encerra a sessão depois de
  um tempo sem uso, então serve para demonstração, não para ficar ligado o dia todo.
- **Para uso contínuo:** rode a ponte no computador onde a IHM Python já fica ligada (uma ponte
  atende todas as máquinas). Veja `gateway/README.md`.

## 10. Apagar a chave quando terminar

Se a ponte não vai mais rodar no Cloud Shell, apague a chave criada no passo 5:

```bash
gcloud iam service-accounts keys list --iam-account="$SA" --managed-by=user
gcloud iam service-accounts keys delete ID_DA_CHAVE --iam-account="$SA"
rm ~/chave-nexus.json
```

(`ID_DA_CHAVE` é a coluna `KEY_ID` da chave criada hoje.)

---

## Desfazer

1. Baixe o backup do Cloud Shell: `cloudshell download ~/nexus-backups/rtdb-AAAAMMDD-HHMMSS.json`
   (ou use o JSON exportado no passo 2).
2. Console do Firebase → **Realtime Database** → **⋮** na raiz → **Importar JSON** → escolha o
   arquivo.

> A importação na raiz **substitui o banco inteiro** pelo conteúdo do arquivo: o que foi gravado
> depois do backup se perde.

## Problemas comuns

| Mensagem | O que fazer |
| --- | --- |
| `nenhuma. Inicie ao menos uma IHM Python…` | Nenhuma máquina em `maquinas/`. Volte ao passo 1. |
| `A credencial e o arquivo de configuração precisam pertencer ao mesmo projeto` | A chave é de outro projeto. Confira o passo 3 (projeto selecionado) e refaça o passo 5. |
| `PERMISSION_DENIED` ao criar a chave | Sua conta não é proprietária do projeto. Peça a quem é. |
| `O dispositivo PY-… está vinculado a outro ativo` | Na Central IoT, um dispositivo com esse ID aponta para outra máquina. Rode a limpeza (ela recria os dispositivos) ou corrija o vínculo no site. |
