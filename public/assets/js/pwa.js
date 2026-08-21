(function () {
    'use strict';

    const moduleUrl = import.meta.url;
    const manifestUrl = new URL('../../../manifest.webmanifest', moduleUrl).href;
    const serviceWorkerUrl = new URL('../../../service-worker.js', moduleUrl).href;
    const rootUrl = new URL('../../../', moduleUrl).href;
    const notificationPreferenceKey = 'nexus-notifications-enabled';
    const activeAlertKeysKey = 'nexus-active-alert-keys-v1';
    let deferredInstallPrompt = null;
    let registration = null;

    function safeGet(key) {
        try { return localStorage.getItem(key); } catch (_) { return null; }
    }

    function safeSet(key, value) {
        try { localStorage.setItem(key, value); } catch (_) {}
    }

    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    function notificationsSupported() {
        return 'Notification' in window && 'serviceWorker' in navigator;
    }

    function getState() {
        return {
            installAvailable: Boolean(deferredInstallPrompt),
            installed: isStandalone(),
            serviceWorkerReady: Boolean(registration),
            notificationsSupported: notificationsSupported(),
            notificationPermission: notificationsSupported() ? Notification.permission : 'unsupported',
            notificationsEnabled: safeGet(notificationPreferenceKey) === 'true'
        };
    }

    function emitState() {
        window.dispatchEvent(new CustomEvent('nexus:pwa-state', { detail: getState() }));
    }

    function ensureManifest() {
        if (document.querySelector('link[rel="manifest"]')) return;
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = manifestUrl;
        document.head.appendChild(link);
    }

    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return null;
        try {
            registration = await navigator.serviceWorker.register(serviceWorkerUrl, { scope: rootUrl });
            if (Array.isArray(window.NexusPendingAlerts)) await syncAlerts(window.NexusPendingAlerts);
            emitState();
            return registration;
        } catch (error) {
            console.warn('Service Worker do Nexus indisponível.', error);
            return null;
        }
    }

    async function install() {
        if (!deferredInstallPrompt) return { status: isStandalone() ? 'installed' : 'unavailable' };
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        emitState();
        return { status: choice.outcome };
    }

    async function requestNotifications() {
        if (!notificationsSupported()) return { status: 'unsupported' };
        const permission = await Notification.requestPermission();
        safeSet(notificationPreferenceKey, String(permission === 'granted'));
        emitState();
        if (permission === 'granted' && Array.isArray(window.NexusPendingAlerts)) {
            await syncAlerts(window.NexusPendingAlerts, true);
        }
        return { status: permission };
    }

    function alertKeysFromStorage() {
        try {
            const parsed = JSON.parse(safeGet(activeAlertKeysKey) || '[]');
            return new Set(Array.isArray(parsed) ? parsed : []);
        } catch (_) {
            return new Set();
        }
    }

    async function showAlert(alert) {
        if (!registration) registration = await navigator.serviceWorker.ready.catch(() => null);
        if (!registration) return;
        await registration.showNotification(alert.title || 'Alerta Nexus', {
            body: alert.desc || 'Existe uma nova ocorrência que precisa de atenção.',
            icon: new URL('../../../IMG/canvas-b.png', moduleUrl).href,
            badge: new URL('../../../IMG/canvas-b.png', moduleUrl).href,
            tag: `nexus-${alert.key}`,
            renotify: false,
            requireInteraction: alert.type === 'danger',
            data: { url: new URL('../../../public/pages/menu.html', moduleUrl).href }
        });
    }

    async function syncAlerts(alerts, notifyExisting = false) {
        const cleanAlerts = Array.isArray(alerts) ? alerts.filter((alert) => alert?.key) : [];
        window.NexusPendingAlerts = cleanAlerts;
        if (!notificationsSupported() || Notification.permission !== 'granted' || safeGet(notificationPreferenceKey) !== 'true') return;
        const previous = notifyExisting ? new Set() : alertKeysFromStorage();
        const active = new Set(cleanAlerts.map((alert) => alert.key));
        for (const alert of cleanAlerts) {
            if (!previous.has(alert.key)) await showAlert(alert);
        }
        safeSet(activeAlertKeysKey, JSON.stringify([...active]));
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        emitState();
    });
    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        emitState();
    });

    window.NexusPWA = { getState, install, requestNotifications };
    window.NexusNotifications = { sync: syncAlerts };
    ensureManifest();
    registerServiceWorker();
    emitState();
})();
