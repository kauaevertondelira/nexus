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
    sceneGeneration++;this.twinDispose?.();
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
      if(direction==='out')transitionTween=gsap.to(target,{opacity:0,y:-6,duration:.16,ease:'power2.out',onComplete:complete,onInterrupt:complete});
      else transitionTween=gsap.fromTo(target,{opacity:0,y:10},{opacity:1,y:0,duration:.28,ease:'power3.out',clearProps:'opacity,transform',onComplete:complete,onInterrupt:complete});
    });
  };
  N.startLandingCarousel=function(){
    const carousel=document.querySelector('[data-hero-carousel]');if(!carousel)return;
    const slides=[...carousel.querySelectorAll('[data-hero-slide]')],dots=[...carousel.querySelectorAll('[data-hero-dot]')];
    const credit=carousel.querySelector('[data-hero-credit]');
    const caption=carousel.querySelector('[data-hero-caption]'),count=carousel.querySelector('[data-hero-count]'),pause=carousel.querySelector('[data-hero-pause]'),status=carousel.querySelector('[data-hero-status]');
    const interval=7500;let index=Math.max(0,slides.findIndex(slide=>slide.classList.contains('is-active'))),timer=0,visible=true,focused=false,paused=false,disposed=false,request=0;
    const load=async slide=>{
      const img=slide.querySelector('img');if(!img)return;
      if(img.dataset.src){img.sizes='100vw';img.srcset=img.dataset.srcset||'';img.src=img.dataset.src;delete img.dataset.src;}
      if(img.decode)await img.decode();
    };
    const canPlay=()=>!disposed&&!paused&&!focused&&visible&&!document.hidden&&!reduced();
    const schedule=()=>{clearTimeout(timer);if(canPlay())timer=setTimeout(()=>show(index+1),interval);};
    const show=async(next,manual=false)=>{
      const id=++request;next=(next+slides.length)%slides.length;
      try{await load(slides[next]);}catch{if(!disposed&&id===request){if(manual)status.textContent='Não foi possível carregar esta imagem. Tente a próxima.';schedule();}return;}
      if(disposed||id!==request)return;
      index=next;
      slides.forEach((slide,i)=>slide.classList.toggle('is-active',i===index));
      dots.forEach((dot,i)=>{dot.setAttribute('aria-pressed',String(i===index));});
      caption.textContent=slides[index].dataset.caption;if(credit){credit.textContent=slides[index].dataset.credit;credit.href=slides[index].dataset.source;}count.textContent=String(index+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');
      if(manual)status.textContent='Imagem '+(index+1)+' de '+slides.length+': '+caption.textContent;
      schedule();
    };
    const updatePause=()=>{pause.hidden=reduced();pause.setAttribute('aria-pressed',String(paused));pause.setAttribute('aria-label',paused?'Retomar carrossel':'Pausar carrossel');pause.querySelector('[data-pause-icon]').innerHTML=paused?'<path d="m9 5 11 7-11 7Z"/>':'<path d="M9 5v14M15 5v14"/>';};
    const click=event=>{
      const dot=event.target.closest('[data-hero-dot]');if(dot){void show(Number(dot.dataset.heroDot),true);return;}
      if(event.target.closest('[data-hero-prev]'))void show(index-1,true);
      if(event.target.closest('[data-hero-next]'))void show(index+1,true);
      if(event.target.closest('[data-hero-pause]')){paused=!paused;updatePause();schedule();}
    };
    const focusIn=()=>{focused=true;schedule();},focusOut=event=>{focused=carousel.contains(event.relatedTarget);schedule();};
    const keys=event=>{if(!event.target.closest('.hero-carousel-controls'))return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();void show(index+(event.key==='ArrowRight'?1:-1),true);}};
    carousel.addEventListener('click',click);carousel.addEventListener('keydown',keys);carousel.addEventListener('focusin',focusIn);carousel.addEventListener('focusout',focusOut);document.addEventListener('visibilitychange',schedule);
    const observer=window.IntersectionObserver?new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.1}):null;observer?.observe(carousel);
    updatePause();schedule();
    track(()=>{disposed=true;request++;clearTimeout(timer);observer?.disconnect();carousel.removeEventListener('click',click);carousel.removeEventListener('keydown',keys);carousel.removeEventListener('focusin',focusIn);carousel.removeEventListener('focusout',focusOut);document.removeEventListener('visibilitychange',schedule);});
  };
  N.startSmoothScroll=function(){
    if(reduced()||!window.Lenis||!window.gsap||navigator.connection?.saveData)return;
    const lenis=new Lenis({duration:1.05,smoothWheel:true,syncTouch:false,anchors:true});
    const tick=time=>lenis.raf(time*1000),onScroll=()=>window.ScrollTrigger?.update();
    const onVisibility=()=>document.hidden?lenis.stop():lenis.start();
    lenis.on('scroll',onScroll);gsap.ticker.add(tick);document.addEventListener('visibilitychange',onVisibility);
    // Abertura e navegação compartilham o mesmo ciclo de vida; telas de trabalho usam rolagem nativa.
    track(()=>{gsap.ticker.remove(tick);document.removeEventListener('visibilitychange',onVisibility);lenis.destroy();});
  };
  // Carrossel do painel do login: 3 fotos e 3 textos por aba, 20 s cada, em loop; troca de aba recomeça na primeira.
  N.startAuthCarousel=function(){
    const panel=document.querySelector('.auth-brand-panel');if(!panel||panel.dataset.carousel)return;panel.dataset.carousel='on';
    const DUR=20000,COUNT=3,dots=[...panel.querySelectorAll('[data-dot]')],pauseBtn=panel.querySelector('[data-auth-pause]');
    let mode=panel.dataset.mode||'login',idx=0,timer=0,startedAt=0,remaining=DUR,paused=false;
    panel.style.setProperty('--slide-dur',DUR+'ms');
    const show=()=>{
      panel.dataset.mode=mode;panel.dataset.slide=String(idx);
      panel.querySelectorAll('.auth-photo').forEach(p=>p.classList.toggle('is-active',p.dataset.set===mode&&Number(p.dataset.slide)===idx));
      panel.querySelectorAll('[data-copy]').forEach(el=>{el.hidden=!(el.dataset.copy===mode&&Number(el.dataset.slide)===idx);});
      dots.forEach((d,i)=>{d.classList.remove('is-active');d.classList.toggle('is-done',i<idx);d.removeAttribute('aria-current');});
      void panel.offsetWidth; // reinicia a barra de progresso
      dots[idx]?.classList.add('is-active');dots[idx]?.setAttribute('aria-current','true');
    };
    let visible=true,focused=false;
    const schedule=ms=>{clearTimeout(timer);remaining=ms;if(paused||reduced()||document.hidden||!visible||focused)return;startedAt=Date.now();timer=setTimeout(()=>{idx=(idx+1)%COUNT;show();schedule(DUR);},ms);};
    const setPaused=value=>{
      if(value===paused)return;paused=value;panel.classList.toggle('is-paused',paused);
      if(paused){clearTimeout(timer);remaining=Math.max(0,remaining-(Date.now()-startedAt));}else schedule(remaining);
      if(pauseBtn){pauseBtn.textContent=paused?'▶':'❚❚';pauseBtn.setAttribute('aria-pressed',String(paused));pauseBtn.setAttribute('aria-label',paused?'Retomar troca de imagens':'Pausar troca de imagens');}
    };
    const onClick=event=>{
      const dot=event.target.closest('[data-dot]');if(dot){idx=Number(dot.dataset.dot);show();schedule(DUR);return;}
      if(event.target.closest('[data-auth-pause]'))setPaused(!paused);
    };
    const onVisibility=()=>schedule(DUR),onFocus=()=>{focused=true;schedule(DUR);},onBlur=event=>{focused=panel.contains(event.relatedTarget);schedule(DUR);};
    const observer=window.IntersectionObserver?new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule(DUR);}):null;observer?.observe(panel);
    if(pauseBtn)pauseBtn.hidden=reduced();
    panel.addEventListener('click',onClick);panel.addEventListener('focusin',onFocus);panel.addEventListener('focusout',onBlur);document.addEventListener('visibilitychange',onVisibility);
    N.authSetMode=m=>{if(m===mode)return;mode=m;idx=0;show();schedule(DUR);};
    show();schedule(DUR);
    track(()=>{clearTimeout(timer);observer?.disconnect();panel.removeEventListener('click',onClick);panel.removeEventListener('focusin',onFocus);panel.removeEventListener('focusout',onBlur);document.removeEventListener('visibilitychange',onVisibility);delete panel.dataset.carousel;N.authSetMode=null;});
  };
  N.animateAuth=function(){
    this.startAuthCarousel();
    syncPreference();if(reduced()||!window.gsap)return;
    viewContext=gsap.context(()=>{gsap.from('.auth-copy, .auth-form > *',{y:12,opacity:0,duration:.4,stagger:.035,ease:'power3.out',clearProps:'opacity,transform'});});
  };
  N.animateView=function(){
    viewContext?.revert();viewContext=null;
    syncPreference();if(reduced()||!window.gsap)return;
    viewContext=gsap.context(()=>{
      const elements=[...document.querySelectorAll('#view-body .page-heading, #view-body .toolbar, #view-body .metric, #view-body .panel, #view-body .plan-card, #view-body .asset-card, #view-body .sensor-card')].filter(el=>!el.parentElement.closest('.panel,.plan-card,.asset-card')).slice(0,18);
      if(elements.length)gsap.from(elements,{y:10,opacity:0,duration:.3,stagger:.02,ease:'power3.out',clearProps:'opacity,transform'});
    });
  };
  N.initLanding=function(){
    syncPreference();this.registerPWA();const root=document.querySelector('#swup');if(!root)return;
    this.startLandingCarousel();this.startSmoothScroll();
    const introPlaying=document.documentElement.classList.contains('intro-on');
    if(reduced())return;
    if(window.gsap){
      landingContext=gsap.context(()=>{
        if(!introPlaying)gsap.from('.hero-copy > *',{y:16,opacity:0,duration:.6,stagger:.07,ease:'power3.out',clearProps:'opacity,transform'});
        if(window.ScrollTrigger){
          gsap.registerPlugin(ScrollTrigger);
          root.querySelectorAll('.section-intro, .module-row, .principles article, .landing-end > *').forEach(el=>gsap.from(el,{y:18,opacity:0,duration:.45,ease:'power3.out',clearProps:'opacity,transform',scrollTrigger:{trigger:el,start:'top 97%',once:true}}));
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
      const hover=(event,enter)=>{
        if(event.pointerType==='touch')return;
        const row=event.target.closest('.module-row');if(!row||!root.contains(row)||row.contains(event.relatedTarget))return;
        const icon=row.querySelector('.icon');if(!icon)return;
        active.get(icon)?.stop();active.set(icon,Motion.animate(icon,{rotate:enter?90:0},{type:'spring',stiffness:280,damping:28}));
      };
      const enter=event=>hover(event,true),leave=event=>hover(event,false);
      root.addEventListener('pointerover',enter);root.addEventListener('pointerout',leave);
      track(()=>{root.removeEventListener('pointerover',enter);root.removeEventListener('pointerout',leave);active.forEach(animation=>animation.cancel());});
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
    document.addEventListener('pointerdown',event=>{const button=event.target.closest('.btn,.icon-btn');if(button&&!button.disabled&&!reduced()&&window.Motion?.animate)Motion.animate(button,{scale:[1,.98,1]},{duration:.18,ease:'easeOut'});});
    window.addEventListener('pagehide',()=>this.cleanupMotion());
    window.addEventListener('pageshow',event=>{if(event.persisted)this.boot();});
    if(window.Swup&&location.protocol!=='file:'){
      try{
        const SwupClass=window.Swup.default||window.Swup;
        this.swup=new SwupClass({containers:['#swup'],linkSelector:'a[data-swup]',animationSelector:false,animateHistoryBrowsing:true,cache:false});
        document.documentElement.classList.add('swup-js-motion');
        this.swup.hooks.replace('animation:out:await',()=>this.transitionPage('out'));
        this.swup.hooks.replace('animation:in:await',()=>this.transitionPage('in'));
        this.swup.hooks.before('content:replace',()=>{this.cleanupMotion();this.hideSidebarTooltip?.();this.toggleMenu(false);this.closeModal(false);});
        this.swup.hooks.on('page:view',async()=>{await this.boot();const heading=document.querySelector('.workspace h1, .auth-form h1, #hero-title');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}});
        this.swup.hooks.on('visit:abort',()=>{transitionTween?.kill();transitionTween=null;window.gsap?.set(document.querySelector('.workspace')||'#swup',{clearProps:'opacity,transform'});});
        this.swup.hooks.on('fetch:error',visit=>{location.assign(visit.to.url);});
      }catch(error){console.info('Navegação por páginas ativa.',error.message);}
    }
  };
})(window.Nexus);
