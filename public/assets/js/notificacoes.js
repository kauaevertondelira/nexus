import {
    db, ref, onValue, set, remove, writeAuditLog,
    escapeHtml, entries, mountMaintenanceShell, startProtectedPage,
    formatDateTime, toast, setButtonBusy
} from './maintenance-core.js';
import { app } from './firebase.js';
import { getMessaging, getToken, deleteToken, isSupported } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';
import { VAPID_PUBLIC_KEY } from './push-config.js';

mountMaintenanceShell({
    pageId: 'notificacoes',
    title: 'Notificações',
    subtitle: 'Preferências de alertas e preparação do push remoto',
    content: `
        <div class="s3-page">
            <div class="s3-grid s3-grid--2">
                <section class="s3-card">
                    <div class="s3-card__head"><div><h3>Push neste navegador</h3><p>Receba alertas mesmo quando nenhuma tela do Nexus estiver aberta.</p></div><span id="push-badge" class="s3-badge s3-badge--slate">Verificando</span></div>
                    <div class="s3-card__body space-y-4">
                        <div id="push-status" class="s4-notice"><i class="fas fa-spinner fa-spin mt-1" aria-hidden="true"></i><div><strong>Verificando compatibilidade</strong><p class="mt-1 text-xs">Aguarde enquanto o navegador e a configuração são conferidos.</p></div></div>
                        <div class="s3-actions"><button id="enable-push" type="button" class="s3-btn s3-btn--primary"><i class="fas fa-bell" aria-hidden="true"></i>Ativar push</button><button id="disable-push" type="button" class="s3-btn s3-btn--danger" hidden><i class="fas fa-bell-slash" aria-hidden="true"></i>Desativar neste navegador</button><button id="test-notification" type="button" class="s3-btn"><i class="fas fa-vial" aria-hidden="true"></i>Testar</button></div>
                        <p id="subscription-meta" class="text-xs text-slate-500 dark:text-slate-400"></p>
                    </div>
                </section>
                <section class="s3-card">
                    <div class="s3-card__head"><div><h3>Tipos de alerta</h3><p>Escolha o que deve ser enviado para seus navegadores cadastrados.</p></div></div>
                    <form id="preference-form" class="s3-card__body s3-list">
                        <label class="s3-list-item flex items-start gap-3"><input id="pref-critical" type="checkbox" class="mt-1" checked><span><strong>Telemetria crítica</strong><small class="block mt-1 text-slate-500">Temperatura ou vibração acima do limite crítico.</small></span></label>
                        <label class="s3-list-item flex items-start gap-3"><input id="pref-warning" type="checkbox" class="mt-1"><span><strong>Telemetria em atenção</strong><small class="block mt-1 text-slate-500">Avisos antes do nível crítico.</small></span></label>
                        <label class="s3-list-item flex items-start gap-3"><input id="pref-sla" type="checkbox" class="mt-1" checked><span><strong>SLA de O.S.</strong><small class="block mt-1 text-slate-500">Ordens urgentes próximas ou além do prazo.</small></span></label>
                        <label class="s3-list-item flex items-start gap-3"><input id="pref-stock" type="checkbox" class="mt-1"><span><strong>Estoque crítico</strong><small class="block mt-1 text-slate-500">Itens abaixo do mínimo configurado.</small></span></label>
                        <button id="save-preferences" type="submit" class="s3-btn s3-btn--primary"><i class="fas fa-floppy-disk" aria-hidden="true"></i>Salvar preferências</button>
                    </form>
                </section>
            </div>
            <section class="s3-card mt-4">
                <div class="s3-card__head"><div><h3>Navegadores cadastrados</h3><p>Tokens são privados, ficam ocultos e podem ser removidos individualmente.</p></div><span id="device-count" class="s3-badge s3-badge--blue">0 dispositivos</span></div>
                <div id="subscription-list" class="s3-card__body s3-grid s3-grid--3" aria-live="polite"></div>
            </section>
            <div class="s4-notice mt-4" data-tone="warning"><i class="fas fa-circle-info mt-1 text-amber-500" aria-hidden="true"></i><div><strong>Ativação do ambiente</strong><p class="mt-1 text-xs">O código do Sprint 4 está pronto, mas o push remoto só funciona após preencher a chave VAPID pública e publicar a função Firebase incluída no projeto.</p></div></div>
        </div>`
});

let context;
let messaging;
let supported = false;
let subscriptions = {};
let currentToken = '';
let currentKey = '';

function browserName() {
    const agent = navigator.userAgent;
    if (/Firefox/i.test(agent)) return 'Firefox';
    if (/Edg/i.test(agent)) return 'Edge';
    if (/Chrome/i.test(agent)) return 'Chrome';
    if (/Safari/i.test(agent)) return 'Safari';
    return 'Navegador';
}

