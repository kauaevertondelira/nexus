/* Modelo local das expressões. Não substitui o compilador/simulador Firebase. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const rules=JSON.parse(fs.readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')).rules;
class Snapshot{
 constructor(tree,parts=[]){this.tree=tree;this.parts=parts;}
 val(){return this.parts.reduce((v,k)=>v?.[k],this.tree)??null;}
 child(key){return new Snapshot(this.tree,[...this.parts,...String(key).split('/')]);}
 parent(){return new Snapshot(this.tree,this.parts.slice(0,-1));}
 exists(){return this.val()!==null;}
 hasChildren(keys){const value=this.val();return !!value&&typeof value==='object'&&(keys?keys.every(k=>value[k]!==undefined&&value[k]!==null):Object.keys(value).length>0);}
 isString(){return typeof this.val()==='string';}
 isNumber(){return typeof this.val()==='number'&&Number.isFinite(this.val());}
 isBoolean(){return typeof this.val()==='boolean';}
}
function evaluate(expression,{old={},future=old,path='',uid='user',email='user@example.com',variables={}}={}){
 if(typeof expression==='boolean')return expression;
 const parts=path?path.split('/'):[];
 const context=vm.createContext({auth:uid?{uid,token:{email}}:null,root:new Snapshot(old),data:new Snapshot(old,parts),newData:new Snapshot(future,parts),now:Date.now(),...variables});
 // beginsWith/contains são nomes da API Rules; o modelo usa equivalentes JS.
 return vm.runInContext('('+expression.replace(/\.beginsWith\(/g,'.startsWith(').replace(/\.contains\(/g,'.includes(')+')',context,{timeout:1000});
}
const profile=(role='Administrador',accessStatus='active')=>({users:{user:{name:'Teste',email:'user@example.com',role,accessStatus}}});
test('Todas as expressões das regras têm sintaxe válida no modelo local',()=>{let count=0;const walk=node=>{for(const [key,value]of Object.entries(node)){if(key.startsWith('.')&&typeof value==='string'){assert.doesNotThrow(()=>new vm.Script('('+value+')'));count++;}else if(value&&typeof value==='object'&&!Array.isArray(value))walk(value);}};walk(rules);assert.ok(count>150);});
test('Visitantes e perfis pendentes não leem ativos; perfil aprovado lê',()=>{assert.equal(evaluate(rules.assets['.read'],{uid:null}),false);assert.equal(evaluate(rules.assets['.read'],{old:profile('Técnico de Manutenção','pending')}),false);assert.equal(evaluate(rules.assets['.read'],{old:profile('Técnico de Manutenção')}),true);});
test('Cadastro público é pendente e não pode se promover a administrador',()=>{const future={users:{user:{name:'Teste',email:'user@example.com',role:'Técnico de Manutenção',accessStatus:'pending'}}};const scope={old:{},future,path:'users/user',variables:{$uid:'user'}};assert.equal(evaluate(rules.users.$uid['.write'],scope),true);future.users.user.role='Administrador';assert.equal(evaluate(rules.users.$uid['.write'],scope),false);});
test('Técnico não toma a ordem de outro técnico mesmo sendo criador',()=>{const old={...profile('Técnico de Manutenção'),work_orders:{order:{title:'Teste',assetId:'asset',status:'open',createdByUid:'user',assignedToUid:'other'}}};const future=structuredClone(old);future.work_orders.order.assignedToUid='user';assert.equal(evaluate(rules.work_orders.$id['.write'],{old,future,path:'work_orders/order',variables:{$id:'order'}}),false);old.work_orders.order.assignedToUid='';assert.equal(evaluate(rules.work_orders.$id['.write'],{old,future,path:'work_orders/order',variables:{$id:'order'}}),true);});
test('Plano cria ordem e checklist juntos usando o estado futuro',()=>{const old=profile(),future={...structuredClone(old),assets:{asset:{name:'Motor',status:'online'}},work_orders:{order:{title:'Plano',assetId:'asset',status:'scheduled',createdByUid:'user'}},work_order_checklists:{order:{item:{title:'Inspecionar',done:false}}}};assert.equal(evaluate(rules.work_orders.$id.assetId['.validate'],{old,future,path:'work_orders/order/assetId'}),true);assert.equal(evaluate(rules.work_order_checklists.$orderId.$itemId['.write'],{old,future,path:'work_order_checklists/order/item',variables:{$orderId:'order',$itemId:'item'}}),true);});
test('Saldo negativo, links inseguros e escrita de telemetria são recusados',()=>{assert.equal(evaluate(rules.inventory.$id.qty['.validate'],{future:{inventory:{item:{qty:-1}}},path:'inventory/item/qty'}),false);assert.equal(evaluate(rules.asset_documents.$assetId.$documentId.url['.validate'],{future:{asset_documents:{asset:{doc:{url:'javascript:alert(1)'}}}},path:'asset_documents/asset/doc/url'}),false);assert.equal(evaluate(rules.asset_documents.$assetId.$documentId.url['.validate'],{future:{asset_documents:{asset:{doc:{url:'https://example.com/manual.pdf'}}}},path:'asset_documents/asset/doc/url'}),true);assert.equal(rules.telemetry['.write'],false);});
test('Foto só pode ser alterada pelo dono do perfil e tem limite de tamanho',()=>{
  const old=profile('Técnico de Manutenção'),path='users/user/photoURL',variables={$uid:'user'};
  assert.equal(evaluate(rules.users.$uid.photoURL['.write'],{old,path,variables}),true);
  assert.equal(evaluate(rules.users.$uid.photoURL['.write'],{old,path,variables,uid:'other'}),false);
  assert.equal(evaluate(rules.users.$uid.photoURL['.write'],{old,path,variables,uid:null}),false);
  assert.equal(evaluate(rules.users.$uid.photoURL['.write'],{old:{},path,variables}),false);
  const future=structuredClone(old);future.users.user.photoURL='a'.repeat(400001);
  assert.equal(evaluate(rules.users.$uid.photoURL['.validate'],{old,future,path,variables}),false);
  for(const photoURL of ['', 'data:image/jpeg;base64,YWJj', 'data:image/png;base64,YWJj', 'data:image/webp;base64,YWJj', 'https://example.com/photo.jpg']){future.users.user.photoURL=photoURL;assert.equal(evaluate(rules.users.$uid.photoURL['.validate'],{old,future,path,variables}),true);}
  for(const photoURL of ['javascript:alert(1)','data:image/svg+xml;base64,YWJj','http://example.com/photo.jpg']){future.users.user.photoURL=photoURL;assert.equal(evaluate(rules.users.$uid.photoURL['.validate'],{old,future,path,variables}),false);}
});
