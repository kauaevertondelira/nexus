import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
function nexus(){const doc={currentScript:{src:'https://example.github.io/nexus/public/assets/js/core.js'},dispatchEvent(){},querySelector(){return null;}};const context=vm.createContext({window:{},document:doc,navigator:{onLine:true},URL,URLSearchParams,Intl,Date,Number,Math,JSON,Map,Set,crypto:webcrypto,localStorage:storage(),sessionStorage:storage(),CustomEvent:class{},setTimeout,clearTimeout,console,location:{search:'',protocol:'https:'}});for(const file of ['core','data','ui','profile','views'])vm.runInContext(fs.readFileSync(path.join(root,'public/assets/js/'+file+'.js'),'utf8'),context);const N=context.window.Nexus;N.data=N.seed();N.mode='demo';N.uid='demo';N.user=N.data.users.demo;return {N,context};}
test('URLs mantêm o nome do repositório e links de detalhes',()=>{const {N}=nexus();assert.equal(N.base.href,'https://example.github.io/nexus/');assert.equal(N.href('ativos'),'https://example.github.io/nexus/public/pages/ativos.html');assert.equal(N.safeURL('javascript:alert(1)'),'');assert.equal(N.safeURL('https://example.com/manual.pdf'),'https://example.com/manual.pdf');});
test('Indicadores se baseiam nos registros e não somam custos duplicados',()=>{const {N}=nexus(),m=N.metrics();assert.equal(m.assets.length,8);assert.equal(m.availability,75);assert.equal(m.open.length,4);assert.equal(m.critical.length,2);assert.equal(m.stock.length,3);assert.equal(m.cost,3710);assert.equal(m.mttr,1.5);assert.equal(m.mtbf,3544);N.data.assets={};N.data.work_orders={};assert.equal(N.metrics().availability,null);assert.equal(N.metrics().mtbf,null);});
test('Os oito cargos limitam módulos, gravações e ordens atribuídas',()=>{const {N}=nexus();for(const role of N.roles){N.user={role};assert.equal(N.canAccess('menu'),true);assert.equal(N.canAccess('perfil'),true);assert.equal(N.canAccess('continuidade'),role==='Administrador');assert.equal(N.canWrite('supplier_contracts'),['Administrador','Gestor Financeiro'].includes(role));}N.user={role:'Técnico de Manutenção'};assert.equal(N.canWrite('inventory'),false);assert.equal(N.canOrder({assignedToUid:'other'}),false);assert.equal(N.canOrder({assignedToUid:'demo'}),true);N.user={role:'Gestor de Manutenção',allowedPages:['ativos']};assert.equal(N.canAccess('ativos'),true);assert.equal(N.canAccess('os'),false);});
test('Movimentação impede saldo negativo e preserva cada lançamento',async()=>{const {N}=nexus();await assert.rejects(N.moveInventory('PEC-001',-4,'Saída de teste'),/Saldo insuficiente/);assert.equal(N.data.inventory['PEC-001'].qty,3);await N.moveInventory('PEC-001',5,'Recebimento de material');await N.moveInventory('PEC-001',-2,'Consumo na ordem 048');assert.equal(N.data.inventory['PEC-001'].qty,6);assert.equal(Object.keys(N.data.inventory['PEC-001'].movements).length,2);});
test('Atualização Firebase de cadastro não sobrescreve saldo concorrente',async()=>{const {N}=nexus(),updates=[];N.mode='firebase';N.online=true;N.db={ref:p=>({update:async value=>updates.push({p,value}),set:async()=>{}})};await N.save('inventory','PEC-001',{name:'Rolamento revisado'});assert.equal(updates.length,1);assert.equal(updates[0].p,'inventory/PEC-001');assert.equal('qty' in updates[0].value,false);});
test('Mutações respeitam cargo, vínculo e protegem identificadores',async()=>{const {N}=nexus();N.user={role:'Comprador',name:'Comprador'};await assert.rejects(N.save('assets','M-204',{name:'Alteração'}),/cargo/);N.user={role:'Administrador',name:'Admin'};await assert.rejects(N.save('assets','__proto__',{name:'Alteração'}),/inválido/);await assert.rejects(N.remove('assets','M-204'),/ordens vinculadas/);await assert.rejects(N.batch({'assets/__proto__/polluted':true}),/Caminho inválido/);});
test('Todas as páginas protegidas renderizam com dados e em estado vazio',()=>{const {N,context}=nexus();for(const page of Object.keys(N.views)){N.route=page;context.location.search=page==='ativo-detalhes'?'?id=M-204':page==='os-detalhes'?'?id=OS-2026-048':'';const html=N.views[page].call(N);assert.ok(html.includes('<h1'),page);assert.ok(!html.includes('[object Object]'),page);}N.data={};N.user={role:'Administrador',name:'Teste',email:'test@example.com'};for(const page of Object.keys(N.views)){N.route=page;context.location.search='';assert.doesNotThrow(()=>N.views[page].call(N),page);}});
test('Demonstração não inicializa nem grava no Firebase',async()=>{const {N,context}=nexus();let called=false;N.sdk=()=>{called=true;throw new Error('Firebase não deve carregar');};N.beginDemo();assert.equal(await N.connect(),true);await N.save('assets','QA-DEMO',{name:'Ativo local',status:'online'});assert.equal(called,false);assert.ok(context.localStorage.getItem('nexus-industrial-demo-v4').includes('QA-DEMO'));});
test('Backup recupera relações, checklists e horas sem importar contas ou auditoria',()=>{const {N}=nexus(),data=N.seed();N.data={};const prepared=N.prepareBackup({product:'nexus-industrial',schemaVersion:4,mode:'demo',data});assert.ok(prepared.updates['assets/M-204']);assert.ok(prepared.updates['work_orders/OS-2026-048']);assert.ok(prepared.updates['work_order_time_entries/OS-2026-048/1']);assert.equal(Object.keys(prepared.updates).some(p=>p.startsWith('users/')||p.startsWith('audit_logs/')||p.startsWith('telemetry/')),false);});
test('Backup rejeita mistura com produção, vínculos ausentes e chaves reservadas',()=>{const {N}=nexus();N.mode='firebase';const backup={product:'nexus-industrial',schemaVersion:4,mode:'demo',data:N.seed()};assert.throws(()=>N.prepareBackup(backup),/Firebase real/);backup.mode='firebase';backup.data.assets={};N.data={};assert.throws(()=>N.prepareBackup(backup),/Equipamento ausente/);const malicious=JSON.parse('{"product":"nexus-industrial","schemaVersion":4,"mode":"firebase","data":{"assets":{"__proto__":{"name":"x"}}}}');assert.throws(()=>N.prepareBackup(malicious),/Chave inválida/);});
test('Ordens encerradas preservam a ficha e canceladas continuam visíveis no Kanban',()=>{const {N}=nexus();N.data.work_orders['OS-CANCEL']={title:'Intervenção cancelada',assetId:'M-204',status:'cancelled',priority:'normal'};N.route='os';N.layout='grid';assert.ok(N.views.os.call(N).includes('OS-CANCEL'));N.layout='table';const html=N.views.os.call(N);assert.equal(html.includes('aria-label="Editar Lubrificar célula robotizada"'),false);assert.ok(html.includes('OS-2026-047'));});
test('Foto só permite imagens raster locais ou HTTPS e escapa atributos',()=>{
  const {N}=nexus();
  for(const url of ['javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','http://example.com/a.png','data:image/png;base64,<img>','data:image/jpeg;base64,'+'a'.repeat(400000)])assert.equal(N.safePhotoURL(url),'');
  assert.equal(N.safePhotoURL('data:image/jpeg;base64,YWJj'),'data:image/jpeg;base64,YWJj');
  assert.ok(N.avatarContent({name:'  Ana   Maria ',photoURL:'https://example.com/a.png?x="'}).includes('AM'));
  assert.equal(N.avatarContent({name:'Ana',photoURL:'javascript:alert(1)'}).includes('<img'),false);
});
test('Foto é salva, recarregada e removida sem alterar permissões da demonstração',async()=>{
  const {N,context}=nexus(),photoURL='data:image/jpeg;base64,YWJj';
  await N.saveProfile({name:' Ana Maria ',company:' Unidade A ',photoURL,role:'Comprador',accessStatus:'blocked'});
  assert.equal(N.user.name,'Ana Maria');assert.equal(N.user.role,'Administrador');assert.equal(N.user.accessStatus,'active');
  const data=JSON.parse(context.localStorage.getItem('nexus-industrial-demo-v4'));assert.equal(data.users.demo.photoURL,photoURL);
  N.disconnect();N.beginDemo();await N.connect();assert.equal(N.user.photoURL,photoURL);
  await N.saveProfile({name:N.user.name,company:N.user.company,photoURL:''});assert.equal(N.user.photoURL,'');
  assert.equal(JSON.parse(context.localStorage.getItem('nexus-industrial-demo-v4')).users.demo.photoURL,'');
});
test('Perfil real grava apenas no próprio usuário e aguarda confirmação do Firebase',async()=>{
  const {N}=nexus(),calls=[];N.mode='firebase';N.uid='my-uid';N.online=true;
  N.db={ref:path=>({update:async value=>calls.push({path,value})})};
  await N.saveProfile({name:'Meu nome',company:'Empresa',photoURL:'data:image/jpeg;base64,YWJj',role:'Comprador'});
  assert.equal(calls[0].path,'users/my-uid');assert.deepEqual(Object.keys(calls[0].value).sort(),['company','name','photoURL']);
  const before=N.user;N.db.ref=()=>({update:async()=>{throw new Error('PERMISSION_DENIED');}});
  await assert.rejects(N.saveProfile({name:'Outra pessoa'}),/PERMISSION_DENIED/);assert.equal(N.user,before);
  N.online=false;await assert.rejects(N.saveProfile({name:'Meu nome'}),/Sem conexão/);assert.equal(calls.length,1);
});
test('Erro de armazenamento não apresenta foto ou nome como salvos',async()=>{
  const {N}=nexus(),before=N.user,record=N.data.users.demo;N.persist=()=>{throw new Error('QuotaExceededError');};
  await assert.rejects(N.saveProfile({name:'Outro nome',photoURL:'data:image/jpeg;base64,YWJj'}),/armazenamento/);
  assert.equal(N.user,before);assert.equal(N.data.users.demo,record);
});
test('Perfil rejeita nome, empresa, foto e arquivo incompatíveis antes de salvar',async()=>{
  const {N}=nexus();
  for(const value of [{name:' '},{name:'a'.repeat(121)},{name:'Teste',company:'a'.repeat(141)},{name:'Teste',photoURL:'data:text/html;base64,YQ=='}])await assert.rejects(N.saveProfile(value));
  await assert.rejects(N.compressProfilePhoto({type:'image/svg+xml',size:500}),/JPG/);
  await assert.rejects(N.compressProfilePhoto({type:'image/png',size:9*1024*1024}),/8 MB/);
  await assert.rejects(N.compressProfilePhoto({type:'image/png',size:0}),/8 MB/);
});
test('Atualizações em tempo real preservam o rascunho e uma foto tardia não desfaz a remoção',async()=>{
  const {N}=nexus();N.route='perfil';const state=N.profileState();state.name='Rascunho';state.photoURL='data:image/jpeg;base64,YWJj';
  assert.ok(N.views.perfil.call(N).includes('value="Rascunho"'));N.user={...N.user,name:'Nome remoto'};assert.equal(N.profileState().name,'Rascunho');
  let finish;N.compressProfilePhoto=()=>new Promise(resolve=>finish=resolve);
  const pending=N.chooseProfilePhoto({});N.removeProfilePhoto();finish('data:image/jpeg;base64,YQ==');await pending;
  assert.equal(N.profileState().photoURL,'');assert.equal(N.profilePhotoBusy,false);
  N.resetProfileDraft();assert.equal(N.profileState().name,'Nome remoto');
});
test('Uma gravação pendente não aplica o perfil na sessão de outra pessoa',async()=>{
  const {N}=nexus();N.mode='firebase';N.online=true;let finish;
  N.db={ref:()=>({update:()=>new Promise(resolve=>finish=resolve)})};
  const pending=N.saveProfile({name:'Primeira pessoa'});N.uid='another-uid';N.user={name:'Segunda pessoa'};finish();await pending;
  assert.equal(N.user.name,'Segunda pessoa');
});
test('Restaurar demonstração também restaura o perfil e mantém o cargo escolhido',async()=>{
  const {N,context}=nexus();await N.saveProfile({name:'Meu teste',photoURL:'data:image/jpeg;base64,YWJj'});
  context.sessionStorage.setItem('nexus-demo-role','Comprador');N.resetDemo();
  assert.equal(N.user.name,'Rafael Martins');assert.equal(N.user.photoURL,undefined);assert.equal(N.user.role,'Comprador');
});
