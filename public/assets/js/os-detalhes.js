import {
    db, ref, onValue, push, update, remove, writeAuditLog, escapeHtml, entries, nonNegative, formatCurrency,
    mountMaintenanceShell, startProtectedPage, formatDateTime, orderStatusBadge, priorityBadge,
    emptyState, openDialog, wireDialog, closeDialog, toast
} from './maintenance-core.js';

mountMaintenanceShell({
    pageId: 'os-detalhes',
    title: 'Ordem de Serviço 360°',
    subtitle: 'Execução, evidências, custos e rastreabilidade em uma única tela',
    headerActions: '<a href="os.html" class="s3-btn"><i class="fas fa-arrow-left" aria-hidden="true"></i><span class="hidden sm:inline">Voltar ao Kanban</span></a>',
    content: `
        <div class="s3-page">
            <section id="order-hero" class="s3-hero" aria-live="polite"></section>
            <div class="s3-grid s3-grid--kpi">
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Progresso do checklist</span><strong id="kpi-progress" class="s3-kpi__value">0%</strong></div><span class="s3-kpi__icon"><i class="fas fa-list-check" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Horas registradas</span><strong id="kpi-hours" class="s3-kpi__value">0h</strong></div><span class="s3-kpi__icon"><i class="fas fa-clock" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Custo de materiais</span><strong id="kpi-parts" class="s3-kpi__value">R$ 0</strong></div><span class="s3-kpi__icon"><i class="fas fa-box-open" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Custo total estimado</span><strong id="kpi-total" class="s3-kpi__value">R$ 0</strong></div><span class="s3-kpi__icon"><i class="fas fa-coins" aria-hidden="true"></i></span></article>
            </div>
            <div class="s3-tabs" role="tablist" aria-label="Seções da Ordem de Serviço">
                <button type="button" role="tab" aria-selected="true" data-order-tab="summary"><i class="fas fa-circle-info" aria-hidden="true"></i> Resumo</button>
                <button type="button" role="tab" aria-selected="false" data-order-tab="checklist"><i class="fas fa-list-check" aria-hidden="true"></i> Checklist</button>
                <button type="button" role="tab" aria-selected="false" data-order-tab="time"><i class="fas fa-user-clock" aria-hidden="true"></i> Tempo</button>
                <button type="button" role="tab" aria-selected="false" data-order-tab="parts"><i class="fas fa-box-open" aria-hidden="true"></i> Peças e custos</button>
                <button type="button" role="tab" aria-selected="false" data-order-tab="notes"><i class="fas fa-comments" aria-hidden="true"></i> Comentários</button>
                <button type="button" role="tab" aria-selected="false" data-order-tab="history"><i class="fas fa-clock-rotate-left" aria-hidden="true"></i> Histórico</button>
            </div>
            <div class="mt-4">
                <section id="tab-summary" class="s3-tab-panel" role="tabpanel"><div class="s3-grid s3-grid--2"><article class="s3-card"><div class="s3-card__head"><div><h3>Dados da O.S.</h3><p>Informações operacionais e programação.</p></div></div><div id="order-summary" class="s3-card__body"></div></article><article class="s3-card"><div class="s3-card__head"><div><h3>Ações rápidas</h3><p>As alterações ficam registradas no histórico.</p></div></div><div id="order-actions" class="s3-card__body s3-actions flex-wrap"></div></article></div></section>
                <section id="tab-checklist" class="s3-tab-panel" role="tabpanel" hidden><article class="s3-card"><div class="s3-card__head"><div><h3>Checklist de execução</h3><p>Todos os itens são rastreados por usuário e horário.</p></div></div><div class="s3-card__body"><form id="checklist-form" class="s3-toolbar"><input id="checklist-title" class="s3-input" maxlength="180" required placeholder="Adicionar nova atividade"><button class="s3-btn s3-btn--primary" type="submit"><i class="fas fa-plus" aria-hidden="true"></i>Adicionar</button></form><div id="checklist-list" class="s3-list" aria-live="polite"></div></div></article></section>
                <section id="tab-time" class="s3-tab-panel" role="tabpanel" hidden><div class="s3-grid s3-grid--2"><article class="s3-card"><div class="s3-card__head"><div><h3>Adicionar apontamento</h3><p>Registre horas manuais ou use o cronômetro do Espaço do Técnico.</p></div></div><form id="time-form" class="s3-card__body s3-form-grid"><div class="s3-field"><label for="time-hours">Horas</label><input id="time-hours" type="number" min="0.1" max="24" step="0.1" required></div><div class="s3-field"><label for="time-date">Data</label><input id="time-date" type="date" required></div><div class="s3-field s3-field--wide"><label for="time-note">Atividade realizada</label><input id="time-note" maxlength="240" required></div><div class="s3-field--wide"><button class="s3-btn s3-btn--primary" type="submit">Registrar horas</button></div></form></article><article class="s3-card"><div class="s3-card__head"><div><h3>Apontamentos</h3><p>Histórico de mão de obra.</p></div></div><div id="time-list" class="s3-card__body s3-list" aria-live="polite"></div></article></div></section>
                <section id="tab-parts" class="s3-tab-panel" role="tabpanel" hidden><div class="s3-grid s3-grid--2"><article class="s3-card"><div class="s3-card__head"><div><h3>Registrar material</h3><p>Nesta etapa o registro não altera automaticamente o estoque.</p></div></div><form id="part-form" class="s3-card__body s3-form-grid"><div class="s3-field s3-field--wide"><label for="part-name">Peça ou material</label><input id="part-name" maxlength="160" required></div><div class="s3-field"><label for="part-qty">Quantidade</label><input id="part-qty" type="number" min="0.01" max="99999" step="0.01" value="1" required></div><div class="s3-field"><label for="part-price">Valor unitário</label><input id="part-price" type="number" min="0" step="0.01" value="0" required></div><div class="s3-field--wide"><button class="s3-btn s3-btn--primary" type="submit">Adicionar material</button></div></form></article><article class="s3-card"><div class="s3-card__head"><div><h3>Materiais utilizados</h3><p>Consolidação de quantidades e custos.</p></div></div><div id="part-list" class="s3-card__body s3-list" aria-live="polite"></div></article></div></section>
                <section id="tab-notes" class="s3-tab-panel" role="tabpanel" hidden><div class="s3-grid s3-grid--2"><article class="s3-card"><div class="s3-card__head"><div><h3>Novo comentário</h3><p>Comunique decisões e observações da execução.</p></div></div><form id="comment-form" class="s3-card__body s3-form-grid"><div class="s3-field s3-field--wide"><label for="comment-text">Comentário</label><textarea id="comment-text" maxlength="800" required></textarea></div><div class="s3-field"><label for="comment-link">Link de evidência</label><input id="comment-link" type="url" maxlength="500" placeholder="https://..."></div><div class="s3-field"><label for="comment-link-label">Nome do anexo</label><input id="comment-link-label" maxlength="100" placeholder="Foto, manual ou relatório"></div><div class="s3-field--wide"><button class="s3-btn s3-btn--primary" type="submit">Publicar comentário</button></div></form></article><article class="s3-card"><div class="s3-card__head"><div><h3>Linha de comunicação</h3><p>Comentários e evidências vinculadas.</p></div></div><div id="comment-list" class="s3-card__body s3-list" aria-live="polite"></div></article></div></section>
                <section id="tab-history" class="s3-tab-panel" role="tabpanel" hidden><article class="s3-card"><div class="s3-card__head"><div><h3>Histórico operacional</h3><p>Eventos registrados especificamente nesta O.S.</p></div></div><div id="activity-list" class="s3-card__body s3-list" aria-live="polite"></div></article></section>
            </div>
        </div>
        <dialog id="complete-dialog" class="s3-dialog" aria-labelledby="complete-title"><form id="complete-form"><div class="s3-dialog__head"><h2 id="complete-title">Concluir Ordem de Serviço</h2><button type="button" class="s3-btn s3-btn--sm" data-dialog-close aria-label="Fechar"><i class="fas fa-xmark" aria-hidden="true"></i></button></div><div class="s3-dialog__body"><div class="s3-field"><label for="completion-note">Resumo do serviço e testes realizados</label><textarea id="completion-note" minlength="5" maxlength="300" required></textarea></div></div><div class="s3-dialog__foot"><button type="button" class="s3-btn" data-dialog-close>Cancelar</button><button type="submit" class="s3-btn s3-btn--success">Concluir e aprovar</button></div></form></dialog>`
});

