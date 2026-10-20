import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/assets/js/motion.js',import.meta.url),'utf8');
function motion({systemReduced=true,saved=null,engine=true}={}){
  const data=new Map(saved?[['nexus-motion',saved]]:[]),hooks=new Map(),pending=[],classes=new Set();
  const root={dataset:{},classList:{add:name=>classes.add(name)}};
  const workspace={};
  const document={documentElement:root,querySelector:selector=>selector==='.workspace'?workspace:null,querySelectorAll:()=>[],addEventListener(){}};
  const media={matches:systemReduced,addEventListener(){}};
  const gsap={context:fn=>{fn();return {revert(){}};},set(){},to:(target,options)=>{const tween={kill:()=>options.onInterrupt?.()};pending.push(options);return tween;},fromTo:(target,from,options)=>{const tween={kill:()=>options.onInterrupt?.()};pending.push(options);return tween;}};
  class Swup{constructor(options){this.options=options;this.hooks={replace:(key,fn)=>hooks.set(key,fn),before:(key,fn)=>hooks.set(key,fn),on:(key,fn)=>hooks.set(key,fn)};}}
  const N={base:new URL('https://example.github.io/nexus/'),version:'4.1.1',route:'',boot:async()=>{},toggleMenu(){},closeModal(){}};
  const window={Nexus:N,gsap:engine?gsap:undefined,Swup,addEventListener(){}};
  const context=vm.createContext({window,document,matchMedia:()=>media,localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)},location:{protocol:'https:'},URL,Promise,console,gsap});
  vm.runInContext(source,context);return {N,root,data,media,pending,hooks,classes,workspace};
}
test('Movimento completo escolhido no site supera a preferência reduzida do dispositivo e persiste',()=>{
  const m=motion();assert.equal(m.root.dataset.motion,'reduced');assert.equal(m.root.dataset.systemMotion,'reduced');
  m.N.setMotionPreference('full');assert.equal(m.root.dataset.motion,'full');assert.equal(m.data.get('nexus-motion'),'full');
  const reload=motion({saved:m.data.get('nexus-motion')});assert.equal(reload.root.dataset.motion,'full');
});
test('Sistema e movimento reduzido continuam disponíveis sem forçar animações',()=>{
  const m=motion({systemReduced:false});assert.equal(m.root.dataset.motion,'full');
  m.N.setMotionPreference('reduced');assert.equal(m.root.dataset.motion,'reduced');
  m.N.setMotionPreference('system');assert.equal(m.root.dataset.motion,'full');
  m.media.matches=true;m.N.setMotionPreference('system');assert.equal(m.root.dataset.motion,'reduced');
  m.N.setMotionPreference('invalid');assert.equal(m.root.dataset.motion,'reduced');
});
test('Troca de página aguarda a animação GSAP em vez de substituir o conteúdo imediatamente',async()=>{
  const m=motion({saved:'full'});let completed=false;
  const navigation=m.N.transitionPage('out').then(()=>{completed=true;});await Promise.resolve();assert.equal(completed,false);
  assert.equal(m.pending.length,1);assert.ok(m.pending[0].duration>=.3);m.pending[0].onComplete();await navigation;assert.equal(completed,true);
  const entering=m.N.transitionPage('in');assert.ok(m.pending[1].duration>=.6);m.pending[1].onComplete();await entering;
});
test('Transição interrompida libera a navegação anterior; sem GSAP ou movimento, continua acessível',async()=>{
  const m=motion({saved:'full'});const first=m.N.transitionPage('out');const next=m.N.transitionPage('in');await first;m.pending[1].onComplete();await next;
  const reduced=motion();await reduced.N.transitionPage('out');assert.equal(reduced.pending.length,0);
  const fallback=motion({saved:'full',engine:false});await fallback.N.transitionPage('in');assert.equal(fallback.pending.length,0);
});
test('Swup controla saída e entrada com Promises e aguarda a tela pronta',async()=>{
  const m=motion({saved:'full'});m.N.initMotion();assert.equal(m.classes.has('swup-js-motion'),true);
  let ready=false,finish;m.N.boot=()=>new Promise(resolve=>{finish=()=>{ready=true;resolve();};});
  const loading=m.hooks.get('page:view')();assert.equal(ready,false);finish();await loading;assert.equal(ready,true);
  const leaving=m.hooks.get('animation:out:await')();assert.equal(m.pending.length,1);m.pending[0].onComplete();await leaving;
});
