/* Auditoria de publicação: não instala pacotes e não altera o repositório. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const failures=[];let references=0;
const files=[];const walk=dir=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules'].includes(item.name))continue;const p=path.join(dir,item.name);item.isDirectory()?walk(p):files.push(p);}};walk(root);
const verify=(source,ref)=>{
 if(!ref||/^(?:https?:|data:|blob:|mailto:|tel:|#|\/\/)/i.test(ref))return;
 if(ref.startsWith('/')){failures.push(path.relative(root,source)+': caminho absoluto quebra repositórios Pages: '+ref);return;}
 const clean=decodeURIComponent(ref.split(/[?#]/)[0]);if(!clean)return;
 const target=path.resolve(path.dirname(source),clean);
 if(!target.startsWith(root+path.sep)&&target!==root){failures.push('Referência fora da publicação: '+ref);return;}
 references++;if(!fs.existsSync(target))failures.push(path.relative(root,source)+' → arquivo ausente: '+ref);
};
for(const source of files){const extension=path.extname(source);if(!['.html','.css','.js','.mjs','.json','.webmanifest'].includes(extension))continue;const text=fs.readFileSync(source,'utf8');
 if(text.includes('\uFFFD'))failures.push(path.relative(root,source)+': codificação inválida');
 if(extension==='.html'){
   for(const match of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g))verify(source,match[1]);
   if(!/<html[^>]+lang="pt-BR"/.test(text))failures.push(path.relative(root,source)+': idioma ausente');
   if(!text.includes('name="viewport"'))failures.push(path.relative(root,source)+': viewport ausente');
   if(!/<h1\b/.test(text))failures.push(path.relative(root,source)+': título principal ausente');
 }
 if(extension==='.css')for(const match of text.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))verify(source,match[1]);
 if(extension==='.js'||extension==='.mjs'){
  for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))verify(source,match[1]);
  const check=spawnSync(process.execPath,['--check',source],{encoding:'utf8'});if(check.status!==0)failures.push(path.relative(root,source)+': '+(check.stderr?.trim()||check.error?.message||'Falha na verificação de sintaxe.'));
 }
 if(extension==='.json'||extension==='.webmanifest')try{JSON.parse(text);}catch(error){failures.push(path.relative(root,source)+': JSON inválido: '+error.message);}
}
const pages=JSON.parse(fs.readFileSync(path.join(root,'public/assets/data/routes.json'),'utf8'));
const views=fs.readFileSync(path.join(root,'public/assets/js/views.js'),'utf8');
for(const page of Object.keys(pages)){if(!fs.existsSync(path.join(root,'public/pages',page+'.html')))failures.push('Página prevista ausente: '+page);if(page!=='login'&&!views.includes('N.views.'+page+'=')&&!views.includes("N.views['"+page+"']="))failures.push('Módulo sem renderizador: '+page);}
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8'),shell=JSON.parse(sw.match(/const SHELL=(\[[\s\S]*?\]);/)[1]);for(const ref of shell)verify(path.join(root,'service-worker.js'),ref);
if(!fs.existsSync(path.join(root,'.nojekyll')))failures.push('.nojekyll ausente');
const rules=JSON.parse(fs.readFileSync(path.join(root,'database.rules.json'),'utf8')).rules;
if(rules['.read']!==false||rules['.write']!==false)failures.push('A raiz do banco precisa negar acesso por padrão.');
if(rules.telemetry['.write']!==false)failures.push('Telemetria não pode ser gravada pelo navegador.');
if(!rules.users.$uid['.write'].includes("accessStatus').val() === 'pending'"))failures.push('Cadastro público sem aprovação pendente.');
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('PASS · '+Object.keys(pages).length+' páginas · '+references+' referências locais · sintaxe, cache, fontes, imports e regras JSON.');