wireDialog('complete-dialog');

const orderId = (new URLSearchParams(window.location.search).get('id') || '').trim();
const validOrderId = /^[A-Za-z0-9_-]{3,120}$/.test(orderId);
let context;
let order;
let assets = {};
let checklist = {};
let timeEntries = {};
let parts = {};
let comments = {};
let activities = {};

function canExecute() {
    return ['Administrador', 'Técnico de Manutenção'].includes(context?.profile?.role);
}

function safeExternalLink(value) {
    try {
        const url = new URL(String(value || ''));
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (error) {
        return '';
    }
}

function activity(action, description, metadata = {}) {
    return push(ref(db, `work_order_activity/${orderId}`), { action, description, metadata, createdAt: Date.now(), createdByUid: context.user.uid, createdBy: context.profile.name || '' });
}

function elapsedMs() {
    const accumulated = nonNegative(order?.accumulatedMs);
    return order?.timerStartedAt ? accumulated + Math.max(0, Date.now() - Number(order.timerStartedAt)) : accumulated;
}

function render() {
    if (!validOrderId) {
        document.getElementById('maintenance-content').innerHTML = `<div class="s3-page">${emptyState('fa-link-slash', 'O.S. não informada', 'Abra esta tela pelo Kanban, Planejamento ou Espaço do Técnico.')}</div>`;
        return;
    }
    if (!order) {
        document.getElementById('order-hero').innerHTML = emptyState('fa-spinner fa-spin', 'Carregando O.S.', 'Consultando os dados da ordem de serviço.');
        return;
    }
    const assetName = assets[order.assetId]?.name || order.assetName || 'Sem ativo vinculado';
    const checklistItems = entries(checklist);
    const checklistDone = checklistItems.filter(([, item]) => item.done).length;
    const progress = checklistItems.length ? Math.round(checklistDone / checklistItems.length * 100) : 0;
    const manualHours = entries(timeEntries).reduce((sum, [, item]) => sum + nonNegative(item.hours), 0);
    const timerHours = elapsedMs() / 3600000;
    const totalHours = manualHours + timerHours;
    const partCost = entries(parts).reduce((sum, [, item]) => sum + nonNegative(item.qty) * nonNegative(item.unitPrice), 0);
    const totalCost = nonNegative(order.estimatedCost) + partCost;
    document.getElementById('kpi-progress').textContent = `${progress}%`;
    document.getElementById('kpi-hours').textContent = `${totalHours.toFixed(1)}h`;
    document.getElementById('kpi-parts').textContent = formatCurrency(partCost);
    document.getElementById('kpi-total').textContent = formatCurrency(totalCost);

    document.getElementById('order-hero').innerHTML = `<div><div class="s3-chip-row">${orderStatusBadge(order.status)}${priorityBadge(order.priority)}<span class="s3-badge s3-badge--blue">#OS-${escapeHtml(orderId.slice(-6).toUpperCase())}</span></div><h2 class="mt-3">${escapeHtml(order.title || 'O.S. sem título')}</h2><p><i class="fas fa-industry" aria-hidden="true"></i> ${escapeHtml(assetName)} · ${escapeHtml(order.type || 'Tipo não informado')}</p></div><div class="text-right"><small class="s3-label">Responsável</small><strong class="block mt-1">${escapeHtml(order.assignedToName || 'Não atribuído')}</strong><small class="text-slate-500">SLA ${formatDateTime(order.dueAt)}</small></div>`;

    document.getElementById('order-summary').innerHTML = `<dl class="s3-grid s3-grid--2"><div><dt class="s3-label">Criada por</dt><dd>${escapeHtml(order.createdBy || 'Sistema')}<br><small>${formatDateTime(order.createdAt)}</small></dd></div><div><dt class="s3-label">Programação</dt><dd>${order.scheduledStart ? `${formatDateTime(order.scheduledStart)} até ${formatDateTime(order.scheduledEnd)}` : 'Não programada'}</dd></div><div><dt class="s3-label">Horas estimadas</dt><dd>${nonNegative(order.estimatedHours, 0)}h</dd></div><div><dt class="s3-label">Parada estimada</dt><dd>${nonNegative(order.downtimeHours, 0)}h</dd></div><div class="s3-field--wide"><dt class="s3-label">Origem</dt><dd>${order.planId ? 'Plano preventivo' : order.requestId ? 'Solicitação de manutenção' : 'Criação manual'}</dd></div>${order.requestDescription ? `<div class="s3-field--wide"><dt class="s3-label">Descrição da solicitação</dt><dd>${escapeHtml(order.requestDescription)}</dd></div>` : ''}${order.completionNote ? `<div class="s3-field--wide"><dt class="s3-label">Conclusão aprovada</dt><dd>${escapeHtml(order.completionNote)}<br><small>${escapeHtml(order.approvedBy || '')} · ${formatDateTime(order.approvedAt)}</small></dd></div>` : ''}</dl>`;

    const assigned = order.assignedToUid === context.user.uid;
    const executionActions = canExecute() ? `${!order.assignedToUid && order.status !== 'done' ? '<button type="button" class="s3-btn s3-btn--primary" data-order-action="claim"><i class="fas fa-hand" aria-hidden="true"></i>Assumir O.S.</button>' : ''}${order.status === 'todo' ? '<button type="button" class="s3-btn s3-btn--success" data-order-action="start"><i class="fas fa-play" aria-hidden="true"></i>Iniciar execução</button>' : ''}${order.status === 'doing' ? '<button type="button" class="s3-btn" data-order-action="pause"><i class="fas fa-pause" aria-hidden="true"></i>Pausar</button><button type="button" class="s3-btn s3-btn--success" data-order-action="complete"><i class="fas fa-check" aria-hidden="true"></i>Concluir</button>' : ''}<a class="s3-btn" href="planejamento.html"><i class="fas fa-calendar-days" aria-hidden="true"></i>Planejamento</a>${assigned ? '<a class="s3-btn" href="tecnico.html"><i class="fas fa-stopwatch" aria-hidden="true"></i>Espaço do Técnico</a>' : ''}` : '<p class="text-slate-500">Seu cargo pode consultar a O.S., registrar materiais e publicar comentários. A execução técnica permanece restrita à Manutenção.</p>';
    document.getElementById('order-actions').innerHTML = executionActions;
    document.getElementById('checklist-form').hidden = !canExecute();
    document.getElementById('time-form').hidden = !canExecute();

    document.getElementById('checklist-list').innerHTML = checklistItems.map(([id, item]) => `<article class="s3-list-item"><div class="s3-list-item__top"><label class="s3-row"><input type="checkbox" data-checklist-toggle="${escapeHtml(id)}" ${item.done ? 'checked' : ''}><span class="${item.done ? 'line-through text-slate-400' : ''}">${escapeHtml(item.title || 'Atividade')}</span></label><button type="button" class="s3-btn s3-btn--sm s3-btn--danger" data-checklist-delete="${escapeHtml(id)}" aria-label="Excluir item"><i class="fas fa-trash" aria-hidden="true"></i></button></div>${item.done ? `<div class="s3-meta"><span>Concluído por ${escapeHtml(item.doneBy || 'usuário')} em ${formatDateTime(item.doneAt)}</span></div>` : ''}</article>`).join('') || emptyState('fa-list-check', 'Checklist vazio', 'Adicione atividades ou gere a O.S. por um plano preventivo.');

    document.getElementById('time-list').innerHTML = entries(timeEntries).sort((a, b) => Number(b[1].createdAt) - Number(a[1].createdAt)).map(([id, item]) => `<article class="s3-list-item"><div class="s3-list-item__top"><div><h4>${nonNegative(item.hours).toFixed(1)}h · ${escapeHtml(item.note || 'Apontamento')}</h4><p>${escapeHtml(item.userName || 'Usuário')} · ${formatDateTime(item.workedAt || item.createdAt)}</p></div><button type="button" class="s3-btn s3-btn--sm s3-btn--danger" data-time-delete="${escapeHtml(id)}" aria-label="Excluir apontamento"><i class="fas fa-trash" aria-hidden="true"></i></button></div></article>`).join('') || emptyState('fa-user-clock', 'Sem apontamentos manuais', 'O cronômetro ainda pode ter horas acumuladas na O.S.');

    document.getElementById('part-list').innerHTML = entries(parts).map(([id, item]) => `<article class="s3-list-item"><div class="s3-list-item__top"><div><h4>${escapeHtml(item.name || 'Material')}</h4><p>${nonNegative(item.qty)} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(nonNegative(item.qty) * nonNegative(item.unitPrice))}</p></div><button type="button" class="s3-btn s3-btn--sm s3-btn--danger" data-part-delete="${escapeHtml(id)}" aria-label="Excluir material"><i class="fas fa-trash" aria-hidden="true"></i></button></div></article>`).join('') || emptyState('fa-box-open', 'Nenhum material registrado', 'Adicione as peças e insumos usados no serviço.');

    document.getElementById('comment-list').innerHTML = entries(comments).sort((a, b) => Number(b[1].createdAt) - Number(a[1].createdAt)).map(([, item]) => { const link = safeExternalLink(item.link); return `<article class="s3-list-item"><div class="s3-list-item__top"><h4>${escapeHtml(item.userName || 'Usuário')}</h4><small>${formatDateTime(item.createdAt)}</small></div><p>${escapeHtml(item.text || '')}</p>${link ? `<div class="s3-actions mt-3"><a class="s3-btn s3-btn--sm" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-paperclip" aria-hidden="true"></i>${escapeHtml(item.linkLabel || 'Abrir evidência')}</a></div>` : ''}</article>`; }).join('') || emptyState('fa-comments', 'Sem comentários', 'Registre decisões e evidências da execução.');

    document.getElementById('activity-list').innerHTML = entries(activities).sort((a, b) => Number(b[1].createdAt) - Number(a[1].createdAt)).map(([, item]) => `<article class="s3-list-item"><div class="s3-list-item__top"><div><h4>${escapeHtml(item.description || item.action || 'Evento')}</h4><p>${escapeHtml(item.createdBy || 'Sistema')}</p></div><small>${formatDateTime(item.createdAt)}</small></div></article>`).join('') || emptyState('fa-clock-rotate-left', 'Histórico ainda vazio', 'Novas ações feitas na O.S. 360° serão registradas aqui.');
}

async function orderAction(action) {
    if (!order || !canExecute()) return;
    try {
        if (action === 'claim') {
            await update(ref(db, `work_orders/${orderId}`), { assignedToUid: context.user.uid, assignedToName: context.profile.name || '', assignedAt: Date.now(), updatedAt: Date.now() });
            await activity('assign', 'O.S. atribuída ao usuário atual.');
        } else if (action === 'start') {
            await update(ref(db, `work_orders/${orderId}`), { status: 'doing', assignedToUid: order.assignedToUid || context.user.uid, assignedToName: order.assignedToName || context.profile.name || '', timerStartedAt: order.timerStartedAt || Date.now(), startedAt: order.startedAt || Date.now(), updatedAt: Date.now() });
            await activity('start', 'Execução iniciada.');
        } else if (action === 'pause') {
            const accumulatedMs = elapsedMs();
            await update(ref(db, `work_orders/${orderId}`), { status: 'todo', accumulatedMs, actualHours: Number((accumulatedMs / 3600000).toFixed(2)), timerStartedAt: null, pausedAt: Date.now(), updatedAt: Date.now() });
            await activity('pause', 'Execução pausada e tempo acumulado salvo.', { accumulatedMs });
        } else if (action === 'complete') {
            document.getElementById('completion-note').value = '';
            return openDialog('complete-dialog');
        }
        await writeAuditLog({ action, entity: 'work_order', entityId: orderId, description: `Ação ${action} realizada na O.S. 360°.` });
        toast('success', 'O.S. atualizada.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível atualizar a O.S.');
    }
}

document.querySelectorAll('[data-order-tab]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-order-tab]').forEach((tab) => tab.setAttribute('aria-selected', String(tab === button)));
    document.querySelectorAll('.s3-tab-panel').forEach((panel) => { panel.hidden = panel.id !== `tab-${button.dataset.orderTab}`; });
}));

