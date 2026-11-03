import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

function storage() {
  const values=new Map();
  return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i]??null,get length(){return values.size;}};
}
function client(localStorage=storage()) {
  const context=vm.createContext({window:{},document:{currentScript:{src:'https://example.com/nexus/public/assets/js/core.js'},dispatchEvent(){}},navigator:{onLine:true},URL,URLSearchParams,Intl,crypto:webcrypto,localStorage,sessionStorage:storage(),CustomEvent:class{},setTimeout,clearTimeout,setInterval,clearInterval,console});
  for(const name of ['core','data','production-engine','production-data'])vm.runInContext(fs.readFileSync(new URL('../public/assets/js/'+name+'.js',import.meta.url),'utf8'),context);
  const N=context.window.Nexus;N.mode='demo';N.uid='demo';N.data=N.seed();N.user=N.data.users.demo;
  return {N,context,localStorage};
}
const pixels=(shade=80,fraction=1)=>{
  const data=new Uint8ClampedArray(80*60*4);
  for(let i=0;i<data.length;i+=4){const color=i<data.length*fraction?shade:80;data[i]=data[i+1]=data[i+2]=color;data[i+3]=255;}return data;
};
function calibrated(options={}) {
  const {N}=client(),detector=new N.PassageDetector(options);
  for(let i=0;i<12;i++)assert.equal(detector.process(pixels(),i*100,80).count,false);
  return detector;
}
test('Uma passagem conta uma peça; objeto parado não repete; área livre rearma',()=>{
  const detector=calibrated();let total=0;
  for(let t=1200;t<5000;t+=100)total+=Number(detector.process(pixels(200),t,80).count);
  assert.equal(total,1);
  for(let t=5000;t<5500;t+=100)total+=Number(detector.process(pixels(),t,80).count);
  for(let t=5500;t<6000;t+=100)total+=Number(detector.process(pixels(200),t,80).count);
  assert.equal(total,2);
});
test('Ruído, um quadro isolado e mudança uniforme de exposição não contam',()=>{
  const detector=calibrated();
  assert.equal(detector.process(pixels(200),1200,80).count,false);
  assert.equal(detector.process(pixels(),1300,80).count,false);
  for(let t=1400;t<2500;t+=100)assert.equal(detector.process(pixels(100),t,100).count,false);
  for(let t=2500;t<3500;t+=100)assert.equal(detector.process(pixels(200,.03),t,80).count,false);
});
test('Retirada muito breve e passagens abaixo do intervalo não duplicam',()=>{
  const detector=calibrated({cooldownMs:1600});let total=0;
  for(const [time,color]of [[1200,200],[1300,200],[1400,80],[1500,200],[1600,80],[1700,80],[1800,80],[1900,80],[2000,200],[2100,200],[2200,200]])total+=Number(detector.process(pixels(color),time,80).count);
  assert.equal(total,1);
  // A passagem rápida suprimida continua ocupada: segurar não gera contagem tardia.
  for(let t=2300;t<4000;t+=100)total+=Number(detector.process(pixels(200),t,80).count);
  assert.equal(total,1);
});
test('Calibração e sensibilidade têm efeito mensurável; pausa não completa candidato',()=>{
  const normal=calibrated(),high=calibrated({sensitivity:'high'});
  normal.process(pixels(130,.12),1200,80);high.process(pixels(130,.12),1200,80);
  assert.equal(normal.process(pixels(130,.12),1300,80).count,false);
  assert.equal(high.process(pixels(130,.12),1300,80).count,true);
  const detector=calibrated();detector.process(pixels(200),1200,80);
  assert.equal(detector.process(pixels(200),4000,80).count,false);
  detector.reset();assert.equal(detector.process(pixels(200),4100,80).state,'calibrating');
});
test('Peças e ambos os totais são persistidos em demo, sem inicializar Firebase',async()=>{
  const {N}=client();N.sdk=()=>{throw new Error('Não inicializar Firebase');};
  const id=await N.createProductionSession('M-204','Turno A');
  N.queueProductionPiece(id,'manual');N.queueProductionPiece(id,'camera');await N.flushProduction();
  assert.equal(N.productionCount('M-204'),2);assert.equal(N.data.production_session_totals[id].count,2);
  assert.equal(Object.keys(N.data.production_events['M-204']).length,2);assert.equal(N.pendingProduction().length,0);
  N.queueProductionPiece(id,'manual');await N.flushProduction();assert.equal(N.productionCount('M-204'),3);
  await N.finishProductionSession(id);assert.equal(N.data.production_sessions[id].status,'closed');
  assert.throws(()=>N.queueProductionPiece(id),/sessão/);
});
test('Resposta perdida após commit é reconhecida pelo ID e não soma novamente',async()=>{
  const {N}=client(),id=await N.createProductionSession('M-204','Turno B');N.mode='firebase';
  let writes=0,saved;N.productionRequest=async(method,path,patch)=>{
    if(method==='PATCH'){writes++;saved=patch[Object.keys(patch).find(k=>k.startsWith('production_events/'))];throw new Error('Resposta perdida');}
    return saved;
  };
  N.queueProductionPiece(id);await N.flushProduction();
  assert.equal(writes,1);assert.equal(N.pendingProduction().length,0);assert.equal(N.productionSync.error,'');
});
test('Fila sobrevive a recarga, fica isolada por conta/modo e reenvia o mesmo ID',async()=>{
  const first=client(),N=first.N,id=await N.createProductionSession('M-204','Sem rede');N.mode='firebase';N.online=false;
  const eventId=N.queueProductionPiece(id);assert.equal(N.pendingProduction().length,1);assert.equal(N.productionCount('M-204'),0);
  const second=client(first.localStorage),M=second.N;M.data=N.data;M.mode='firebase';M.online=true;
  assert.equal(M.pendingProduction()[0].id,eventId);
  M.uid='other';assert.equal(M.pendingProduction().length,0);M.uid='demo';M.mode='demo';assert.equal(M.pendingProduction().length,0);M.mode='firebase';
  let actualId;M.productionRequest=async(method,path,body)=>{actualId=Object.keys(body).find(k=>k.startsWith('production_events/')).split('/').at(-1);return {};};
  await M.flushProduction();assert.equal(actualId,eventId);assert.equal(M.pendingProduction().length,0);
});
test('Banco indisponível conserva fila e impede encerrar até confirmação',async()=>{
  const {N}=client(),id=await N.createProductionSession('M-204','Erro');N.mode='firebase';
  N.productionRequest=async()=>{throw new Error('Serviço indisponível');};
  N.queueProductionPiece(id);await N.flushProduction();assert.equal(N.pendingProduction().length,1);assert.match(N.productionSync.error,/indisponível/);
  await assert.rejects(N.finishProductionSession(id),/Sincronize/);assert.equal(N.data.production_sessions[id].status,'open');
});
test('Falta de espaço, cargo sem permissão e sessão de outro usuário impedem contagem',async()=>{
  const {N,localStorage}=client(),id=await N.createProductionSession('M-204','Teste');
  localStorage.setItem=()=>{throw new Error('QuotaExceeded');};assert.throws(()=>N.queueProductionPiece(id),/espaço/);assert.equal(N.productionCount('M-204'),0);
  N.user={role:'Comprador'};assert.throws(()=>N.queueProductionPiece(id),/perfil/);
  N.user={role:'Administrador'};N.uid='other';assert.throws(()=>N.queueProductionPiece(id),/sessão/);
});
test('Falha ao persistir a demonstração mantém a peça na fila, sem total confirmado',async()=>{
  const {N}=client(),id=await N.createProductionSession('M-204','Disco cheio');
  const persist=N.persist;N.persist=()=>{throw new Error('Armazenamento cheio');};
  N.queueProductionPiece(id);await N.flushProduction();
  assert.equal(N.productionCount('M-204'),0);assert.equal(N.pendingProduction().length,1);
  N.persist=persist;await N.flushProduction();
  assert.equal(N.productionCount('M-204'),1);assert.equal(N.pendingProduction().length,0);
});
