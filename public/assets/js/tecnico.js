import {
    db, ref, onValue, update, writeAuditLog, escapeHtml, entries, nonNegative,
    mountMaintenanceShell, startProtectedPage, formatDateTime, orderStatusBadge,
    priorityBadge, emptyState, toast
} from './maintenance-core.js';

mountMaintenanceShell({
    pageId: 'tecnico',
    title: 'Espaço do Técnico',
    subtitle: 'Minha fila, agenda do dia e apontamento de execução',
    headerActions: '<a href="solicitacoes.html" class="s3-btn"><i class="fas fa-bullhorn" aria-hidden="true"></i><span class="hidden sm:inline">Solicitar manutenção</span></a>',
    content: `
        <div class="s3-page">
            <section class="s3-hero"><div><h2 id="technician-greeting">Minha operação</h2><p>Priorize as O.S. atribuídas, registre o tempo e conclua os checklists na visão 360°.</p></div><div class="s3-actions"><a class="s3-btn s3-btn--primary" href="planejamento.html"><i class="fas fa-calendar-days" aria-hidden="true"></i>Minha agenda</a></div></section>
            <div class="s3-grid s3-grid--kpi">
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Minhas O.S. abertas</span><strong id="kpi-open" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-clipboard-list" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Em execução</span><strong id="kpi-doing" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-gears" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Programadas hoje</span><strong id="kpi-today" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-calendar-day" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Concluídas no mês</span><strong id="kpi-done" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-circle-check" aria-hidden="true"></i></span></article>
            </div>
            <div class="s3-layout-aside">
                <section class="s3-card"><div class="s3-card__head"><div><h3>Minhas Ordens de Serviço</h3><p>O cronômetro mantém o apontamento acumulado na própria O.S.</p></div><select id="my-order-filter" class="s3-input" aria-label="Filtrar minhas ordens"><option value="open">Abertas</option><option value="today">Hoje</option><option value="all">Todas</option></select></div><div id="my-orders" class="s3-card__body s3-list" aria-live="polite"></div></section>
                <aside class="s3-grid">
                    <section class="s3-card"><div class="s3-card__head"><div><h3>Execução atual</h3><p>Tempo registrado na O.S. em andamento.</p></div></div><div id="active-timer" class="s3-card__body" aria-live="polite"></div></section>
                    <section class="s3-card"><div class="s3-card__head"><div><h3>Fila disponível</h3><p>O.S. sem responsável que podem ser assumidas.</p></div></div><div id="available-orders" class="s3-card__body s3-list" aria-live="polite"></div></section>
                </aside>
            </div>
        </div>`
});

let context;
let workOrders = {};
let assets = {};
let timerInterval;

function todayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return [start.getTime(), start.getTime() + 86400000];
}

function isMine(order) {
    return order.assignedToUid === context.user.uid || (!order.assignedToUid && order.createdByUid === context.user.uid);
}

function elapsedMs(order) {
    const accumulated = nonNegative(order.accumulatedMs);
    return order.timerStartedAt ? accumulated + Math.max(0, Date.now() - Number(order.timerStartedAt)) : accumulated;
}

function formatDuration(milliseconds) {
    const seconds = Math.floor(nonNegative(milliseconds) / 1000);
    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
}

function orderCard(id, order, mine = true) {
    const assetName = assets[order.assetId]?.name || order.assetName || 'Sem ativo';
    const controls = mine ? (order.status === 'doing'
        ? `<button type="button" class="s3-btn s3-btn--sm" data-pause-order="${escapeHtml(id)}"><i class="fas fa-pause" aria-hidden="true"></i>Pausar</button>`
        : order.status !== 'done' ? `<button type="button" class="s3-btn s3-btn--sm s3-btn--success" data-start-order="${escapeHtml(id)}"><i class="fas fa-play" aria-hidden="true"></i>Iniciar</button>` : '')
        : `<button type="button" class="s3-btn s3-btn--sm s3-btn--primary" data-claim-order="${escapeHtml(id)}"><i class="fas fa-hand" aria-hidden="true"></i>Assumir</button>`;
    return `<article class="s3-list-item"><div class="s3-list-item__top"><div><h4>${escapeHtml(order.title || 'O.S. sem título')}</h4><p>${escapeHtml(assetName)}</p></div><div class="s3-chip-row">${priorityBadge(order.priority)}${orderStatusBadge(order.status)}</div></div><div class="s3-meta"><span><i class="fas fa-calendar" aria-hidden="true"></i> ${order.scheduledStart ? formatDateTime(order.scheduledStart) : 'Sem programação'}</span><span><i class="fas fa-clock" aria-hidden="true"></i> ${formatDuration(elapsedMs(order))}</span><span><i class="fas fa-user" aria-hidden="true"></i> ${escapeHtml(order.assignedToName || 'Sem responsável')}</span></div><div class="s3-actions mt-3">${controls}<a class="s3-btn s3-btn--sm" href="os-detalhes.html?id=${encodeURIComponent(id)}">Abrir O.S. 360°</a></div></article>`;
}

function renderTimer() {
    const active = entries(workOrders).find(([, order]) => order.assignedToUid === context.user.uid && order.status === 'doing');
    const target = document.getElementById('active-timer');
    if (!active) {
        target.innerHTML = emptyState('fa-stopwatch', 'Nenhum cronômetro ativo', 'Inicie uma O.S. atribuída para registrar o tempo.');
        return;
    }
    const [id, order] = active;
    target.innerHTML = `<div class="text-center"><span class="s3-kpi__label">${escapeHtml(order.title || 'O.S. em execução')}</span><strong class="block text-4xl font-black my-4 tabular-nums">${formatDuration(elapsedMs(order))}</strong><p>${escapeHtml(assets[order.assetId]?.name || order.assetName || 'Sem ativo')}</p><div class="s3-actions justify-center mt-4"><button type="button" class="s3-btn s3-btn--danger" data-pause-order="${escapeHtml(id)}"><i class="fas fa-pause" aria-hidden="true"></i>Pausar apontamento</button></div></div>`;
}