async function tokenKey(token) {
    if (globalThis.crypto?.subtle) {
        const data = new TextEncoder().encode(token);
        const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 40);
    }
    return btoa(token).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
}

function setStatus(tone, title, description) {
    const icons = { success: 'fa-circle-check', warning: 'fa-triangle-exclamation', error: 'fa-circle-xmark', info: 'fa-circle-info' };
    const status = document.getElementById('push-status');
    status.dataset.tone = tone === 'error' ? 'warning' : tone;
    status.innerHTML = `<i class="fas ${icons[tone] || icons.info} mt-1" aria-hidden="true"></i><div><strong>${escapeHtml(title)}</strong><p class="mt-1 text-xs">${escapeHtml(description)}</p></div>`;
}

function renderState() {
    const activeEntry = entries(subscriptions).find(([, item]) => currentToken && item.token === currentToken);
    const active = Boolean(activeEntry);
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    const badge = document.getElementById('push-badge');
    const enable = document.getElementById('enable-push');
    const disable = document.getElementById('disable-push');
    const test = document.getElementById('test-notification');
    enable.hidden = active;
    disable.hidden = !active;
    test.disabled = permission !== 'granted';
    if (active) {
        badge.className = 's3-badge s3-badge--green';
        badge.textContent = 'Ativo';
        setStatus('success', 'Push ativo neste navegador', 'Este dispositivo está registrado para receber os alertas selecionados.');
        document.getElementById('subscription-meta').textContent = `Ativado em ${formatDateTime(activeEntry[1].createdAt)} · última atualização ${formatDateTime(activeEntry[1].updatedAt)}`;
    } else if (!supported) {
        badge.className = 's3-badge s3-badge--slate';
        badge.textContent = 'Indisponível';
        enable.disabled = true;
        setStatus('warning', 'Push não disponível', 'Este navegador não oferece Firebase Cloud Messaging ou o site não está em HTTP seguro.');
    } else if (!VAPID_PUBLIC_KEY) {
        badge.className = 's3-badge s3-badge--amber';
        badge.textContent = 'Configuração pendente';
        enable.disabled = true;
        setStatus('warning', 'Chave VAPID ainda não configurada', 'Preencha push-config.js com a chave pública do Firebase para liberar a ativação.');
    } else if (permission === 'denied') {
        badge.className = 's3-badge s3-badge--red';
        badge.textContent = 'Bloqueado';
        enable.disabled = true;
        setStatus('error', 'Notificações bloqueadas', 'Altere a permissão do site nas configurações do navegador.');
    } else {
        badge.className = 's3-badge s3-badge--blue';
        badge.textContent = 'Disponível';
        enable.disabled = false;
        setStatus('info', 'Push disponível para ativação', 'A permissão será solicitada somente depois que você clicar em Ativar push.');
    }
    renderSubscriptions();
}

function renderSubscriptions() {
    const rows = entries(subscriptions).sort((a, b) => Number(b[1].updatedAt || 0) - Number(a[1].updatedAt || 0));
    document.getElementById('device-count').textContent = `${rows.length} dispositivo${rows.length === 1 ? '' : 's'}`;
    document.getElementById('subscription-list').innerHTML = rows.map(([key, item]) => `<article class="s3-list-item"><div class="s3-list-item__top"><h4><i class="fas fa-laptop mr-2 text-blue-500" aria-hidden="true"></i>${escapeHtml(item.browser || 'Navegador')}</h4><span class="s3-badge ${item.enabled === false ? 's3-badge--slate' : 's3-badge--green'}">${item.enabled === false ? 'Inativo' : 'Ativo'}</span></div><p>${escapeHtml(item.platform || 'Plataforma não informada')}</p><div class="s3-meta"><span>Atualizado: ${formatDateTime(item.updatedAt)}</span></div><div class="s3-actions mt-3"><button type="button" class="s3-btn s3-btn--sm s3-btn--danger" data-remove-subscription="${escapeHtml(key)}"><i class="fas fa-trash" aria-hidden="true"></i>Remover</button></div></article>`).join('') || '<div class="s3-empty"><div><i class="fas fa-bell-slash" aria-hidden="true"></i><strong>Nenhum navegador cadastrado</strong><p>Ative o push em um navegador compatível.</p></div></div>';
}

function loadPreferences() {
    onValue(ref(db, `notification_preferences/${context.user.uid}`), (snapshot) => {
        const value = snapshot.val() || {};
        document.getElementById('pref-critical').checked = value.iotCritical !== false;
        document.getElementById('pref-warning').checked = value.iotWarning === true;
        document.getElementById('pref-sla').checked = value.orderSla !== false;
        document.getElementById('pref-stock').checked = value.stockCritical === true;
    });
}

