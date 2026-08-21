import {
    db, ref, onValue, push, set, update, remove, writeAuditLog, escapeHtml, entries, nonNegative,
    mountMaintenanceShell, startProtectedPage, formatDate, formatDateTime, toDateTimeLocal,
    priorityBadge, emptyState, openDialog, wireDialog, closeDialog, toast, setButtonBusy
} from './maintenance-core.js';

mountMaintenanceShell({
    pageId: 'preventiva',
    title: 'Manutenção Preventiva',
    subtitle: 'Planos recorrentes, vencimentos e geração controlada de O.S.',
    headerActions: '<button id="new-plan" type="button" class="s3-btn s3-btn--primary"><i class="fas fa-plus" aria-hidden="true"></i><span class="hidden sm:inline">Novo plano</span></button>',
    content: `
        <div class="s3-page">
            <div class="s3-grid s3-grid--kpi">
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Planos ativos</span><strong id="kpi-active" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-arrows-rotate" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Próximos 7 dias</span><strong id="kpi-next" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-calendar-day" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Planos atrasados</span><strong id="kpi-overdue" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">O.S. preventivas abertas</span><strong id="kpi-orders" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-screwdriver-wrench" aria-hidden="true"></i></span></article>
            </div>
            <div class="s3-toolbar"><div class="s3-toolbar-group"><input id="plan-search" class="s3-input" type="search" placeholder="Buscar plano ou ativo" aria-label="Buscar planos"><select id="plan-filter" class="s3-input" aria-label="Filtrar planos"><option value="all">Todos</option><option value="due">Próximos</option><option value="overdue">Atrasados</option><option value="inactive">Inativos</option></select></div><div class="s3-toolbar-group"><a href="planejamento.html" class="s3-btn s3-btn--sm"><i class="fas fa-calendar-days" aria-hidden="true"></i>Planejamento</a></div></div>
            <section id="plan-list" class="s3-grid s3-grid--3" aria-live="polite"></section>
        </div>
        <dialog id="plan-dialog" class="s3-dialog" aria-labelledby="plan-dialog-title">
            <form id="plan-form">
                <div class="s3-dialog__head"><h2 id="plan-dialog-title">Novo plano preventivo</h2><button type="button" class="s3-btn s3-btn--sm" data-dialog-close aria-label="Fechar"><i class="fas fa-xmark" aria-hidden="true"></i></button></div>
                <div class="s3-dialog__body s3-form-grid">
                    <div class="s3-field s3-field--wide"><label for="plan-name">Nome do plano</label><input id="plan-name" maxlength="140" required placeholder="Ex.: Inspeção mensal do compressor"></div>
                    <div class="s3-field s3-field--wide"><label for="plan-asset">Ativo</label><select id="plan-asset" required></select></div>
                    <div class="s3-field"><label for="plan-frequency">Periodicidade em dias</label><input id="plan-frequency" type="number" min="1" max="3650" value="30" required></div>
                    <div class="s3-field"><label for="plan-next">Próxima execução</label><input id="plan-next" type="datetime-local" required></div>
                    <div class="s3-field"><label for="plan-priority">Prioridade da O.S.</label><select id="plan-priority"><option value="low">Baixa</option><option value="normal" selected>Normal</option><option value="urgent">Urgente</option><option value="danger">Crítica</option></select></div>
                    <div class="s3-field"><label for="plan-hours">Horas estimadas</label><input id="plan-hours" type="number" min="0.5" max="240" step="0.5" value="2" required></div>
                    <div class="s3-field s3-field--wide"><label for="plan-checklist">Checklist padrão — um item por linha</label><textarea id="plan-checklist" maxlength="1200" placeholder="Verificar nível de óleo&#10;Inspecionar fixações&#10;Registrar temperatura"></textarea></div>
                </div>
                <div class="s3-dialog__foot"><button type="button" class="s3-btn" data-dialog-close>Cancelar</button><button id="plan-submit" type="submit" class="s3-btn s3-btn--primary"><i class="fas fa-floppy-disk" aria-hidden="true"></i>Salvar plano</button></div>
            </form>
        </dialog>`
});

wireDialog('plan-dialog');

let context;
let plans = {};
let assets = {};
let workOrders = {};

function nextCycle(plan) {
    return nonNegative(plan.nextDueAt, Date.now()) + Math.max(1, nonNegative(plan.frequencyDays, 30)) * 86400000;
}

function isDueSoon(plan) {
    const next = nonNegative(plan.nextDueAt);
    return plan.active !== false && next >= Date.now() && next <= Date.now() + 7 * 86400000;
}

function isOverdue(plan) {
    return plan.active !== false && nonNegative(plan.nextDueAt) > 0 && Number(plan.nextDueAt) < Date.now();
}

