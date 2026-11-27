# Bibliotecas e fontes incluídas

Os arquivos visuais são distribuídos localmente para evitar que a interface dependa de CDNs. Os avisos originais foram mantidos e os textos de licença disponíveis no pacote oficial estão em `licenses/`.

| Componente | Versão | Uso | Licença / origem |
| --- | --- | --- | --- |
| Motion (motion.dev) | 14.14.0 | Progresso de leitura e interação dos módulos com mouse e teclado | MIT, [instalação oficial](https://motion.dev/docs/quick-start), licença em `licenses/Motion-LICENSE.md` |
| GSAP e ScrollTrigger | 3.15.1 | Entradas, sequência de elementos e scroll | [Standard License](https://gsap.com/standard-license), [instalação oficial](https://gsap.com/docs/v3/Installation/) |
| Swup | 4.10.0 | Navegação entre HTMLs | MIT, [projeto oficial](https://github.com/swup/swup) |
| Lenis | 1.3.29 | Rolagem suave apenas na abertura, respeitando movimento reduzido | MIT, [projeto oficial](https://github.com/darkroomengineering/lenis), licença em `licenses/Lenis-LICENSE.txt` |
| shadcn/ui + React | CLI 4.23.1 / React 19.3.1 | Botão de recolher/expandir a barra lateral; código-fonte em `src/ui/` | MIT, [registro original do botão](https://ui.shadcn.com/r/styles/new-york-v4/button.json), licença em `licenses/shadcn-LICENSE.md`; avisos da ilha compilada em `public/assets/vendor/nexus-ui/sidebar.js.LEGAL.txt` |
| Three.js | 0.186.1 | Mapa esquemático dos equipamentos | MIT, [projeto oficial](https://github.com/mrdoob/three.js) |
| jsPDF | 4.2.1 | Relatórios e fichas PDF | MIT, [projeto oficial](https://github.com/parallax/jsPDF) |
| QRCode.js | 1.0.0 | Etiquetas dos equipamentos | MIT, [projeto oficial](https://github.com/davidshimjs/qrcodejs) |
| Inter / Fontsource | 5.3.0 | Texto de operação | SIL OFL, [família oficial](https://github.com/rsms/inter) |
| Space Grotesk / Fontsource | 5.3.0 | Títulos, marca e indicadores | SIL OFL, [família oficial](https://github.com/floriankarsten/space-grotesk) |

A Three.js minificada importa `three.core.js`, incluído junto ao módulo. Não remova esse arquivo ao publicar.

Firebase Web compat 10.12.2 é carregado de `www.gstatic.com` quando se usa o acesso real; ele não está instalado por npm nem incluído no cache offline. O código do SDK segue a licença Apache 2.0 do [projeto Firebase JS SDK](https://github.com/firebase/firebase-js-sdk). A [documentação Firebase](https://firebase.google.com/docs/web/setup) explica a configuração Web.

VLibras é opcional e carregado de `https://vlibras.gov.br/app/vlibras-plugin.js` após uma ação do usuário. Consulte o [serviço oficial VLibras](https://www.gov.br/governodigital/pt-br/acessibilidade-e-usuario/vlibras).

Não foram copiados imagens, textos, modelos ou logotipos das referências de design. A marca, os ícones SVG e as geometrias procedurais Nexus foram produzidos para esta reconstrução.

## Fotos do carrossel inicial

São imagens já presentes no ZIP recebido. As novas versões WebP foram redimensionadas e comprimidas, sem modificar o conteúdo. Os créditos aparecem na própria abertura.

| Arquivo WebP | Original incluído | Crédito e licença |
| --- | --- | --- |
| `industrial/robotica-*` | `login/robos-1280.jpg` | BMW Werk Leipzig, [CC BY-SA 2.0 DE](https://creativecommons.org/licenses/by-sa/2.0/de/deed.pt_BR), [origem](https://commons.wikimedia.org/wiki/File:BMW_Leipzig_MEDIA_050719_Download_Karosseriebau_max.jpg) |
| `industrial/usinagem-*` | `login/torno-1280.jpg` | David English, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.pt_BR), [origem](https://commons.wikimedia.org/wiki/File:3_Jaw_Chuck_in_Use.jpg) |
| `industrial/maquina-cnc-*` | `login/torno-cnc-1280.jpg` | Whoisjohngalt, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.pt_BR), [origem](https://commons.wikimedia.org/wiki/File:Tsugami_CNC_Lathe.jpg) |

O botão shadcn/ui conserva o código do registro oficial, com os imports de `Slot` e `cn` adaptados ao projeto. As dependências são fixadas em `package-lock.json`. A interface usa a API JavaScript do Motion, da mesma família do Framer Motion, apropriada ao site estático.
