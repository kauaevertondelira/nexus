(function(N){
  'use strict';
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  let motionPreference='system';try{const saved=localStorage.getItem('nexus-motion');if(['full','reduced','system'].includes(saved))motionPreference=saved;}catch{}
  const reduced=()=>motionPreference==='reduced'||(motionPreference==='system'&&preference.matches);
  let twinModule,twinPromise,sceneGeneration=0,landingContext,viewContext,transitionTween;
  const syncPreference=()=>{
    N.motionPreference=motionPreference;document.documentElement.dataset.motion=reduced()?'reduced':'full';document.documentElement.dataset.systemMotion=preference.matches?'reduced':'full';
    document.querySelectorAll('[data-action="motion-toggle"]').forEach(button=>{button.textContent=reduced()?'Ativar animações':'Reduzir movimento';button.setAttribute('aria-pressed',String(!reduced()));});
    const select=document.querySelector('#motion-preference');if(select)select.value=motionPreference;
  };
  syncPreference();
  let disposers=[];
  const track=dispose=>{disposers.push(dispose);};
  const module=async()=>{if(twinModule)return twinModule;if(!twinPromise)twinPromise=import(new URL('public/assets/js/twin.js?v='+N.version,N.base).href).then(m=>twinModule=m).catch(error=>{twinPromise=null;throw error;});return twinPromise;};
  N.cleanupMotion=function(){
    sceneGeneration++;this.twinDispose?.();this.heroDispose?.();this.heroDispose=null;
    landingContext?.revert();landingContext=null;viewContext?.revert();viewContext=null;
    disposers.forEach(dispose=>dispose());disposers=[];
  };
  N.setMotionPreference=function(value){
    if(!['full','reduced','system'].includes(value))return;
    motionPreference=value;try{localStorage.setItem('nexus-motion',value);}catch{}
    syncPreference();this.cleanupMotion();
    if(this.route==='index')this.initLanding();else if(this.route==='login')this.animateAuth();else if(this.route==='mapa'){document.querySelector('#factory-twin')?.removeAttribute('data-started');this.startTwin();}else this.animateView();
  };
  N.transitionPage=function(direction){
    transitionTween?.kill();
    const target=document.querySelector('.workspace')||document.querySelector('#swup');
    if(!target||reduced()||!window.gsap)return Promise.resolve();
    return new Promise(resolve=>{
      const complete=()=>{transitionTween=null;resolve();};
      if(direction==='out')transitionTween=gsap.to(target,{opacity:0,y:-22,duration:.32,ease:'power2.in',onComplete:complete,onInterrupt:complete});
      else transitionTween=gsap.fromTo(target,{opacity:0,y:34},{opacity:1,y:0,duration:.65,ease:'power3.out',clearProps:'opacity,transform',onComplete:complete,onInterrupt:complete});
    });
  };
  N.animateAuth=function(){
    syncPreference();if(reduced()||!window.gsap)return;
    viewContext=gsap.context(()=>{gsap.from('.auth-brand-panel > *, .auth-form > *',{y:30,opacity:0,duration:.8,stagger:.065,ease:'power3.out',clearProps:'opacity,transform'});});
  };
  N.animateView=function(){
    viewContext?.revert();viewContext=null;
    syncPreference();if(reduced()||!window.gsap)return;
    viewContext=gsap.context(()=>{
      const elements=[...document.querySelectorAll('#view-body .page-heading, #view-body .toolbar, #view-body .metric, #view-body .panel, #view-body .plan-card, #view-body .asset-card, #view-body .sensor-card')].filter(el=>!el.parentElement.closest('.panel,.plan-card,.asset-card')).slice(0,18);
      if(elements.length)gsap.from(elements,{y:38,opacity:0,duration:.8,stagger:.065,ease:'power3.out',clearProps:'opacity,transform'});
      const rows=[...document.querySelectorAll('#view-body tbody tr')].slice(0,12);if(rows.length)gsap.from(rows,{opacity:0,x:18,duration:.55,delay:.15,stagger:.035,clearProps:'opacity,transform'});
    });
  };
  N.initLanding=function(){
    syncPreference();this.registerPWA();const root=document.querySelector('#swup');if(!root)return;
    const container=root.querySelector('#hero-motor');
    if(!reduced()){
      if(window.anime?.animate){
        const title=anime.animate(root.querySelectorAll('.landing-wordmark span'),{translateY:['105%',0],rotate:[6,0],opacity:[0,1],duration:1100,delay:anime.stagger(75),ease:'outExpo'});
        track(()=>title.revert());
      }
      if(window.gsap){
        landingContext=gsap.context(()=>{
          gsap.from('.hero-copy > *',{y:32,opacity:0,duration:.9,delay:.18,stagger:.12,ease:'power3.out',clearProps:'opacity,transform'});
          gsap.from('.stage-label',{y:12,opacity:0,duration:.8,delay:.5,stagger:.15,clearProps:'opacity,transform'});
          if(window.ScrollTrigger){
            gsap.registerPlugin(ScrollTrigger);
            root.querySelectorAll('.section-intro, .module-row, .principles article, .landing-end > *').forEach(el=>gsap.from(el,{y:38,opacity:0,duration:.75,ease:'power3.out',clearProps:'opacity,transform',scrollTrigger:{trigger:el,start:'top 94%',once:true}}));
            gsap.from('.landing-strip span',{y:16,opacity:0,stagger:.1,duration:.6,clearProps:'opacity,transform',scrollTrigger:{trigger:'.landing-strip',start:'top 96%',once:true}});
            if(container)gsap.to(container,{y:30,ease:'none',scrollTrigger:{trigger:'.landing-hero',start:'top bottom',end:'bottom top',scrub:1}});
          }
        },root);
        document.fonts?.ready.then(()=>{if(root.isConnected)window.ScrollTrigger?.refresh();});
      }
      if(window.Motion?.scroll){
        const progress=root.querySelector('.landing-progress');
        if(progress)track(Motion.scroll(value=>{progress.style.transform='scaleX('+value+')';}));
      }
      if(window.Motion?.animate){
        const active=new Map();
        const setHover=(event,enter)=>{
          const row=event.target.closest('.module-row');if(!row||!root.contains(row)||row.contains(event.relatedTarget))return;
          const icon=row.querySelector('.icon');if(!icon)return;
          active.get(icon)?.stop();active.set(icon,Motion.animate(icon,{rotate:enter?90:0,scale:enter?1.15:1},{type:'spring',stiffness:250,damping:22}));
        };
        const enter=event=>setHover(event,true),leave=event=>setHover(event,false);
        root.addEventListener('pointerover',enter);root.addEventListener('pointerout',leave);root.addEventListener('focusin',enter);root.addEventListener('focusout',leave);
        track(()=>{root.removeEventListener('pointerover',enter);root.removeEventListener('pointerout',leave);root.removeEventListener('focusin',enter);root.removeEventListener('focusout',leave);active.forEach(animation=>animation.cancel());});
      }
    }
    if(container&&location.protocol!=='file:'){
      const generation=++sceneGeneration;
      module().then(m=>{
        if(generation!==sceneGeneration||!container.isConnected)return;
        const scene=m.createMotor(container,{reduced:reduced()});this.heroDispose=()=>{scene.dispose();};
        if(!reduced()&&window.ScrollTrigger){const trigger=ScrollTrigger.create({trigger:container,start:'top bottom',end:'bottom top',onUpdate:self=>scene.setProgress(self.progress)});track(()=>trigger.kill());}
      }).catch(error=>{if(container.isConnected)container.querySelector('.schematic-fallback')?.removeAttribute('hidden');console.info('Ilustração estática do motor ativa.',error.message);});
    }
  };
  N.startTwin=async function(){
    const container=document.querySelector('#factory-twin');if(!container||container.dataset.started)return;container.dataset.started='true';const generation=++sceneGeneration;
    try{const mod=await module();if(generation!==sceneGeneration||!container.isConnected)return;const scene=mod.createFactory(container,this.entries('assets'),id=>this.selectTwin(id));document.querySelector('#twin-fallback')?.setAttribute('hidden','');this.factoryScene=scene;this.twinDispose=()=>{sceneGeneration++;scene.dispose();this.factoryScene=null;this.twinDispose=null;};this.twinReset=()=>scene.reset();this.twinUpdate=()=>{scene.update(this.entries('assets'));if(this.selectedTwin)this.selectTwin(this.selectedTwin);};}catch(error){delete container.dataset.started;console.info('Mapa 3D indisponível; mapa em lista ativo.',error.message);}
  };
  N.selectTwin=function(id){
    const a=this.data.assets?.[id];if(!a)return;this.selectedTwin=id;this.factoryScene?.select(id);
    const target=document.querySelector('#twin-selection');if(!target)return;
    target.innerHTML='<div class="spaced" style="margin-bottom:18px"><span class="chip">'+this.escape(a.tag||id)+'</span>'+this.badge(a.status)+'</div><h3>'+this.escape(a.name)+'</h3><p class="tagline">'+this.escape(a.area)+'</p><div class="spec-list" style="margin:22px 0"><div><span class="tagline">Temperatura cadastrada</span><p class="mono">'+this.number(a.temp,1)+' °C</p></div><div><span class="tagline">Criticidade</span><p class="mono">'+this.escape(a.criticality||'—')+'</p></div></div><a class="btn btn-primary" data-swup href="'+this.href('ativo-detalhes','?id='+encodeURIComponent(id))+'">Abrir ficha técnica</a>';
  };
  N.initMotion=function(){
    preference.addEventListener('change',()=>this.setMotionPreference(motionPreference));
    document.addEventListener('pointerdown',event=>{const button=event.target.closest('.btn,.icon-btn');if(button&&!button.disabled&&!reduced()&&window.Motion?.animate)Motion.animate(button,{scale:[1,.94,1]},{duration:.32,ease:'easeOut'});});
    window.addEventListener('pagehide',()=>this.cleanupMotion());
    window.addEventListener('pageshow',event=>{if(event.persisted)this.boot();});
    if(window.Swup&&location.protocol!=='file:'){
      try{
        const SwupClass=window.Swup.default||window.Swup;
        this.swup=new SwupClass({containers:['#swup'],linkSelector:'a[data-swup]',animationSelector:false,animateHistoryBrowsing:true,cache:false});
        document.documentElement.classList.add('swup-js-motion');
        this.swup.hooks.replace('animation:out:await',()=>this.transitionPage('out'));
        this.swup.hooks.replace('animation:in:await',()=>this.transitionPage('in'));
        this.swup.hooks.before('content:replace',()=>{this.cleanupMotion();this.toggleMenu(false);this.closeModal(false);});
        this.swup.hooks.on('page:view',()=>this.boot());
        this.swup.hooks.on('visit:abort',()=>{transitionTween?.kill();transitionTween=null;window.gsap?.set(document.querySelector('.workspace')||'#swup',{clearProps:'opacity,transform'});});
        this.swup.hooks.on('fetch:error',visit=>{location.assign(visit.to.url);});
      }catch(error){console.info('Navegação por páginas ativa.',error.message);}
    }
  };
})(window.Nexus);
