/* Abertura em GSAP, no padrão do vídeo de referência (mrpops.ua):
   1. tela lisa por um instante;
   2. um anel trançado (duas fitas senoidais) se desenha a partir do topo, em sentido horário;
   3. a logo N antiga (nexus-logo.png) cresce de baixo para cima em dois tempos dentro do anel;
   4. pausa curta e a cortina sobe com a borda inferior em arco, revelando a página.
   Toca uma vez por sessão; "reduzir movimento" mostra a logo pronta por um instante. */
(function(){
  'use strict';
  const html=document.documentElement;
  const intro=document.getElementById('intro');
  if(!intro||!html.classList.contains('intro-on')){intro?.remove();return;}
  try{sessionStorage.setItem('nexus-intro','1');}catch{}
  const q=s=>intro.querySelector(s),qa=s=>[...intro.querySelectorAll(s)];
  const ropes=qa('.intro-rope'),logo=q('.intro-logo'),rise=q('.intro-rise-rect'),stage=q('.intro-stage'),skip=q('[data-intro-skip]');
  // Área revelada da logo (coordenadas do SVG 1080): base em 700, meio em 545, topo em 360.
  const BASE=700,MID=545,TOP=360;

  let finished=false,tl;
  const finish=()=>{
    if(finished)return;finished=true;
    window.gsap?.ticker.lagSmoothing(500,33);
    html.classList.remove('intro-on','intro-reduced');intro.remove();
    document.removeEventListener('keydown',onKey);
    document.dispatchEvent(new CustomEvent('nexus:intro-done'));
  };
  const onKey=event=>{if(event.key==='Escape'){tl?tl.progress(1):finish();}};
  document.addEventListener('keydown',onKey);
  skip?.addEventListener('click',()=>{tl?tl.progress(1):finish();});

  const reduced=html.classList.contains('intro-reduced');
  if(reduced||!window.gsap){
    ropes.forEach(r=>{r.style.opacity='1';});
    rise.setAttribute('y',TOP);rise.setAttribute('height',BASE-TOP);logo.style.opacity='1';
    setTimeout(finish,reduced?120:180);return;
  }

  const g=window.gsap;
  ropes.forEach(r=>{const len=Math.ceil(r.getTotalLength())+2;g.set(r,{opacity:1,strokeDasharray:len,strokeDashoffset:len});});
  g.set(logo,{opacity:1});

  // Criada pausada: só começa quando o carregamento pesado terminou (senão o main thread travado congela o início).
  tl=g.timeline({paused:true});
  // 2. anel trançado desenhado a partir do topo
  tl.to(ropes,{strokeDashoffset:0,duration:1.3,ease:'power1.inOut'},.3)
  // 3. logo cresce de baixo para cima: primeiro a base, depois se completa até o topo
    .fromTo(rise,{attr:{y:BASE,height:0}},{attr:{y:MID,height:BASE-MID},duration:.4,ease:'power3.out',immediateRender:false},1.55)
    .to(rise,{attr:{y:TOP,height:BASE-TOP},duration:.5,ease:'power3.inOut'},2.1)
    .fromTo(logo,{scale:.94,transformOrigin:'50% 100%'},{scale:1,duration:1.05,ease:'power3.out',immediateRender:false},1.55)
  // 4. pausa e a cortina sobe em arco revelando a página
    .to(stage,{y:'-10vh',duration:.9,ease:'power3.in'},3.05)
    .set(intro,{borderBottom:'3px solid #d6e3ff'},3.1)
    .fromTo(intro,{yPercent:0,borderBottomLeftRadius:'0% 0vh',borderBottomRightRadius:'0% 0vh'},
      {yPercent:-100,borderBottomLeftRadius:'50% 22vh',borderBottomRightRadius:'50% 22vh',duration:1,ease:'power4.inOut',immediateRender:false},3.1)
    .call(()=>{html.classList.remove('intro-on');intro.style.display='none';},null,4.1);
  const page=document.querySelector('#swup');
  if(page){
    tl.fromTo(page,{scale:1.06,transformOrigin:'50% 0%'},{scale:1,duration:1.3,ease:'power3.out',clearProps:'transform',immediateRender:false},3.25);
    const words=page.querySelectorAll('.landing-wordmark span'),copy=page.querySelectorAll('.hero-copy > :not(.landing-wordmark)'),labels=page.querySelectorAll('.hero-carousel-footer');
    if(words.length)tl.fromTo(words,{yPercent:105,opacity:0},{yPercent:0,opacity:1,duration:1,stagger:.06,ease:'expo.out',clearProps:'transform,opacity'},3.45);
    if(copy.length)tl.fromTo(copy,{y:32,opacity:0},{y:0,opacity:1,duration:.85,stagger:.1,ease:'power3.out',clearProps:'transform,opacity'},3.55);
    if(labels.length)tl.fromTo(labels,{y:12,opacity:0},{y:0,opacity:1,duration:.7,stagger:.12,clearProps:'transform,opacity'},3.7);
  }
  tl.eventCallback('onComplete',finish);

  let started=false;
  const begin=()=>{
    if(started||finished)return;started=true;
    if(!html.classList.contains('intro-on')){tl.progress(1);finish();return;}
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(finished)return;
      // Sem "lag smoothing": em máquina lenta a abertura segue o relógio real (pode pular quadros) em vez de parecer parada.
      g.ticker.lagSmoothing(0);
      tl.timeScale(2.4).play(0);
      // Aba em segundo plano pausa o requestAnimationFrame: a página nunca fica escondida.
      setTimeout(()=>{if(!finished)tl.progress(1);},8000);
    }));
  };
  if(document.readyState==='complete')begin();
  else{window.addEventListener('load',begin,{once:true});setTimeout(begin,3500);}
})();
