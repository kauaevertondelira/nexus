# Bibliotecas e fontes incluídas

Os arquivos visuais são distribuídos localmente para evitar que a interface dependa de CDNs. Os avisos originais foram mantidos e os textos de licença disponíveis no pacote oficial estão em `licenses/`.

| Componente | Versão | Uso | Licença / origem |
| --- | --- | --- | --- |
| Anime.js | 4.5.0 | Entrada sequencial das letras da marca | MIT, [instalação oficial](https://animejs.com/documentation/getting-started/installation/), licença em `licenses/Anime-LICENSE.md` |
| Motion (motion.dev) | 14.4.0 | Progresso de leitura e interação dos módulos com mouse e teclado | MIT, [instalação oficial](https://motion.dev/docs/quick-start), licença em `licenses/Motion-LICENSE.md` |
| GSAP e ScrollTrigger | 3.15.0 | Entradas, sequência de elementos e scroll | [Standard License](https://gsap.com/standard-license), [instalação oficial](https://gsap.com/docs/v3/Installation/) |
| Swup | 4.10.0 | Navegação entre HTMLs | MIT, [projeto oficial](https://github.com/swup/swup) |
| Three.js | 0.186.1 | Motor e planta procedural | MIT, [projeto oficial](https://github.com/mrdoob/three.js) |
| jsPDF | 4.2.1 | Relatórios e fichas PDF | MIT, [projeto oficial](https://github.com/parallax/jsPDF) |
| QRCode.js | 1.0.0 | Etiquetas dos equipamentos | MIT, [projeto oficial](https://github.com/davidshimjs/qrcodejs) |
| Inter / Fontsource | 5.3.0 | Texto de operação | SIL OFL, [família oficial](https://github.com/rsms/inter) |
| Space Grotesk / Fontsource | 5.3.0 | Títulos, marca e indicadores | SIL OFL, [família oficial](https://github.com/floriankarsten/space-grotesk) |

A Three.js minificada importa `three.core.js`, incluído junto ao módulo. Não remova esse arquivo ao publicar.

Firebase Web compat 10.12.2 é carregado de `www.gstatic.com` quando se usa o acesso real; ele não está instalado por npm nem incluído no cache offline. O código do SDK segue a licença Apache 2.0 do [projeto Firebase JS SDK](https://github.com/firebase/firebase-js-sdk). A [documentação Firebase](https://firebase.google.com/docs/web/setup) explica a configuração Web.

VLibras é opcional e carregado de `https://vlibras.gov.br/app/vlibras-plugin.js` após uma ação do usuário. Consulte o [serviço oficial VLibras](https://www.gov.br/governodigital/pt-br/acessibilidade-e-usuario/vlibras).

Não foram copiados imagens, textos, modelos ou logotipos das referências de design. A marca, os ícones SVG e as geometrias procedurais Nexus foram produzidos para esta reconstrução.
