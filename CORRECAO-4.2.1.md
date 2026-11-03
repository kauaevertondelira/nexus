# Correção 4.2.1 — web e APK

Esta correção resolve as mensagens `this.productionSummary is not a function` e `this.productionView is not a function` mostradas ao entrar no sistema pela página inicial.

## Causa e correção

O `index.html` da entrega anterior não incluía os três scripts de produção. As páginas internas os incluíam, mas o Swup mantém os scripts da primeira página durante a navegação. Assim, abrir Produção diretamente funcionava e entrar pelo início deixava as funções indisponíveis. O APK usa esse mesmo início web e apresentava o mesmo erro.

`index.html`, `offline.html` e as páginas internas agora carregam os mesmos módulos, na mesma ordem. Os arquivos e o cache foram identificados como 4.2.1. O service worker revalida a interface para recuperar a publicação atualizada. A auditoria verifica também a presença dos módulos nas entradas, sua ordem, sua versão e o conteúdo do cache.

## Atualizar o GitHub Pages

1. Use o **projeto completo 4.2.1** para manter também os scripts, testes e documentação atualizados. Extraia e copie **o conteúdo da pasta `nexus-main/`** para a raiz do repositório, substituindo os arquivos com o mesmo nome e mesclando as pastas. `index.html` deve continuar junto de `public/`.
2. O ZIP **somente GitHub Pages 4.2.1** contém os arquivos do site e suas licenças diretamente na raiz. Ele é uma alternativa para publicar somente a interface; não atualiza os testes e scripts que já existirem no repositório.
3. Faça commit/push e aguarde a publicação concluir. Não crie uma pasta `nexus-main` dentro da raiz publicada.
4. No computador, abra `https://kauaevertondelira.github.io/nexus/?v=4.2.1` depois do deploy e recarregue com **Ctrl+F5**.
5. Feche completamente o APK e abra novamente o mesmo endereço configurado. O APK existente usa o site corrigido; não precisa ser reinstalado para esta correção.

Esta atualização não altera as regras ou os dados do Firebase. Para corrigir estas mensagens, a ação necessária é publicar os arquivos web. Preserve o armazenamento do navegador/aplicativo, inclusive eventuais peças ainda pendentes na fila.

## Verificação

A falha da versão anterior foi reproduzida entrando pelo início e navegando com o Swup ativo, mantendo o mesmo documento. Depois da correção, passaram os percursos:

- Desktop: início → demonstração → visão global → produção → executivo → ficha do ativo.
- Celular: início → acesso → demonstração → visão global → produção → executivo → ficha do ativo.

Também passaram os 50 testes de integridade/lógica e o ensaio da câmera no navegador com duas passagens, objeto parado, lançamento manual, pausa, fechamento, permissão negada e recarga. Os ensaios usam dados locais e não alteram o Firebase real. O APK físico precisa ser conferido após a publicação do site atualizado.