function render() {
    const [todayStart, todayEnd] = todayRange();
    const all = entries(workOrders).sort((a, b) => Number(a[1].scheduledStart || a[1].dueAt || Infinity) - Number(b[1].scheduledStart || b[1].dueAt || Infinity));
    const mine = all.filter(([, order]) => isMine(order));
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    document.getElementById('kpi-open').textContent = mine.filter(([, order]) => order.status !== 'done').length;
    document.getElementById('kpi-doing').textContent = mine.filter(([, order]) => order.status === 'doing').length;
    document.getElementById('kpi-today').textContent = mine.filter(([, order]) => Number(order.scheduledStart) >= todayStart && Number(order.scheduledStart) < todayEnd).length;
    document.getElementById('kpi-done').textContent = mine.filter(([, order]) => order.status === 'done' && Number(order.completedAt || order.approvedAt) >= monthStart.getTime()).length;

    const filter = document.getElementById('my-order-filter').value;
    const filtered = mine.filter(([, order]) => {
        if (filter === 'open') return order.status !== 'done';
        if (filter === 'today') return Number(order.scheduledStart) >= todayStart && Number(order.scheduledStart) < todayEnd;
        return true;
    });
    document.getElementById('my-orders').innerHTML = filtered.map(([id, order]) => orderCard(id, order, true)).join('') || emptyState('fa-clipboard-check', 'Nenhuma O.S. nesta visão', 'Sua fila será atualizada quando houver atribuições.');
    const available = all.filter(([, order]) => order.status !== 'done' && !order.assignedToUid).slice(0, 6);
    document.getElementById('available-orders').innerHTML = available.map(([id, order]) => orderCard(id, order, false)).join('') || emptyState('fa-check', 'Fila distribuída', 'Não há O.S. sem responsável.');
    renderTimer();
}

async function claimOrder(id) {
    const order = workOrders[id];
    if (!order || order.assignedToUid) return toast('warning', 'Esta O.S. já possui responsável.');
    try {
        await update(ref(db, `work_orders/${id}`), { assignedToUid: context.user.uid, assignedToName: context.profile.name || '', assignedAt: Date.now(), updatedAt: Date.now() });
        await writeAuditLog({ action: 'assign', entity: 'work_order', entityId: id, description: 'O.S. assumida pelo técnico.', metadata: { assignedToUid: context.user.uid } });
        toast('success', 'O.S. adicionada à sua fila.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível assumir a O.S.');
    }
}

async function startOrder(id) {
    const order = workOrders[id];
    if (!order || order.status === 'done') return;
    const otherActive = entries(workOrders).find(([otherId, item]) => otherId !== id && item.assignedToUid === context.user.uid && item.status === 'doing');
    if (otherActive) return toast('warning', 'Pause a O.S. atual antes de iniciar outra.');
    try {
        await update(ref(db, `work_orders/${id}`), { status: 'doing', assignedToUid: context.user.uid, assignedToName: context.profile.name || '', timerStartedAt: Date.now(), startedAt: order.startedAt || Date.now(), updatedAt: Date.now(), lastUpdatedBy: context.profile.name || '' });
        await writeAuditLog({ action: 'start', entity: 'work_order', entityId: id, description: 'Execução iniciada no Espaço do Técnico.' });
        toast('success', 'Execução e cronômetro iniciados.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível iniciar a O.S.');
    }
}

async function pauseOrder(id) {
    const order = workOrders[id];
    if (!order || order.status !== 'doing') return;
    const accumulatedMs = elapsedMs(order);
    try {
        await update(ref(db, `work_orders/${id}`), { status: 'todo', accumulatedMs, actualHours: Number((accumulatedMs / 3600000).toFixed(2)), timerStartedAt: null, pausedAt: Date.now(), updatedAt: Date.now(), lastUpdatedBy: context.profile.name || '' });
        await writeAuditLog({ action: 'pause', entity: 'work_order', entityId: id, description: 'Execução pausada com tempo acumulado.', metadata: { accumulatedMs } });
        toast('warning', 'Execução pausada e tempo salvo.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível pausar a O.S.');
    }
}

document.getElementById('my-order-filter').addEventListener('change', render);
document.addEventListener('click', (event) => {
    const claim = event.target.closest('[data-claim-order]');
    if (claim) return claimOrder(claim.dataset.claimOrder);
    const start = event.target.closest('[data-start-order]');
    if (start) return startOrder(start.dataset.startOrder);
    const pause = event.target.closest('[data-pause-order]');
    if (pause) return pauseOrder(pause.dataset.pauseOrder);
});

startProtectedPage('tecnico', (pageContext) => {
    context = pageContext;
    document.getElementById('technician-greeting').textContent = `Olá, ${(context.profile.name || 'técnico').split(' ')[0]}`;
    onValue(ref(db, 'assets'), (snapshot) => { assets = snapshot.val() || {}; render(); });
    onValue(ref(db, 'work_orders'), (snapshot) => { workOrders = snapshot.val() || {}; render(); });
    timerInterval = window.setInterval(renderTimer, 1000);
});

window.addEventListener('beforeunload', () => window.clearInterval(timerInterval));
