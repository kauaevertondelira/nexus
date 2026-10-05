/* Servidor opcional para desenvolvimento. GitHub Pages não precisa deste arquivo. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.NEXUS_PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(pathname==='/'||pathname==='/nexus'){res.writeHead(302,{Location:'/nexus/'});res.end();return;}
 if(!pathname.startsWith('/nexus/')){res.writeHead(404);res.end('Not found');return;}
 const relative=pathname.slice('/nexus/'.length)||'index.html',target=path.resolve(root,relative);
 if(!target.startsWith(root+path.sep)||target.includes(path.sep+'.git'+path.sep)){res.writeHead(403);res.end();return;}
 fs.stat(target,(error,stat)=>{if(error||!stat.isFile()){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Arquivo não encontrado');return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).pipe(res);});
}).listen(port,'127.0.0.1',()=>console.log('Nexus: http://127.0.0.1:'+port+'/nexus/ (sem Firebase local)'));
