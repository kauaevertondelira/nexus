import {
    db, ref, onValue, update, writeAuditLog, escapeHtml, entries, nonNegative,
    mountMaintenanceShell, startProtectedPage, formatDateTime, toDateTimeLocal,
    orderStatusBadge, priorityBadge, emptyState, openDialog, wireDialog, closeDialog, toast, setButtonBusy
} from './maintenance-core.js';

mountMaintenanceShell({
    pageId: 'planejamento',
    title: 'Central de Planejamento',
    subtitle: 'Agenda semanal, distribuição de equipe e capacidade operacional',
    headerActions: '<button id="open-schedule-dialog" type="button" class="s3-btn s3-btn--primary"><i class="fas fa-calendar-plus" aria-hidden="true"></i><span class="hidden sm:inline">Programar O.S.</span></button>',
    content: `
        <div class="s3-page">
            <div class="s3-grid s3-grid--kpi">
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Programadas na semana</span><strong id="kpi-week" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-calendar-check" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Sem programação</span><strong id="kpi-unscheduled" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-inbox" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">SLA atrasado</span><strong id="kpi-overdue" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-clock" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Carga estimada</span><strong id="kpi-capacity" class="s3-kpi__value">0%</strong></div><span class="s3-kpi__icon"><i class="fas fa-gauge-high" aria-hidden="true"></i></span></article>
            </div>
            <div class="s3-toolbar">
                <div class="s3-toolbar-group"><button id="week-prev" type="button" class="s3-btn s3-btn--sm" aria-label="Semana anterior"><i class="fas fa-chevron-left" aria-hidden="true"></i></button><button id="week-today" type="button" class="s3-btn s3-btn--sm">Esta semana</button><button id="week-next" type="button" class="s3-btn s3-btn--sm" aria-label="Próxima semana"><i class="fas fa-chevron-right" aria-hidden="true"></i></button><strong id="week-label"></strong></div>
                <div class="s3-toolbar-group"><a href="os.html" class="s3-btn s3-btn--sm"><i class="fas fa-table-columns" aria-hidden="true"></i>Kanban</a><a href="preventiva.html" class="s3-btn s3-btn--sm"><i class="fas fa-arrows-rotate" aria-hidden="true"></i>Preventivas</a></div>
            </div>
            <div class="s3-layout-aside">
                <article class="s3-card"><div class="s3-card__head"><div><h3>Agenda da equipe</h3><p>Selecione uma O.S. para alterar sua programação.</p></div></div><div class="s3-card__body s3-table-wrap"><div id="week-calendar" class="s3-calendar" aria-live="polite"></div></div></article>
                <aside class="s3-card"><div class="s3-card__head"><div><h3>Fila não programada</h3><p>Ordens aguardando data e responsável.</p></div></div><div id="unscheduled-list" class="s3-card__body s3-list" aria-live="polite"></div></aside>
            </div>
        </div>
        <dialog id="schedule-dialog" class="s3-dialog" aria-labelledby="schedule-title">
            <form id="schedule-form">
                <div class="s3-dialog__head"><h2 id="schedule-title">Programar Ordem de Serviço</h2><button type="button" class="s3-btn s3-btn--sm" data-dialog-close aria-label="Fechar"><i class="fas fa-xmark" aria-hidden="true"></i></button></div>
                <div class="s3-dialog__body s3-form-grid">
                    <div class="s3-field s3-field--wide"><label for="schedule-order">Ordem de Serviço</label><select id="schedule-order" required></select></div>
                    <div class="s3-field s3-field--wide"><label for="schedule-technician">Responsável</label><select id="schedule-technician" required></select></div>
                    <div class="s3-field"><label for="schedule-start">Início</label><input id="schedule-start" type="datetime-local" required></div>
                    <div class="s3-field"><label for="schedule-end">Término previsto</label><input id="schedule-end" type="datetime-local" required></div>
                    <div class="s3-field"><label for="schedule-hours">Horas estimadas</label><input id="schedule-hours" type="number" min="0.5" max="240" step="0.5" value="2" required></div>
                    <div class="s3-field"><label for="schedule-note">Observação</label><input id="schedule-note" maxlength="180" placeholder="Ex.: parada combinada com Produção"></div>
                </div>
                <div class="s3-dialog__foot"><button type="button" class="s3-btn" data-dialog-close>Cancelar</button><button id="schedule-submit" class="s3-btn s3-btn--primary" type="submit"><i class="fas fa-check" aria-hidden="true"></i>Salvar programação</button></div>
            </form>
        </dialog>`
});

