# Atualização visual 4.5.0

A abertura passa a usar um carrossel de fotografias industriais no lugar do motor 3D. O azul da marca e o amarelo de sinalização foram mantidos, com títulos mais contidos, espaçamento mais claro e menos movimento nas telas de trabalho.

## Alterações

- Frases e rótulos da interface em português, incluindo abertura, acesso, rodapés, procedimentos e cópias de segurança. Nomes de produtos, protocolos e identificadores técnicos foram preservados.
- Três fotografias locais em WebP, com versões de 768 e 1280 pixels. A primeira tem prioridade de carregamento; as outras são carregadas ao selecionar a imagem.
- Troca automática a cada 7,5 segundos, transição por opacidade, controles de avançar/voltar, seleção direta, pausa e créditos.
- A troca automática para quando a seção está fora da tela, a aba está oculta ou há foco nos controles. Movimento reduzido mantém a navegação manual, sem transição ou reprodução automática.
- Seta para recolher a navegação a 80 px, preservando ícones e nomes acessíveis. A preferência é salva no navegador e permanece após navegar e recarregar.
- Rótulos dos ícones ao passar o ponteiro ou focar pelo teclado. A lista de módulos rola sem esconder o cabeçalho, o suporte ou o perfil.
- No celular, menu com botão de fechar, proteção do foco e retorno do foco ao botão de abertura ao pressionar Escape.
- Transições de página de 160/280 ms e entradas mais curtas. A abertura da marca também foi encurtada.
- GSAP, Motion, Swup, Lenis e shadcn/ui integrados. Lenis atua somente na abertura; shadcn/ui é usado no botão de recolher, em uma ilha React carregada na área de trabalho.
- Three.js fica reservado ao mapa de ativos. O gerador de PDF é executado somente ao exportar, com alternativa de impressão se o recurso não puder carregar.
- Cache atualizado para 4.5.0. Fotos e o mapa são armazenados à medida que são usados, evitando baixar o conjunto 3D durante a instalação inicial.

## Publicação e manutenção

Os arquivos finais já estão em `public/`. Publique a pasta completa como antes; não é necessário compilar para hospedar o ZIP. O projeto Firebase, suas regras e os fluxos de dados foram preservados.

Para modificar o botão shadcn/ui, edite `src/ui/` e execute:

```sh
npm ci
npm run build:ui
```

O comando também atualiza as cópias locais de Motion, GSAP e Lenis a partir das versões fixadas. Os créditos das fotografias e bibliotecas estão em `THIRD-PARTY.md` e `licenses/`.

## Verificação

- `npm test`: 63 testes aprovados, 25 páginas e 798 referências locais verificadas.
- `qa/interface.browser.py`: 28 verificações aprovadas em Chromium, com computador e celular, incluindo seleção/pausa do carrossel, movimento reduzido, navegação Swup, recolhimento, persistência, foco, tema e exportação PDF.
- `qa/entry-navigation.browser.mjs`: início → demonstração → produção → executivo → ativo, tanto no computador quanto no celular, sem recarregar o documento.
- `qa/production.browser.mjs`: sensor controlado, passagens, peça parada, lançamento manual, permissão negada, pausa, encerramento e recarga.
- axe-core 4.13.0: nenhuma violação encontrada na abertura e na barra lateral/cabeçalho nos temas claro e escuro. Esta verificação automática não equivale a uma certificação de conformidade; leitor de tela real e outros navegadores não foram testados.
- PWA instalada em Chromium: demonstração, botão shadcn/ui e exportação de PDF confirmados sem rede após a instalação do cache. A abertura da marca e a troca de preferência de movimento também foram verificadas.
- Os testes funcionais usam a demonstração local. Não foram executadas gravações no Firebase real.

Para repetir a verificação visual, inicie `npm run preview` e execute `npm run test:visual` em outro terminal. Esse teste requer Playwright para Python (`python3 -m pip install playwright` e `python3 -m playwright install chromium`). Pode usar um Chromium já instalado via `NEXUS_BROWSER_PATH`. Para incluir axe-core, defina `NEXUS_AXE_SCRIPT` com o caminho para `axe-core/axe.min.js`.

## Medição de desempenho

Três carregamentos novos de cada versão em Chromium, na mesma máquina e viewport de 1440 × 1000. A abertura da marca foi marcada como já vista, o service worker foi bloqueado e a medição foi feita após a rede estabilizar. Os valores abaixo somam `encodedBodySize` dos recursos do documento, sem compressão HTTP do servidor local e sem o tráfego do cache em segundo plano.

| Recursos da primeira abertura | ZIP original | Versão 4.5 |
| --- | ---: | ---: |
| Amostra 1 | 3.296.104 bytes | 1.154.200 bytes |
| Amostra 2 | 3.296.104 bytes | 1.154.200 bytes |
| Amostra 3 | 3.296.104 bytes | 1.154.200 bytes |
| Mediana | 3,30 MB | 1,15 MB |

Redução de **65,0%** nos recursos dessa carga inicial. O principal ganho vem da retirada do motor e das bibliotecas 3D da abertura, da remoção de Anime.js do carregamento e do carregamento do PDF apenas ao exportar. Esta medição compara bytes; não mede velocidade em aparelhos reais nem comprova Core Web Vitals em produção.

A auditoria original do ZIP falhava porque tratava `intro.js` como parte da sequência compartilhada e porque faltava `.nojekyll`. Ambos foram corrigidos. Os testes de movimento e de cache foram ajustados às durações e à versão novas.
