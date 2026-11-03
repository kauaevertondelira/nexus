import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const siteURL='https://nexus.test/nexus/';
const root=path.resolve(process.env.NEXUS_SITE_ROOT||fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};

// Arquivos locais servidos na memória do navegador. HTTPS mantém o mesmo fluxo
// Swup da publicação, sem depender de servidor, credenciais ou acesso ao Firebase.
export async function serveLocalSite(context) {
  await context.route(siteURL+'**',async route=>{
    const url=new URL(route.request().url());
    let target;
    try{target=path.resolve(root,decodeURIComponent(url.pathname.slice('/nexus/'.length))||'index.html');}catch{await route.fulfill({status:400,body:''});return;}
    if(!target.startsWith(root+path.sep)){await route.fulfill({status:403,body:''});return;}
    try{await route.fulfill({status:200,body:await fs.readFile(target),contentType:mime[path.extname(target)]||'application/octet-stream',headers:{'Cache-Control':'no-store'}});}
    catch{await route.fulfill({status:404,body:'Arquivo não encontrado'});}
  });
}