wireDialog('schedule-dialog');

let context;
let workOrders = {};
let assets = {};
let technicians = {};
let weekStart = startOfWeek(Date.now());

function startOfWeek(value) {
    const date = new Date(value);
    const day = date.getDay() || 7;
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - day + 1);
    return date.getTime();
}

function addDays(value, days) {
    return value + days * 86400000;
}

function orderName(id, order) {
    const asset = assets[order.assetId]?.name || order.assetName || 'Sem ativo';
    return `${order.title || id} · ${asset}`;
}

function renderTechnicianOptions() {
    const select = document.getElementById('schedule-technician');
    const options = entries(technicians).map(([uid, user]) => `<option value="${escapeHtml(uid)}">${escapeHtml(user.name || user.email || uid)}</option>`).join('');
    select.innerHTML = options || `<option value="${escapeHtml(context.user.uid)}">${escapeHtml(context.profile.name || 'Usuário atual')}</option>`;
}

function renderOrderOptions(selectedId = '') {
    const orders = entries(workOrders).filter(([, order]) => order.status !== 'done');
    const select = document.getElementById('schedule-order');
    select.innerHTML = orders.map(([id, order]) => `<option value="${escapeHtml(id)}" ${id === selectedId ? 'selected' : ''}>${escapeHtml(orderName(id, order))}</option>`).join('') || '<option value="">Nenhuma O.S. aberta</option>';
}

function openSchedule(orderId = '') {
    renderOrderOptions(orderId);
    renderTechnicianOptions();
    const order = workOrders[orderId] || {};
    const start = nonNegative(order.scheduledStart, Math.max(Date.now() + 3600000, weekStart));
    const hours = Math.max(.5, nonNegative(order.estimatedHours, 2));
    document.getElementById('schedule-start').value = toDateTimeLocal(start);
    document.getElementById('schedule-end').value = toDateTimeLocal(nonNegative(order.scheduledEnd, start + hours * 3600000));
    document.getElementById('schedule-hours').value = hours;
    document.getElementById('schedule-note').value = order.scheduleNote || '';
    if (order.assignedToUid) document.getElementById('schedule-technician').value = order.assignedToUid;
    openDialog('schedule-dialog');
}

function render() {
    const start = weekStart;
    const end = addDays(start, 7);
    const openOrders = entries(workOrders).filter(([, order]) => order.status !== 'done');
    const scheduled = openOrders.filter(([, order]) => nonNegative(order.scheduledStart) >= start && nonNegative(order.scheduledStart) < end);
    const unscheduled = openOrders.filter(([, order]) => !nonNegative(order.scheduledStart));
    const overdue = openOrders.filter(([, order]) => nonNegative(order.dueAt) && Number(order.dueAt) < Date.now()).length;
    const totalHours = scheduled.reduce((sum, [, order]) => sum + Math.max(.5, nonNegative(order.estimatedHours, 2)), 0);
    const capacity = Math.min(999, Math.round((totalHours / Math.max(40, entries(technicians).length * 40)) * 100));
    document.getElementById('kpi-week').textContent = scheduled.length;
    document.getElementById('kpi-unscheduled').textContent = unscheduled.length;
    document.getElementById('kpi-overdue').textContent = overdue;
    document.getElementById('kpi-capacity').textContent = `${capacity}%`;
    document.getElementById('week-label').textContent = `${new Date(start).toLocaleDateString('pt-BR')} – ${new Date(addDays(start, 6)).toLocaleDateString('pt-BR')}`;

    const calendar = document.getElementById('week-calendar');
    calendar.innerHTML = Array.from({ length: 7 }, (_, index) => {
        const dayStart = addDays(start, index);
        const dayEnd = addDays(dayStart, 1);
        const dayOrders = scheduled.filter(([, order]) => Number(order.scheduledStart) >= dayStart && Number(order.scheduledStart) < dayEnd).sort((a, b) => Number(a[1].scheduledStart) - Number(b[1].scheduledStart));
        const jobs = dayOrders.map(([id, order]) => `<button type="button" class="s3-calendar-job text-left" data-schedule-order="${escapeHtml(id)}"><strong>${escapeHtml(order.title || 'O.S. sem título')}</strong><small>${new Date(order.scheduledStart).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${escapeHtml(order.assignedToName || 'Sem responsável')}</small><small>${escapeHtml(assets[order.assetId]?.name || order.assetName || 'Sem ativo')}</small></button>`).join('');
        return `<section class="s3-calendar-day"><div class="s3-calendar-day__head">${new Date(dayStart).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</div><div class="s3-calendar-day__body">${jobs || '<small class="text-slate-400">Sem programação</small>'}</div></section>`;
    }).join('');

    const list = document.getElementById('unscheduled-list');
    list.innerHTML = unscheduled.map(([id, order]) => `<article class="s3-list-item"><div class="s3-list-item__top"><div><h4>${escapeHtml(order.title || 'O.S. sem título')}</h4><p>${escapeHtml(assets[order.assetId]?.name || order.assetName || 'Sem ativo vinculado')}</p></div>${priorityBadge(order.priority)}</div><div class="s3-meta"><span>${orderStatusBadge(order.status)}</span><span><i class="fas fa-calendar" aria-hidden="true"></i> SLA ${formatDateTime(order.dueAt)}</span></div><div class="s3-actions mt-3"><button type="button" class="s3-btn s3-btn--sm s3-btn--primary" data-schedule-order="${escapeHtml(id)}"><i class="fas fa-calendar-plus" aria-hidden="true"></i>Programar</button><a class="s3-btn s3-btn--sm" href="os-detalhes.html?id=${encodeURIComponent(id)}">Abrir O.S. 360°</a></div></article>`).join('') || emptyState('fa-calendar-check', 'Tudo programado', 'Nenhuma O.S. aberta está aguardando programação.');
}