function renderAssetOptions() {
    document.getElementById('plan-asset').innerHTML = entries(assets).map(([id, asset]) => `<option value="${escapeHtml(id)}">${escapeHtml(asset.name || id)}</option>`).join('') || '<option value="">Cadastre um ativo primeiro</option>';
}

function render() {
    const allPlans = entries(plans);
    const active = allPlans.filter(([, plan]) => plan.active !== false);
    const preventiveOrders = entries(workOrders).filter(([, order]) => order.planId && order.status !== 'done');
    document.getElementById('kpi-active').textContent = active.length;
    document.getElementById('kpi-next').textContent = active.filter(([, plan]) => isDueSoon(plan)).length;
    document.getElementById('kpi-overdue').textContent = active.filter(([, plan]) => isOverdue(plan)).length;
    document.getElementById('kpi-orders').textContent = preventiveOrders.length;

    const term = document.getElementById('plan-search').value.trim().toLowerCase();
    const filter = document.getElementById('plan-filter').value;
    const filtered = allPlans.filter(([, plan]) => {
        const assetName = assets[plan.assetId]?.name || plan.assetName || '';
        const matches = `${plan.name || ''} ${assetName}`.toLowerCase().includes(term);
        if (!matches) return false;
        if (filter === 'due') return isDueSoon(plan);
        if (filter === 'overdue') return isOverdue(plan);
        if (filter === 'inactive') return plan.active === false;
        return true;
    }).sort((a, b) => nonNegative(a[1].nextDueAt, Infinity) - nonNegative(b[1].nextDueAt, Infinity));

    document.getElementById('plan-list').innerHTML = filtered.map(([id, plan]) => {
        const assetName = assets[plan.assetId]?.name || plan.assetName || 'Ativo não encontrado';
        const state = plan.active === false ? '<span class="s3-badge s3-badge--slate">Inativo</span>' : isOverdue(plan) ? '<span class="s3-badge s3-badge--red">Atrasado</span>' : isDueSoon(plan) ? '<span class="s3-badge s3-badge--amber">Próximo</span>' : '<span class="s3-badge s3-badge--green">Em dia</span>';
        const checklistCount = Array.isArray(plan.checklistTemplate) ? plan.checklistTemplate.length : 0;
        return `<article class="s3-card"><div class="s3-card__head"><div><h3>${escapeHtml(plan.name || 'Plano sem nome')}</h3><p><i class="fas fa-industry" aria-hidden="true"></i> ${escapeHtml(assetName)}</p></div>${state}</div><div class="s3-card__body"><div class="s3-chip-row">${priorityBadge(plan.priority)}<span class="s3-badge s3-badge--blue">A cada ${Math.max(1, nonNegative(plan.frequencyDays, 30))} dias</span></div><div class="s3-meta"><span><i class="fas fa-calendar" aria-hidden="true"></i> Próxima: ${formatDateTime(plan.nextDueAt)}</span><span><i class="fas fa-list-check" aria-hidden="true"></i> ${checklistCount} itens</span><span><i class="fas fa-clock" aria-hidden="true"></i> ${nonNegative(plan.estimatedHours, 2)}h</span></div></div><div class="s3-card__foot s3-actions"><button type="button" class="s3-btn s3-btn--sm s3-btn--primary" data-generate-plan="${escapeHtml(id)}" ${plan.active === false ? 'disabled' : ''}><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>Gerar O.S.</button><button type="button" class="s3-btn s3-btn--sm" data-toggle-plan="${escapeHtml(id)}">${plan.active === false ? 'Ativar' : 'Pausar'}</button>${context.profile.role === 'Administrador' ? `<button type="button" class="s3-btn s3-btn--sm s3-btn--danger" data-delete-plan="${escapeHtml(id)}" aria-label="Excluir plano"><i class="fas fa-trash" aria-hidden="true"></i></button>` : ''}</div></article>`;
    }).join('') || emptyState('fa-arrows-rotate', 'Nenhum plano encontrado', 'Crie o primeiro plano preventivo ou altere os filtros.');
}