document.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-order-action]');
    if (action) return orderAction(action.dataset.orderAction);
    const removeChecklist = event.target.closest('[data-checklist-delete]');
    if (removeChecklist && canExecute() && window.confirm('Excluir este item do checklist?')) return remove(ref(db, `work_order_checklists/${orderId}/${removeChecklist.dataset.checklistDelete}`));
    const removeTime = event.target.closest('[data-time-delete]');
    if (removeTime && canExecute() && window.confirm('Excluir este apontamento?')) return remove(ref(db, `work_order_time_entries/${orderId}/${removeTime.dataset.timeDelete}`));
    const removePart = event.target.closest('[data-part-delete]');
    if (removePart && window.confirm('Excluir este material?')) return remove(ref(db, `work_order_parts/${orderId}/${removePart.dataset.partDelete}`));
});

document.addEventListener('change', async (event) => {
    const toggle = event.target.closest('[data-checklist-toggle]');
    if (!toggle || !canExecute()) return;
    const done = toggle.checked;
    await update(ref(db, `work_order_checklists/${orderId}/${toggle.dataset.checklistToggle}`), { done, doneAt: done ? Date.now() : null, doneByUid: done ? context.user.uid : null, doneBy: done ? context.profile.name || '' : null });
    await activity('checklist', `${done ? 'Concluído' : 'Reaberto'}: ${checklist[toggle.dataset.checklistToggle]?.title || 'item do checklist'}.`);
});

