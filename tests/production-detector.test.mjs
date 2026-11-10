import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context=vm.createContext({window:{Nexus:{}}});
vm.runInContext(fs.readFileSync(new URL('../public/assets/js/production-engine.js',import.meta.url),'utf8'),context);
const {PassageDetector}=context.window.Nexus;
function frame({shade=80,fraction=0}={}) {
  const data=new Uint8ClampedArray(80*60*4);
  for(let pixel=0;pixel<80*60;pixel++) {
    const value=pixel<Math.round(80*60*fraction)?shade:80;
    data.set([value,value,value,255],pixel*4);
  }
  return data;
}
const clear=frame(),piece=frame({shade:180,fraction:.25});
function calibrated(options={}) {
  const detector=new PassageDetector(options);
  for(let time=0;time<=1100;time+=100)assert.equal(detector.process(clear,time,80).count,false);
  return detector;
}

test('Padrão detecta peça de baixo contraste ocupando 3% da área',()=>{
  const detector=calibrated(),small=frame({shade:98,fraction:.03});
  assert.equal(detector.process(small,1200,80).count,false);
  assert.equal(detector.process(small,1234,80).count,true);
});

test('Conta 20 peças a 30 fps com apenas dois quadros livres entre elas',()=>{
  const detector=calibrated();let total=0,time=1200;
  for(let i=0;i<20;i++) {
    for(let n=0;n<3;n++,time+=1000/30)total+=Number(detector.process(piece,time,80).count);
    for(let n=0;n<2;n++,time+=1000/30)total+=Number(detector.process(clear,time,80).count);
  }
  assert.equal(total,20);
});

test('Objeto parado conta uma vez e um único quadro livre não rearma',()=>{
  const detector=calibrated();let total=0;
  for(let time=1200;time<4200;time+=34)total+=Number(detector.process(piece,time,80).count);
  total+=Number(detector.process(clear,4210,80).count);
  for(let time=4244;time<5244;time+=34)total+=Number(detector.process(piece,time,80).count);
  assert.equal(total,1);
});

test('Intervalo zero é aceito e não é substituído por 800 ms',()=>{
  const detector=calibrated({cooldownMs:0});
  assert.equal(detector.cooldownMs,0);
  let total=0,time=1200;
  for(let i=0;i<5;i++)for(const image of [piece,piece,clear,clear]) {
    total+=Number(detector.process(image,time,80).count);time+=25;
  }
  assert.equal(total,5);
});

test('Intervalo configurado suprime uma peça inteira sem contagem tardia',()=>{
  const detector=calibrated({cooldownMs:500});let total=0;
  for(const [time,image]of [[1200,piece],[1234,piece],[1268,clear],[1302,clear],[1336,piece],[1370,piece],[1800,piece],[1900,piece]]) {
    total+=Number(detector.process(image,time,80).count);
  }
  assert.equal(total,1);
  detector.process(clear,1934,80);detector.process(clear,1968,80);
  detector.process(piece,2002,80);
  assert.equal(detector.process(piece,2036,80).count,true);
});

test('Um quadro de interferência, poucos pixels e exposição uniforme não contam',()=>{
  const detector=calibrated();
  assert.equal(detector.process(piece,1200,80).count,false);
  assert.equal(detector.process(clear,1234,80).count,false);
  for(let time=1268;time<2268;time+=34)assert.equal(detector.process(frame({shade:255,fraction:.003}),time,80).count,false);
  for(let time=2300;time<3300;time+=34)assert.equal(detector.process(frame({shade:110,fraction:1}),time,110).count,false);
});

test('Calibração mantém pelo menos um segundo mesmo com 60 fps',()=>{
  const detector=new PassageDetector();
  for(let time=0;time<1000;time+=1000/60)assert.equal(detector.process(clear,time,80).state,'calibrating');
  assert.equal(detector.process(clear,1100,80).state,'ready');
});

test('Quadros repetidos ou fora de ordem não confirmam nem destroem uma passagem',()=>{
  const detector=calibrated();
  detector.process(piece,1200,80);
  assert.equal(detector.process(piece,1200,80).count,false);
  assert.equal(detector.process(piece,1190,80).count,false);
  assert.equal(detector.process(piece,1234,80).count,true);
  assert.equal(detector.process(piece,1234,80).count,false);
});

test('Interrupção longa exige novas confirmações de entrada e saída',()=>{
  const detector=calibrated();
  detector.process(piece,1200,80);
  assert.equal(detector.process(piece,3000,80).count,false);
  assert.equal(detector.process(piece,3034,80).count,true);
  detector.process(clear,3068,80);
  assert.equal(detector.process(clear,5000,80).state,'occupied');
  assert.equal(detector.process(clear,5034,80).state,'ready');
});
