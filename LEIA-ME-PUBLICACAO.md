# Publicar a Nexus pelo GitHub Desktop

A pasta `nexus/` está pronta para virar a raiz do repositório. Preserve todos os arquivos e subpastas; o projeto funciona tanto em `usuario.github.io` quanto em `usuario.github.io/nome-do-repositorio/`.

## Publicação

**Atualização 4.1.1:** copie também `public/assets/js/profile.js`, as pastas `vendor/anime/` e `vendor/motion/`, `public/assets/images/nexus-logo.png`, o favicon `mark.svg`, as licenças e o `service-worker.js` atualizado. Publique novamente `database.rules.json` na aba Regras do Realtime Database para aplicar a validação da foto. Não é necessário configurar Firebase Storage. As regras podem ser publicadas sem modificar os registros existentes.

Se as animações estiverem desativadas pelo dispositivo, clique em **Ativar animações** na landing ou escolha **Meu perfil → Aparência → Animações → Movimento completo**. Esta escolha vale somente para o site neste navegador.

1. Extraia o ZIP. Abra o repositório de destino no GitHub Desktop e use **Repository → Show in Explorer**.
2. Faça uma cópia da versão anterior fora do repositório. Copie **o conteúdo de `nexus/`** para a raiz do repositório, incluindo `public/`, `.github/`, `.nojekyll`, `404.html` e `service-worker.js`. A raiz deve conter `index.html`; evite criar um nível extra `nexus/nexus/`.
3. No GitHub Desktop, revise a lista de arquivos, escreva uma mensagem de atualização, clique **Commit to main** e **Push origin**. Se sua branch tiver outro nome, use a branch escolhida no passo seguinte.
4. No site GitHub, abra **Settings → Pages**. Em Source, escolha **Deploy from a branch**; selecione a branch enviada e **/(root)**. Salve.
5. Aguarde o deploy indicado pelo GitHub e abra o endereço publicado. Entre em **Explorar demonstração** para conferir a instalação.
6. Siga [FIREBASE-CONSOLE.md](FIREBASE-CONSOLE.md) para habilitar o acesso real, publicar as regras e aprovar sua conta.

Não é necessário Firebase CLI, instalação de pacote ou build. O `package.json` serve à verificação opcional. `firebase.json` apenas aponta para o arquivo de regras e não é usado para hospedar este site.

O workflow **Verificar integridade da Nexus** testa os arquivos; a publicação usa a branch configurada em Pages. Não troque Source para GitHub Actions por causa desse workflow de testes. A escolha de branch/pasta segue a [documentação oficial de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## O padrão para próximos projetos

- Entregar `index.html` na raiz e incluir todos os CSS, scripts, imports, fontes, imagens e páginas que ele referencia.
- Usar caminhos relativos. De `public/pages/`, a raiz fica em `../../`; nunca depender de `/assets/` ou do nome fixo de um repositório.
- Construir o endereço base a partir do script compartilhado. A Nexus calcula esse endereço em `core.js`, incluindo o prefixo do repositório.
- Manter cada rota como um HTML acessível diretamente. Recarregar uma ficha com `?id=...` continua abrindo o mesmo arquivo, sem precisar de reescrita de URL.
- Manter `.nojekyll` e atualizar juntos os arquivos, a lista SHELL e a versão CACHE de `service-worker.js` quando houver alteração na interface.
- Exibir recuperação quando dados, autenticação ou módulos opcionais falharem. A tela principal não pode depender de uma animação para ficar visível.
- Verificar o deploy no endereço público com o prefixo do repositório, tanto na primeira abertura quanto no recarregamento de uma página interna.

## Se a versão antiga continuar aparecendo

Primeiro confira se o deploy da atualização terminou. Depois recarregue sem cache ou abra em uma janela privativa. Para remover um service worker antigo, use as ferramentas do navegador em **Application → Service Workers → Unregister**, somente no domínio/caminho do seu projeto. Limpar o armazenamento do site também apaga a demonstração local e preferências; exporte o que precisar antes.

Evite reutilizar o mesmo endereço local de outro projeto com um service worker antigo. O servidor de prévia aceita uma porta diferente por `NEXUS_PORT` quando necessário.

## Se o acesso real falhar

O site ainda deve mostrar uma mensagem com **Voltar ao acesso**, **Tentar novamente** e **Explorar demonstração**. Consulte a configuração Web, E-mail/Senha, domínios autorizados, regras e aprovação de perfil no guia Firebase. Não abra leitura/gravação pública para contornar uma mensagem de permissão.

Uma abertura por duplo clique permite explorar a demonstração, mas navegador e protocolo `file:` podem impedir PWA e imports 3D. Use o site publicado ou a prévia HTTP para esses recursos.