async function initializeMessaging() {
    supported = 'Notification' in window && 'serviceWorker' in navigator && await isSupported().catch(() => false);
    if (!supported) return renderState();
    messaging = getMessaging(app);
    if (Notification.permission === 'granted' && VAPID_PUBLIC_KEY) {
        try {
            const registration = await navigator.serviceWorker.ready;
            currentToken = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: registration }) || '';
            currentKey = currentToken ? await tokenKey(currentToken) : '';
        } catch (error) {
            console.warn('Token FCM ainda não disponível.', error);
        }
    }
    renderState();
}

document.getElementById('enable-push').addEventListener('click', async () => {
    const button = document.getElementById('enable-push');
    if (!supported || !messaging || !VAPID_PUBLIC_KEY) return;
    setButtonBusy(button, true, 'Ativando...');
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('permission-not-granted');
        const registration = await navigator.serviceWorker.ready;
        currentToken = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: registration });
        if (!currentToken) throw new Error('empty-token');
        currentKey = await tokenKey(currentToken);
        const now = Date.now();
        await set(ref(db, `notification_subscriptions/${context.user.uid}/${currentKey}`), {
            token: currentToken,
            enabled: true,
            browser: browserName(),
            platform: navigator.platform || 'Web',
            createdAt: subscriptions[currentKey]?.createdAt || now,
            updatedAt: now,
            userUid: context.user.uid
        });
        await writeAuditLog({ action: 'enable', entity: 'push_subscription', entityId: currentKey, description: 'Push remoto ativado em um navegador.' });
        toast('success', 'Push ativado neste navegador.');
    } catch (error) {
        console.error(error);
        toast('error', error.message === 'permission-not-granted' ? 'A permissão de notificações não foi concedida.' : 'Não foi possível ativar o push.');
        renderState();
    } finally {
        setButtonBusy(button, false);
    }
});

document.getElementById('disable-push').addEventListener('click', async () => {
    const button = document.getElementById('disable-push');
    setButtonBusy(button, true, 'Desativando...');
    try {
        if (currentKey) await remove(ref(db, `notification_subscriptions/${context.user.uid}/${currentKey}`));
        if (messaging) await deleteToken(messaging).catch(() => false);
        await writeAuditLog({ action: 'disable', entity: 'push_subscription', entityId: currentKey, description: 'Push remoto desativado neste navegador.' });
        currentToken = '';
        currentKey = '';
        toast('success', 'Push desativado neste navegador.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível desativar o push.');
    } finally {
        setButtonBusy(button, false);
    }
});

document.getElementById('test-notification').addEventListener('click', () => {
    if (Notification.permission !== 'granted') return toast('warning', 'Ative as notificações primeiro.');
    new Notification('Nexus Industrial', { body: 'Notificação de teste recebida com sucesso.', icon: '../../IMG/canvas-b.png', tag: 'nexus-test' });
});

document.getElementById('preference-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('save-preferences');
    setButtonBusy(button, true, 'Salvando...');
    try {
        await set(ref(db, `notification_preferences/${context.user.uid}`), {
            iotCritical: document.getElementById('pref-critical').checked,
            iotWarning: document.getElementById('pref-warning').checked,
            orderSla: document.getElementById('pref-sla').checked,
            stockCritical: document.getElementById('pref-stock').checked,
            updatedAt: Date.now(),
            userUid: context.user.uid
        });
        toast('success', 'Preferências salvas.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível salvar as preferências.');
    } finally {
        setButtonBusy(button, false);
    }
});

document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-remove-subscription]');
    if (!button) return;
    const key = button.dataset.removeSubscription;
    if (!window.confirm('Remover este navegador da lista de push?')) return;
    try {
        await remove(ref(db, `notification_subscriptions/${context.user.uid}/${key}`));
        if (key === currentKey && messaging) {
            await deleteToken(messaging).catch(() => false);
            currentToken = '';
            currentKey = '';
        }
        await writeAuditLog({ action: 'remove', entity: 'push_subscription', entityId: key, description: 'Navegador removido das notificações push.' });
        toast('success', 'Navegador removido.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível remover o navegador.');
    }
});

startProtectedPage('notificacoes', (pageContext) => {
    context = pageContext;
    onValue(ref(db, `notification_subscriptions/${context.user.uid}`), (snapshot) => { subscriptions = snapshot.val() || {}; renderState(); });
    loadPreferences();
    initializeMessaging();
});