async function generateWorkOrder(planId) {
    const plan = plans[planId];
    if (!plan || plan.active === false) return;
    const cycleDueAt = nonNegative(plan.nextDueAt, Date.now());
    if (Number(plan.lastGeneratedFor) === cycleDueAt) return toast('warning', 'A O.S. deste ciclo já foi gerada.');
    const assetName = assets[plan.assetId]?.name || plan.assetName || '';
    try {
        const orderRef = await push(ref(db, 'work_orders'), {
            title: plan.name,
            type: 'Preventiva',
            priority: plan.priority || 'normal',
            assetId: plan.assetId || '',
            assetName,
            estimatedHours: nonNegative(plan.estimatedHours, 2),
            estimatedCost: 0,
            downtimeHours: 0,
            dueAt: cycleDueAt,
            status: 'todo',
            planId,
            planCycleDueAt: cycleDueAt,
            createdAt: Date.now(),
            createdBy: context.profile.name || '',
            createdByUid: context.user.uid
        });
        const checklist = Array.isArray(plan.checklistTemplate) ? plan.checklistTemplate : [];
        for (const title of checklist) {
            await push(ref(db, `work_order_checklists/${orderRef.key}`), { title, done: false, createdAt: Date.now(), createdByUid: context.user.uid });
        }
        await update(ref(db, `maintenance_plans/${planId}`), { lastGeneratedAt: Date.now(), lastGeneratedFor: cycleDueAt, lastWorkOrderId: orderRef.key, nextDueAt: nextCycle(plan), updatedAt: Date.now(), updatedByUid: context.user.uid });
        await writeAuditLog({ action: 'generate', entity: 'maintenance_plan', entityId: planId, description: `Plano ${plan.name} gerou uma O.S. preventiva.`, metadata: { workOrderId: orderRef.key, cycleDueAt } });
        toast('success', 'O.S. preventiva gerada e próximo ciclo calculado.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível gerar a O.S. preventiva.');
    }
}

document.getElementById('new-plan').addEventListener('click', () => {
    document.getElementById('plan-form').reset();
    document.getElementById('plan-frequency').value = 30;
    document.getElementById('plan-hours').value = 2;
    document.getElementById('plan-next').value = toDateTimeLocal(Date.now() + 7 * 86400000);
    renderAssetOptions();
    openDialog('plan-dialog');
});
document.getElementById('plan-search').addEventListener('input', render);
document.getElementById('plan-filter').addEventListener('change', render);

document.addEventListener('click', async (event) => {
    const generate = event.target.closest('[data-generate-plan]');
    if (generate) return generateWorkOrder(generate.dataset.generatePlan);
    const toggle = event.target.closest('[data-toggle-plan]');
    if (toggle) {
        const plan = plans[toggle.dataset.togglePlan];
        await update(ref(db, `maintenance_plans/${toggle.dataset.togglePlan}`), { active: plan?.active === false, updatedAt: Date.now(), updatedByUid: context.user.uid });
        await writeAuditLog({ action: 'status', entity: 'maintenance_plan', entityId: toggle.dataset.togglePlan, description: `Plano ${plan?.active === false ? 'ativado' : 'pausado'}.` });
        return;
    }
    const removeButton = event.target.closest('[data-delete-plan]');
    if (removeButton && context.profile.role === 'Administrador' && window.confirm('Excluir este plano preventivo? O histórico das O.S. será mantido.')) {
        await remove(ref(db, `maintenance_plans/${removeButton.dataset.deletePlan}`));
        await writeAuditLog({ action: 'delete', entity: 'maintenance_plan', entityId: removeButton.dataset.deletePlan, description: 'Plano preventivo removido.' });
        toast('warning', 'Plano removido.');
    }
});

document.getElementById('plan-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('plan-submit');
    const assetId = document.getElementById('plan-asset').value;
    const name = document.getElementById('plan-name').value.trim();
    const nextDueAt = new Date(document.getElementById('plan-next').value).getTime();
    if (!name || !assetId || !nextDueAt) return toast('error', 'Preencha nome, ativo e próxima execução.');
    const checklistTemplate = document.getElementById('plan-checklist').value.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 30);
    setButtonBusy(button, true, 'Salvando...');
    try {
        const created = await push(ref(db, 'maintenance_plans'), {
            name,
            assetId,
            assetName: assets[assetId]?.name || '',
            frequencyDays: Math.max(1, nonNegative(document.getElementById('plan-frequency').value, 30)),
            nextDueAt,
            priority: document.getElementById('plan-priority').value,
            estimatedHours: Math.max(.5, nonNegative(document.getElementById('plan-hours').value, 2)),
            checklistTemplate,
            active: true,
            createdAt: Date.now(),
            createdBy: context.profile.name || '',
            createdByUid: context.user.uid
        });
        await writeAuditLog({ action: 'create', entity: 'maintenance_plan', entityId: created.key, description: `Plano preventivo ${name} criado.`, metadata: { assetId, nextDueAt } });
        closeDialog('plan-dialog');
        toast('success', 'Plano preventivo criado.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível salvar o plano.');
    } finally {
        setButtonBusy(button, false);
    }
});

startProtectedPage('preventiva', (pageContext) => {
    context = pageContext;
    onValue(ref(db, 'assets'), (snapshot) => { assets = snapshot.val() || {}; renderAssetOptions(); render(); });
    onValue(ref(db, 'maintenance_plans'), (snapshot) => { plans = snapshot.val() || {}; render(); });
    onValue(ref(db, 'work_orders'), (snapshot) => { workOrders = snapshot.val() || {}; render(); });
});