document.getElementById('checklist-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canExecute()) return;
    const title = document.getElementById('checklist-title').value.trim();
    if (!title) return;
    await push(ref(db, `work_order_checklists/${orderId}`), { title, done: false, createdAt: Date.now(), createdByUid: context.user.uid, createdBy: context.profile.name || '' });
    await activity('checklist', `Item adicionado: ${title}.`);
    event.target.reset();
});

document.getElementById('time-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canExecute()) return;
    const hours = nonNegative(document.getElementById('time-hours').value);
    const note = document.getElementById('time-note').value.trim();
    const workedAt = new Date(`${document.getElementById('time-date').value}T12:00:00`).getTime();
    if (!hours || !note || !workedAt) return toast('error', 'Preencha horas, data e atividade.');
    await push(ref(db, `work_order_time_entries/${orderId}`), { hours, note, workedAt, createdAt: Date.now(), userUid: context.user.uid, userName: context.profile.name || '' });
    await activity('time', `${hours.toFixed(1)}h registradas: ${note}.`);
    event.target.reset();
    document.getElementById('time-date').valueAsDate = new Date();
    toast('success', 'Horas registradas.');
});

document.getElementById('part-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.getElementById('part-name').value.trim();
    const qty = nonNegative(document.getElementById('part-qty').value);
    const unitPrice = nonNegative(document.getElementById('part-price').value);
    if (!name || !qty) return toast('error', 'Informe o material e a quantidade.');
    await push(ref(db, `work_order_parts/${orderId}`), { name, qty, unitPrice, createdAt: Date.now(), createdByUid: context.user.uid, createdBy: context.profile.name || '' });
    await activity('part', `Material registrado: ${qty} × ${name}.`, { qty, unitPrice });
    event.target.reset();
    document.getElementById('part-qty').value = 1;
    document.getElementById('part-price').value = 0;
    toast('success', 'Material adicionado à O.S.');
});