document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-schedule-order]');
    if (button) openSchedule(button.dataset.scheduleOrder);
});

document.getElementById('open-schedule-dialog').addEventListener('click', () => openSchedule());
document.getElementById('week-prev').addEventListener('click', () => { weekStart = addDays(weekStart, -7); render(); });
document.getElementById('week-next').addEventListener('click', () => { weekStart = addDays(weekStart, 7); render(); });
document.getElementById('week-today').addEventListener('click', () => { weekStart = startOfWeek(Date.now()); render(); });

document.getElementById('schedule-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('schedule-submit');
    const orderId = document.getElementById('schedule-order').value;
    const assignedToUid = document.getElementById('schedule-technician').value;
    const scheduledStart = new Date(document.getElementById('schedule-start').value).getTime();
    const scheduledEnd = new Date(document.getElementById('schedule-end').value).getTime();
    const estimatedHours = nonNegative(document.getElementById('schedule-hours').value);
    if (!orderId || !scheduledStart || !scheduledEnd || scheduledEnd <= scheduledStart) return toast('error', 'Revise a O.S. e o intervalo de programação.');
    setButtonBusy(button, true, 'Salvando...');
    try {
        await update(ref(db, `work_orders/${orderId}`), {
            scheduledStart,
            scheduledEnd,
            estimatedHours,
            assignedToUid,
            assignedToName: technicians[assignedToUid]?.name || context.profile.name || 'Responsável',
            scheduleNote: document.getElementById('schedule-note').value.trim(),
            scheduledByUid: context.user.uid,
            scheduledBy: context.profile.name || '',
            updatedAt: Date.now()
        });
        await writeAuditLog({ action: 'schedule', entity: 'work_order', entityId: orderId, description: `O.S. programada para ${formatDateTime(scheduledStart)}.`, metadata: { assignedToUid, scheduledStart, scheduledEnd } });
        closeDialog('schedule-dialog');
        toast('success', 'Programação salva.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível salvar a programação.');
    } finally {
        setButtonBusy(button, false);
    }
});

startProtectedPage('planejamento', (pageContext) => {
    context = pageContext;
    technicians = { [context.user.uid]: { name: context.profile.name, role: context.profile.role } };
    onValue(ref(db, 'assets'), (snapshot) => { assets = snapshot.val() || {}; render(); });
    onValue(ref(db, 'work_orders'), (snapshot) => { workOrders = snapshot.val() || {}; renderOrderOptions(); render(); });
    if (context.profile.role === 'Administrador') {
        onValue(ref(db, 'users'), (snapshot) => {
            technicians = Object.fromEntries(entries(snapshot.val()).filter(([, user]) => ['Administrador', 'Técnico de Manutenção'].includes(user.role)));
            renderTechnicianOptions();
            render();
        }, () => renderTechnicianOptions());
    } else {
        renderTechnicianOptions();
    }
});
