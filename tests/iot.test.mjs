import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),key:index=>[...values.keys()][index]??null,get length(){return values.size;}};}
function client(){
  const document={currentScript:{src:'https://example.com/nexus/public/assets/js/core.js'},addEventListener(){},dispatchEvent(){},querySelector(){return null;}};
  const context=vm.createContext({document,window:{addEventListener(){}},navigator:{onLine:true},location:{search:'',protocol:'https:'},URL,URLSearchParams,Intl,crypto:webcrypto,localStorage:storage(),sessionStorage:storage(),CustomEvent:class{},console,setTimeout,clearTimeout,setInterval,clearInterval});
  for(const file of ['core','data','ui','profile','production-engine','production-data','production','iot','views'])vm.runInContext(fs.readFileSync(new URL('../public/assets/js/'+file+'.js',import.meta.url),'utf8'),context);
  const N=context.window.Nexus;N.data=N.seed();N.user=N.data.users.demo;N.mode='demo';N.uid='demo';N.testNavigate=search=>{context.location.search=search;};return N;
}
const config={active:true,tempWarning:70,tempCritical:85,vibrationWarning:4.5,vibrationCritical:7.1};
test('Campos ausentes não viram zero e zero medido permanece zero',()=>{
  const N=client();assert.equal(N.sensorValue(undefined),'—');assert.equal(N.sensorValue(null),'—');assert.equal(N.sensorValue(NaN),'—');assert.equal(N.sensorValue(0,0),'0');
});
test('Horário da medição mantém leitura antiga mesmo após nova sincronização',()=>{
  const N=client(),now=Date.now();
  assert.equal(N.sensorState(config,{temperature:42,measuredAt:now-600000,receivedAt:now},now).label,'Leitura antiga');
  assert.equal(N.sensorState(config,undefined,now).label,'Aguardando dados');
  assert.equal(N.sensorState(config,{temperature:90,measuredAt:now},now).status,'critical');
  assert.equal(N.sensorState(config,{vibration:5,measuredAt:now},now).status,'warning');
  assert.equal(N.sensorState({...config,active:false},{temperature:90,measuredAt:now},now).label,'Inativo');
});
test('Filtro por máquina limita sensores e lotes; dados de texto são escapados',()=>{
  const N=client(),now=Date.now();N.data.assets={a:{name:'Máquina A'},b:{name:'Máquina B'}};
  N.data.iot_device_config={A:{...config,assetId:'a',label:'Sensor A'},B:{...config,assetId:'b',label:'Sensor B'}};
  N.data.telemetry={latest:{A:{assetId:'a',temperature:42.8,measuredAt:now},B:{assetId:'b',temperature:67.7,measuredAt:now}},firestoreProduction:{a:{assetId:'a',orderCode:'OP-A',product:'<script>alert(1)</script>',producedPieces:7,targetPieces:20},b:{assetId:'b',orderCode:'OP-B',producedPieces:10,targetPieces:40}}};
  N.iotAssetId='a';const html=N.iotView();assert.ok(html.includes('data-sensor-id="A"'));assert.ok(!html.includes('data-sensor-id="B"'));assert.ok(!html.includes('data-python-asset="b"'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!html.includes('<script>alert(1)</script>'));
  N.testNavigate('?asset=b');const next=N.iotView();assert.ok(next.includes('data-sensor-id="B"'));assert.ok(!next.includes('data-sensor-id="A"'));
});
test('Contagem do Python não é somada aos eventos imutáveis da câmera',()=>{
  const N=client();N.data.production_totals={'M-204':{count:99}};N.data.telemetry={firestoreProduction:{'M-204':{assetId:'M-204',orderCode:'OP-PY',producedPieces:7,targetPieces:100}}};
  assert.equal(N.productionCount('M-204'),99);assert.ok(N.pythonProductionPanel('M-204').includes('OP-PY'));assert.equal(N.productionCount('M-204'),99);
});