document.getElementById('comment-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = document.getElementById('comment-text').value.trim();
    const rawLink = document.getElementById('comment-link').value.trim();
    const link = rawLink ? safeExternalLink(rawLink) : '';
    if (!text) return;
    if (rawLink && !link) return toast('error', 'Use somente links iniciados por http:// ou https://.');
    await push(ref(db, `work_order_comments/${orderId}`), { text, link, linkLabel: document.getElementById('comment-link-label').value.trim(), createdAt: Date.now(), userUid: context.user.uid, userName: context.profile.name || '' });
    await activity('comment', 'Novo comentário registrado na O.S.');
    event.target.reset();
    toast('success', 'Comentário publicado.');
});

document.getElementById('complete-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canExecute()) return;
    const completionNote = document.getElementById('completion-note').value.trim();
    if (completionNote.length < 5) return;
    const approvedAt = Date.now();
    const accumulatedMs = elapsedMs();
    await update(ref(db, `work_orders/${orderId}`), { status: 'done', completionNote, completedAt: approvedAt, approvedAt, approvedBy: context.profile.name || '', approvedByUid: context.user.uid, accumulatedMs, actualHours: Number((accumulatedMs / 3600000).toFixed(2)), timerStartedAt: null, updatedAt: approvedAt, lastUpdatedBy: context.profile.name || '' });
    await activity('complete', 'O.S. concluída e aprovada.', { completionNote });
    await writeAuditLog({ action: 'approve', entity: 'work_order', entityId: orderId, description: 'O.S. concluída e aprovada na visão 360°.' });
    closeDialog('complete-dialog');
    toast('success', 'O.S. concluída e aprovada.');
});

