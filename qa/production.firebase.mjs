/* Integração real com emulador local; nunca aponta ao projeto do usuário. */
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {createMockUserToken} from '@firebase/util';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {webcrypto} from 'node:crypto';

const context=vm.createContext({window:{Nexus:{}}});
vm.runInContext(fs.readFileSync(new URL('../public/assets/js/production-data.js',import.meta.url),'utf8'),context);
const productionPatch=context.window.Nexus.productionPatch;
const env=await initializeTestEnvironment({projectId:'demo-nexus-production',database:{host:'127.0.0.1',port:9000,rules:fs.readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')}});
const project='demo-nexus-production';
const operator='operator',other='other';
async function request(uid,method,path='',body) {
  const url=new URL('http://127.0.0.1:9000/'+path+'.json');url.searchParams.set('ns',project);
  const headers={'Content-Type':'application/json'};
  if(uid==='admin')headers.Authorization='Bearer owner';
  else if(uid)url.searchParams.set('auth',createMockUserToken({sub:uid,user_id:uid},project));
  // Transporte documentado para ambientes de QA que não encaminham GET local.
  if(method==='GET'&&process.env.NEXUS_QA_METHOD_OVERRIDE==='1'){headers['X-HTTP-Method-Override']='GET';method='POST';}
  const response=await fetch(url,{method,headers,signal:AbortSignal.timeout(10000),...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json();
  return {status:response.status,result};
}
async function succeeds(promise){const response=await promise;assert.equal(response.status,200,JSON.stringify(response.result));return response.result;}
async function fails(promise){const response=await promise;assert.ok([401,403].includes(response.status),'Esperava recusa: '+JSON.stringify(response));}
const write=(uid,path,body)=>request(uid,'PUT',path,body);
const change=(uid,path,body)=>request(uid,'PATCH',path,body);
const read=async(uid,path)=>succeeds(request(uid,'GET',path));
const event=(sessionId,createdByUid='operator',source='camera')=>({id:'PEC-'+randomUUID(),assetId:'M-204',sessionId,createdByUid,source,detectedAt:Date.now()});
const patch=e=>JSON.parse(JSON.stringify(productionPatch(e)));
const stamp=()=>({'.sv':'timestamp'});
const session=(uid,label)=>({assetId:'M-204',label,createdByUid:uid,status:'open',startedAt:stamp()});
try {
  await succeeds(write('admin','',{assets:{'M-204':{name:'Máquina de teste'}},users:{operator:{name:'Operador',role:'Supervisor de Produção',accessStatus:'active'},other:{name:'Técnico',role:'Técnico de Manutenção',accessStatus:'active'},buyer:{name:'Comprador',role:'Comprador',accessStatus:'active'},pending:{name:'Pendente',role:'Supervisor de Produção',accessStatus:'pending'}}}));
  await succeeds(write(operator,'production_sessions/SES-A',session('operator','Turno A')));
  await succeeds(write(other,'production_sessions/SES-B',session('other','Turno B')));
  const events=Array.from({length:20},(_,i)=>event(i%2?'SES-B':'SES-A',i%2?'other':'operator'));
  await Promise.all(events.map((e,i)=>succeeds(change(i%2?other:operator,'',patch(e)))));
  assert.equal((await read(operator,'production_totals/M-204/count')),20);
  assert.equal((await read(operator,'production_session_totals/SES-A/count')),10);
  assert.equal((await read(operator,'production_session_totals/SES-B/count')),10);
  assert.equal(Object.keys((await read(operator,'production_events/M-204'))).length,20);
  console.log('PASS · 20 gravações concorrentes, duas contas/sessões, totais e eventos coerentes.');

  await fails(change(operator,'',patch(events[0])));
  await fails(write(operator,'production_totals/M-204/count',500));
  await fails(write(operator,'production_totals/M-204/count',20.5));
  await fails(write(operator,'production_totals/M-204',null));
  const missingEvent=patch(event('SES-A'));delete missingEvent[Object.keys(missingEvent).find(k=>k.startsWith('production_events/'))];
  await fails(change(operator,'',missingEvent));
  const missingSession=patch(event('SES-A'));for(const key of Object.keys(missingSession))if(key.startsWith('production_session_totals/'))delete missingSession[key];
  await fails(change(operator,'',missingSession));
  const orphan=event('SES-A');await fails(write(operator,'production_events/M-204/'+orphan.id,{...orphan,receivedAt:stamp()}));
  await fails(change(operator,'production_events/M-204/'+events[0].id,{source:'manual'}));
  await fails(write(operator,'production_events/M-204/'+events[0].id,null));
  assert.equal((await read(operator,'production_totals/M-204/count')),20);
  console.log('PASS · duplicidade, total forjado/fracionário, escrita parcial, evento isolado e alteração/exclusão do histórico recusados.');

  await fails(change(operator,'',patch(event('SES-B'))));
  await fails(change(operator,'',patch(event('SES-A','other'))));
  await fails(change(operator,'',patch(event('SES-A','operator','desconhecido'))));
  await fails(change('buyer','',patch(event('SES-A','buyer'))));
  await fails(request(null,'GET','production_totals'));
  await fails(request('pending','GET','production_totals'));
  await succeeds(request('buyer','GET','production_totals'));
  await fails(write(operator,'telemetry/latest/TEST',{temperature:20,vibration:1,receivedAt:Date.now()}));
  console.log('PASS · autenticação, aprovação, cargo, propriedade da sessão e separação da telemetria respeitados.');

  await succeeds(change(operator,'',patch(event('SES-A','operator','manual'))));
  await succeeds(change(operator,'production_sessions/SES-A',{status:'closed',endedAt:stamp()}));
  await fails(change(operator,'',patch(event('SES-A'))));
  await fails(change(operator,'production_sessions/SES-A',{status:'open',endedAt:null}));
  await fails(write(operator,'production_sessions/SES-A',null));
  assert.equal((await read(operator,'production_totals/M-204/count')),21);
  assert.equal((await read(operator,'production_session_totals/SES-A/count')),11);
  console.log('PASS · manual identificado; encerramento preserva totais e impede novos registros/reabertura.');

  // Exercitar o transporte e a fila da aplicação, além do contrato das regras.
  await succeeds(write(operator,'production_sessions/SES-C',session('operator','Transporte real')));
  const values=new Map(),localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i]??null,get length(){return values.size;}};
  const runtime=vm.createContext({window:{NEXUS_FIREBASE_CONFIG:{databaseURL:'https://demo-nexus-production.firebaseio.com'}},document:{currentScript:{src:'https://example.com/nexus/public/assets/js/core.js'},dispatchEvent(){}},navigator:{onLine:true},URL,Intl,crypto:webcrypto,localStorage,CustomEvent:class{},AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{
    const target=new URL(url);assert.equal(target.hostname,'demo-nexus-production.firebaseio.com');
    target.protocol='http:';target.hostname='127.0.0.1';target.port='9000';target.searchParams.set('ns',project);
    if(options.method==='GET'&&process.env.NEXUS_QA_METHOD_OVERRIDE==='1')options={...options,method:'POST',headers:{...options.headers,'X-HTTP-Method-Override':'GET'}};
    return fetch(target,options);
  }});
  for(const name of ['core','data','production-data'])vm.runInContext(fs.readFileSync(new URL('../public/assets/js/'+name+'.js',import.meta.url),'utf8'),runtime);
  const N=runtime.window.Nexus;N.mode='firebase';N.uid=operator;N.user={name:'Operador',role:'Supervisor de Produção',accessStatus:'active'};
  N.data={assets:{'M-204':{name:'Máquina'}},production_sessions:{'SES-C':{...session(operator,'Transporte real'),startedAt:Date.now()}}};
  N.auth={currentUser:{getIdToken:async()=>createMockUserToken({sub:operator,user_id:operator},project)}};
  N.queueProductionPiece('SES-C','camera');await N.flushProduction();
  assert.equal(N.pendingProduction().length,0);assert.equal((await read(operator,'production_totals/M-204/count')),22);
  const transport=N.productionRequest;
  N.productionRequest=async function(method,path,body){const result=await transport.call(this,method,path,body);if(method==='PATCH')throw new Error('Resposta perdida depois do commit real');return result;};
  N.queueProductionPiece('SES-C','manual');await N.flushProduction();
  assert.equal(N.pendingProduction().length,0);assert.equal(N.productionSync.error,'');
  assert.equal((await read(operator,'production_totals/M-204/count')),23);
  assert.equal((await read(operator,'production_session_totals/SES-C/count')),2);
  console.log('PASS · código REST e fila da aplicação gravam no emulador e recuperam resposta perdida sem duplicar.');
}finally{await env.cleanup();}
