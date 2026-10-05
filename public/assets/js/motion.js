(function(N){
  'use strict';
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  let twinModule,twinPromise,sceneGeneration=0;
  N.animateView=function(){
    if(reduced()||!window.gsap)return;
    const elements=document.querySelectorAll('#view-body .metric, #view-body .panel, #view-body .plan-card, #view-body .asset-card');
    try{gsap.from(elements,{y:14,opacity:0,duration:.55,stagger:.035,ease:'power3.out',clearProps:'opacity,transform'});}catch{}
  };
  const module=async()=>{if(twinModule)return twinModule;if(!twinPromise)twinPromise=import(new URL('public/assets/js/twin.js',N.base).href).then(m=>twinModule=m).catch(error=>{twinPromise=null;throw error;});return twinPromise;};
  N.initLanding=function(){
    this.registerPWA();const title=document.querySelector('.landing-wordmark');
    if(!reduced()&&window.gsap){
      try{gsap.from(title?.querySelectorAll('span')||[],{y:45,rotation:1.5,opacity:0,duration:.95,stagger:.045,ease:'power4.out',clearProps:'opacity,transform'});gsap.from('.hero-copy',{y:18,opacity:0,duration:.8,delay:.25,clearProps:'opacity,transform'});
        if(window.ScrollTrigger){gsap.registerPlugin(ScrollTrigger);document.querySelectorAll('.module-row,.principles article').forEach(el=>gsap.from(el,{y:25,opacity:0,duration:.6,clearProps:'opacity,transform',scrollTrigger:{trigger:el,start:'top 93%',once:true}}));}
      }catch{}
    }
    const container=document.querySelector('#hero-motor');if(container&&location.protocol!=='file:'){
      const generation=++sceneGeneration;module().then(m=>{if(generation!==sceneGeneration||!container.isConnected)return;const scene=m.createMotor(container,{reduced:reduced()});this.heroDispose=()=>{sceneGeneration++;scene.dispose();};}).catch(()=>{document.querySelector('.schematic-fallback')?.removeAttribute('hidden');});
    }
  };
  N.startTwin=async function(){
    const container=document.querySelector('#factory-twin');if(!container||container.dataset.started)return;container.dataset.started='true';const generation=++sceneGeneration;
    try{const mod=await module();if(generation!==sceneGeneration||!container.isConnected)return;const scene=mod.createFactory(container,this.entries('assets'),id=>this.selectTwin(id));document.querySelector('#twin-fallback')?.setAttribute('hidden','');this.factoryScene=scene;this.twinDispose=()=>{sceneGeneration++;scene.dispose();this.factoryScene=null;this.twinDispose=null;};this.twinReset=()=>scene.reset();this.twinUpdate=()=>{scene.update(this.entries('assets'));if(this.selectedTwin)this.selectTwin(this.selectedTwin);};}catch(error){console.info('Mapa 3D indisponível; mapa em lista ativo.',error.message);}
  };
  N.selectTwin=function(id){
    const a=this.data.assets?.[id];if(!a)return;this.selectedTwin=id;this.factoryScene?.select(id);
    const target=document.querySelector('#twin-selection');if(!target)return;
    target.innerHTML='<div class="spaced" style="margin-bottom:18px"><span class="chip">'+this.escape(a.tag||id)+'</span>'+this.badge(a.status)+'</div><h3>'+this.escape(a.name)+'</h3><p class="tagline">'+this.escape(a.area)+'</p><div class="spec-list" style="margin:22px 0"><div><span class="tagline">Temperatura cadastrada</span><p class="mono">'+this.number(a.temp,1)+' °C</p></div><div><span class="tagline">Criticidade</span><p class="mono">'+this.escape(a.criticality||'—')+'</p></div></div><a class="btn btn-primary" data-swup href="'+this.href('ativo-detalhes','?id='+encodeURIComponent(id))+'">Abrir ficha técnica</a>';
  };
  N.initMotion=function(){
    if(window.Swup&&location.protocol!=='file:'){try{const SwupClass=window.Swup.default||window.Swup;this.swup=new SwupClass({containers:['#swup'],linkSelector:'a[data-swup]',animationSelector:reduced()?false:'[class*="transition-"]',cache:false});this.swup.hooks.on('content:replace',()=>{this.twinDispose?.();this.heroDispose?.();this.toggleMenu(false);this.closeModal(false);window.ScrollTrigger?.getAll().forEach(t=>t.kill());});this.swup.hooks.on('page:view',()=>this.boot());this.swup.hooks.on('fetch:error',visit=>{location.assign(visit.to.url);});}catch(error){console.info('Navegação por páginas ativa.',error.message);}}
  };
})(window.Nexus);