startProtectedPage('os-detalhes', (pageContext) => {
    context = pageContext;
    document.getElementById('time-date').valueAsDate = new Date();
    if (!validOrderId) return render();
    onValue(ref(db, 'assets'), (snapshot) => { assets = snapshot.val() || {}; render(); });
    onValue(ref(db, `work_orders/${orderId}`), (snapshot) => { order = snapshot.val(); if (!order) document.getElementById('maintenance-content').innerHTML = `<div class="s3-page">${emptyState('fa-circle-xmark', 'O.S. não encontrada', 'A ordem pode ter sido removida ou o identificador está incorreto.')}</div>`; else render(); });
    onValue(ref(db, `work_order_checklists/${orderId}`), (snapshot) => { checklist = snapshot.val() || {}; render(); });
    onValue(ref(db, `work_order_time_entries/${orderId}`), (snapshot) => { timeEntries = snapshot.val() || {}; render(); });
    onValue(ref(db, `work_order_parts/${orderId}`), (snapshot) => { parts = snapshot.val() || {}; render(); });
    onValue(ref(db, `work_order_comments/${orderId}`), (snapshot) => { comments = snapshot.val() || {}; render(); });
    onValue(ref(db, `work_order_activity/${orderId}`), (snapshot) => { activities = snapshot.val() || {}; render(); });
    window.setInterval(() => { if (order?.timerStartedAt) render(); }, 1000);
});
