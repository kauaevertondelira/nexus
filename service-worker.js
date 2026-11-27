/* Cache exclusivo da interface. Dados Firebase e credenciais não entram aqui. */
const CACHE_PREFIX='nexus-static-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=CACHE_PREFIX+'4.5.1';
const SHELL=[
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./public/assets/css/nexus.css?v=4.5.1",
  "./public/assets/vendor/motion/motion.js?v=4.5.1",
  "./public/assets/vendor/gsap/gsap.min.js?v=4.5.1",
  "./public/assets/vendor/gsap/ScrollTrigger.min.js?v=4.5.1",
  "./public/assets/vendor/swup/Swup.umd.js?v=4.5.1",
  "./public/assets/vendor/qrcode/qrcode.min.js?v=4.5.1",
  "./public/assets/js/firebase-config.js?v=4.5.1",
  "./public/assets/js/core.js?v=4.5.1",
  "./public/assets/js/data.js?v=4.5.1",
  "./public/assets/js/ui.js?v=4.5.1",
  "./public/assets/js/profile.js?v=4.5.1",
  "./public/assets/js/production-engine.js?v=4.5.1",
  "./public/assets/js/production-data.js?v=4.5.1",
  "./public/assets/js/production.js?v=4.5.1",
  "./public/assets/js/iot.js?v=4.5.1",
  "./public/assets/js/views.js?v=4.5.1",
  "./public/assets/js/motion.js?v=4.5.1",
  "./public/assets/js/app.js?v=4.5.1",
  "./public/assets/js/twin.js?v=4.5.1",
  "./public/pages/login.html",
  "./public/pages/menu.html",
  "./public/pages/perfil.html",
  "./public/pages/mapa.html",
  "./public/pages/mapa-consumo.html",
  "./public/pages/ativos.html",
  "./public/pages/ativo-detalhes.html",
  "./public/pages/os.html",
  "./public/pages/os-detalhes.html",
  "./public/pages/estoque.html",
  "./public/pages/financeiro.html",
  "./public/pages/planejamento.html",
  "./public/pages/preventiva.html",
  "./public/pages/solicitacoes.html",
  "./public/pages/tecnico.html",
  "./public/pages/inspecoes.html",
  "./public/pages/confiabilidade.html",
  "./public/pages/iot.html",
  "./public/pages/producao.html",
  "./public/pages/notificacoes.html",
  "./public/pages/continuidade.html",
  "./public/pages/fornecedores.html",
  "./public/pages/compras.html",
  "./public/pages/contratos.html",
  "./public/pages/executivo.html",
  "./public/assets/images/mark.svg",
  "./public/assets/images/nexus-logo.png",
  "./public/assets/images/icon-192.png",
  "./public/assets/images/icon-512.png",
  "./public/assets/fonts/space-grotesk-500.woff2",
  "./public/assets/fonts/space-grotesk-700.woff2",
  "./public/assets/fonts/inter-400.woff2",
  "./public/assets/fonts/inter-500.woff2",
  "./public/assets/fonts/inter-600.woff2",
  "./public/assets/vendor/lenis/lenis.min.js?v=4.5.1",
  "./public/assets/vendor/nexus-ui/sidebar.js?v=4.5.1",
  "./public/assets/vendor/nexus-ui/styles.css?v=4.5.1",
  "./public/assets/vendor/jspdf/jspdf.umd.min.js?v=4.5.1"
];
const OPTIONAL=[
  "./public/assets/vendor/three/three.module.min.js",
  "./public/assets/vendor/three/three.core.min.js",
  "./public/assets/vendor/three/three.core.js",
  "./public/assets/images/login/fabrica-960.jpg",
  "./public/assets/images/login/fabrica-1280.jpg",
  "./public/assets/images/login/automacao-960.jpg",
  "./public/assets/images/login/automacao-1600.jpg",
  "./public/assets/images/login/torno-cnc-1280.jpg",
  "./public/assets/images/login/torno-1280.jpg",
  "./public/assets/images/login/robos-1280.jpg",
  "./public/assets/images/login/armazem-1280.jpg",
  "./public/assets/images/industrial/robotica-1280.webp",
  "./public/assets/images/industrial/maquina-cnc-768.webp",
  "./public/assets/images/industrial/usinagem-768.webp",
  "./public/assets/images/industrial/maquina-cnc-1280.webp",
  "./public/assets/images/industrial/robotica-768.webp",
  "./public/assets/images/industrial/usinagem-1280.webp"
];
// Fotos e o mapa 3D só são baixados quando usados.
const allowed=new Set([...SHELL,...OPTIONAL].map(p=>new URL(p,self.location.href).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname)||request.headers.has('Authorization')||(!allowed.has(url.pathname)&&request.mode!=='navigate'))return;
 event.respondWith(fetch(request,{cache:'no-cache'}).then(response=>{if(response.ok&&allowed.has(url.pathname)){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}return response;}).catch(async()=>{const cache=await caches.open(CACHE),cached=await cache.match(request,{ignoreSearch:true});return cached||(request.mode==='navigate'?await cache.match(new URL('./offline.html',self.location.href).href):Response.error());}));
});
