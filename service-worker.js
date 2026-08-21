try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey: 'AIzaSyD6gj_6e0WuGr6C_hJDkXBK7cI2EopWV1s',
    authDomain: 'nexus-iot-senai.firebaseapp.com',
    databaseURL: 'https://nexus-iot-senai-default-rtdb.firebaseio.com',
    projectId: 'nexus-iot-senai',
    storageBucket: 'nexus-iot-senai.firebasestorage.app',
    messagingSenderId: '717361923500',
    appId: '1:717361923500:web:9e55a4dcb002e049abe609'
  });
  firebase.messaging().onBackgroundMessage((payload) => {
    const data = payload.data || {};
    return self.registration.showNotification(data.title || 'Nexus Industrial', {
      body: data.body || 'Novo alerta industrial.',
      icon: './IMG/canvas-b.png',
      badge: './IMG/canvas-b.png',
      tag: data.tag || `nexus-${data.alertId || Date.now()}`,
      data: { url: data.url || './public/pages/iot.html' }
    });
  });
} catch (error) {
  console.warn('Firebase Messaging indisponível no Service Worker.', error);
}

const CACHE_NAME = 'nexus-shell-v10';
const OFFLINE_URL = './offline.html';
const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './IMG/canvas-b.png',
  './IMG/canvas-c.png',
  './public/assets/css/nexus-ui.css',
  './public/assets/css/theme-polish.css',
  './public/assets/css/sprint3.css',
  './public/assets/js/auth-gate.js',
  './public/assets/js/theme-manager.js',
  './public/assets/js/ui-enhancements.js',
  './public/assets/js/pwa.js',
  './public/assets/js/support-center.js',
  './public/assets/js/maintenance-core.js',
  './public/assets/data/assistant-knowledge.json',
  './public/pages/login.html',
  './public/pages/planejamento.html',
  './public/pages/preventiva.html',
  './public/pages/solicitacoes.html',
  './public/pages/tecnico.html',
  './public/pages/os-detalhes.html',
  './public/assets/js/planejamento.js',
  './public/assets/js/preventiva.js',
  './public/assets/js/solicitacoes.js',
  './public/assets/js/tecnico.js',
  './public/assets/js/os-detalhes.js',
  './public/pages/iot.html',
  './public/pages/notificacoes.html',
  './public/pages/continuidade.html',
  './public/assets/js/iot.js',
  './public/assets/js/notificacoes.js',
  './public/assets/js/continuidade.js',
  './public/assets/js/push-config.js',
  './public/pages/ativo-detalhes.html',
  './public/pages/inspecoes.html',
  './public/pages/confiabilidade.html',
  './public/assets/js/ativo-detalhes.js',
  './public/assets/js/inspecoes.js',
  './public/assets/js/confiabilidade.js'
  ,'./public/pages/fornecedores.html'
  ,'./public/pages/compras.html'
  ,'./public/pages/contratos.html'
  ,'./public/pages/executivo.html'
  ,'./public/assets/js/fornecedores.js'
  ,'./public/assets/js/compras.js'
  ,'./public/assets/js/contratos.js'
  ,'./public/assets/js/executivo.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('nexus-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match(OFFLINE_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = event.notification.data?.url || './public/pages/menu.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        existing.navigate(destination);
        return existing.focus();
      }
      return self.clients.openWindow(destination);
    })
  );
});
