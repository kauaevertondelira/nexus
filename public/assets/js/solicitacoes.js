import {
    db, ref, onValue, push, update, writeAuditLog, escapeHtml, entries,
    mountMaintenanceShell, startProtectedPage, formatDateTime, requestStatusBadge,
    priorityBadge, emptyState, openDialog, wireDialog, closeDialog, toast, setButtonBusy
} from './maintenance-core.js';

mountMaintenanceShell({
    pageId: 'solicitacoes',
    title: 'Solicitações de Manutenção',
    subtitle: 'Comunicação de problemas, triagem e conversão em Ordem de Serviço',
    headerActions: '<button id="new-request" type="button" class="s3-btn s3-btn--primary"><i class="fas fa-plus" aria-hidden="true"></i><span class="hidden sm:inline">Nova solicitação</span></button>',
    content: `
        <div class="s3-page">
            <div class="s3-grid s3-grid--kpi">
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Novas</span><strong id="kpi-new" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-bell" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Convertidas em O.S.</span><strong id="kpi-converted" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-arrow-right-arrow-left" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Alta ou crítica</span><strong id="kpi-critical" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Minhas solicitações</span><strong id="kpi-mine" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-user" aria-hidden="true"></i></span></article>
            </div>
            <div class="s3-toolbar"><div class="s3-toolbar-group"><input id="request-search" class="s3-input" type="search" placeholder="Buscar solicitação, ativo ou solicitante" aria-label="Buscar solicitações"><select id="request-filter" class="s3-input" aria-label="Filtrar status"><option value="all">Todos os status</option><option value="new">Novas</option><option value="converted">Convertidas</option><option value="rejected">Rejeitadas</option><option value="mine">Criadas por mim</option></select></div><div class="s3-toolbar-group"><a href="os.html" class="s3-btn s3-btn--sm"><i class="fas fa-clipboard-list" aria-hidden="true"></i>Ver O.S.</a></div></div>
            <section id="request-list" class="s3-grid s3-grid--2" aria-live="polite"></section>
        </div>
        <dialog id="request-dialog" class="s3-dialog" aria-labelledby="request-dialog-title">
            <form id="request-form">
                <div class="s3-dialog__head"><h2 id="request-dialog-title">Nova solicitação</h2><button type="button" class="s3-btn s3-btn--sm" data-dialog-close aria-label="Fechar"><i class="fas fa-xmark" aria-hidden="true"></i></button></div>
                <div class="s3-dialog__body s3-form-grid">
                    <div class="s3-field s3-field--wide"><label for="request-title">Título do problema</label><input id="request-title" maxlength="160" required placeholder="Ex.: Ruído incomum no motor"></div>
                    <div class="s3-field s3-field--wide"><label for="request-asset">Ativo relacionado</label><select id="request-asset"><option value="">Sem ativo definido</option></select></div>
                    <div class="s3-field"><label for="request-priority">Urgência percebida</label><select id="request-priority"><option value="low">Baixa</option><option value="normal" selected>Normal</option><option value="urgent">Urgente</option><option value="danger">Crítica</option></select></div>
                    <div class="s3-field"><label for="request-area">Área solicitante</label><input id="request-area" maxlength="80" placeholder="Ex.: Produção A"></div>
                    <div class="s3-field s3-field--wide"><label for="request-description">Descrição</label><textarea id="request-description" maxlength="1200" required placeholder="Informe o que ocorreu, quando começou e o impacto observado."></textarea></div>
                </div>
                <div class="s3-dialog__foot"><button type="button" class="s3-btn" data-dialog-close>Cancelar</button><button id="request-submit" type="submit" class="s3-btn s3-btn--primary"><i class="fas fa-paper-plane" aria-hidden="true"></i>Enviar solicitação</button></div>
            </form>
        </dialog>
        <dialog id="reject-dialog" class="s3-dialog" aria-labelledby="reject-title">
            <form id="reject-form"><div class="s3-dialog__head"><h2 id="reject-title">Rejeitar solicitação</h2><button type="button" class="s3-btn s3-btn--sm" data-dialog-close aria-label="Fechar"><i class="fas fa-xmark" aria-hidden="true"></i></button></div><div class="s3-dialog__body"><input id="reject-request-id" type="hidden"><div class="s3-field"><label for="reject-reason">Justificativa</label><textarea id="reject-reason" minlength="5" maxlength="400" required></textarea></div></div><div class="s3-dialog__foot"><button type="button" class="s3-btn" data-dialog-close>Cancelar</button><button type="submit" class="s3-btn s3-btn--danger">Confirmar rejeição</button></div></form>
        </dialog>`
});

wireDialog('request-dialog');
wireDialog('reject-dialog');

let context;
let requests = {};
let assets = {};

function canTriage() {
    return ['Administrador', 'Técnico de Manutenção'].includes(context.profile.role);
}

function renderAssetOptions() {
    document.getElementById('request-asset').innerHTML = '<option value="">Sem ativo definido</option>' + entries(assets).map(([id, asset]) => `<option value="${escapeHtml(id)}">${escapeHtml(asset.name || id)}</option>`).join('');
}

function render() {
    const all = entries(requests).sort((a, b) => Number(b[1].createdAt || 0) - Number(a[1].createdAt || 0));
    document.getElementById('kpi-new').textContent = all.filter(([, item]) => item.status === 'new').length;
    document.getElementById('kpi-converted').textContent = all.filter(([, item]) => item.status === 'converted').length;
    document.getElementById('kpi-critical').textContent = all.filter(([, item]) => item.status === 'new' && ['urgent', 'danger'].includes(item.priority)).length;
    document.getElementById('kpi-mine').textContent = all.filter(([, item]) => item.requesterUid === context.user.uid).length;

    const term = document.getElementById('request-search').value.trim().toLowerCase();
    const filter = document.getElementById('request-filter').value;
    const filtered = all.filter(([, item]) => {
        const assetName = assets[item.assetId]?.name || item.assetName || '';
        if (!`${item.title || ''} ${item.description || ''} ${assetName} ${item.requesterName || ''}`.toLowerCase().includes(term)) return false;
        if (filter === 'mine') return item.requesterUid === context.user.uid;
        return filter === 'all' || item.status === filter;
    });

    document.getElementById('request-list').innerHTML = filtered.map(([id, item]) => {
        const assetName = assets[item.assetId]?.name || item.assetName || 'Sem ativo definido';
        const triage = canTriage() && item.status === 'new' ? `<button type="button" class="s3-btn s3-btn--sm s3-btn--success" data-convert-request="${escapeHtml(id)}"><i class="fas fa-arrow-right" aria-hidden="true"></i>Converter em O.S.</button><button type="button" class="s3-btn s3-btn--sm s3-btn--danger" data-reject-request="${escapeHtml(id)}">Rejeitar</button>` : '';
        const cancel = item.requesterUid === context.user.uid && item.status === 'new' ? `<button type="button" class="s3-btn s3-btn--sm" data-cancel-request="${escapeHtml(id)}">Cancelar</button>` : '';
        const orderLink = item.convertedWorkOrderId ? `<a class="s3-btn s3-btn--sm" href="os-detalhes.html?id=${encodeURIComponent(item.convertedWorkOrderId)}">Abrir O.S. 360°</a>` : '';
        return `<article class="s3-card"><div class="s3-card__head"><div><h3>${escapeHtml(item.title || 'Solicitação sem título')}</h3><p>${escapeHtml(assetName)}</p></div>${requestStatusBadge(item.status)}</div><div class="s3-card__body"><div class="s3-chip-row">${priorityBadge(item.priority)}${item.area ? `<span class="s3-badge s3-badge--slate">${escapeHtml(item.area)}</span>` : ''}</div><p>${escapeHtml(item.description || 'Sem descrição.')}</p><div class="s3-meta"><span><i class="fas fa-user" aria-hidden="true"></i> ${escapeHtml(item.requesterName || 'Usuário')}</span><span><i class="fas fa-clock" aria-hidden="true"></i> ${formatDateTime(item.createdAt)}</span>${item.decisionReason ? `<span><i class="fas fa-comment" aria-hidden="true"></i> ${escapeHtml(item.decisionReason)}</span>` : ''}</div></div><div class="s3-card__foot s3-actions">${triage}${cancel}${orderLink}</div></article>`;
    }).join('') || emptyState('fa-bullhorn', 'Nenhuma solicitação encontrada', 'Crie uma nova solicitação ou altere os filtros.');
}

async function convertToOrder(requestId) {
    const item = requests[requestId];
    if (!item || item.status !== 'new' || !canTriage()) return;
    try {
        const created = await push(ref(db, 'work_orders'), {
            title: item.title,
            type: 'Corretiva',
            priority: item.priority || 'normal',
            assetId: item.assetId || '',
            assetName: assets[item.assetId]?.name || item.assetName || '',
            requestId,
            requestDescription: item.description || '',
            estimatedCost: 0,
            downtimeHours: 0,
            dueAt: Date.now() + ({ danger: 4, urgent: 12, normal: 72, low: 168 }[item.priority] || 72) * 3600000,
            status: 'todo',
            createdAt: Date.now(),
            createdBy: context.profile.name || '',
            createdByUid: context.user.uid
        });
        await update(ref(db, `maintenance_requests/${requestId}`), { status: 'converted', convertedWorkOrderId: created.key, decidedAt: Date.now(), decidedByUid: context.user.uid, decidedBy: context.profile.name || '' });
        await writeAuditLog({ action: 'convert', entity: 'maintenance_request', entityId: requestId, description: `Solicitação convertida em O.S. ${created.key}.`, metadata: { workOrderId: created.key } });
        toast('success', 'Solicitação convertida em O.S.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível converter a solicitação.');
    }
}

document.getElementById('new-request').addEventListener('click', () => { document.getElementById('request-form').reset(); renderAssetOptions(); openDialog('request-dialog'); });
document.getElementById('request-search').addEventListener('input', render);
document.getElementById('request-filter').addEventListener('change', render);

document.addEventListener('click', async (event) => {
    const convert = event.target.closest('[data-convert-request]');
    if (convert) return convertToOrder(convert.dataset.convertRequest);
    const reject = event.target.closest('[data-reject-request]');
    if (reject) {
        document.getElementById('reject-request-id').value = reject.dataset.rejectRequest;
        document.getElementById('reject-reason').value = '';
        return openDialog('reject-dialog');
    }
    const cancel = event.target.closest('[data-cancel-request]');
    if (cancel && window.confirm('Cancelar esta solicitação?')) {
        await update(ref(db, `maintenance_requests/${cancel.dataset.cancelRequest}`), { status: 'cancelled', cancelledAt: Date.now(), cancelledByUid: context.user.uid });
        await writeAuditLog({ action: 'cancel', entity: 'maintenance_request', entityId: cancel.dataset.cancelRequest, description: 'Solicitação cancelada pelo autor.' });
        toast('warning', 'Solicitação cancelada.');
    }
});

document.getElementById('request-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('request-submit');
    const title = document.getElementById('request-title').value.trim();
    const description = document.getElementById('request-description').value.trim();
    if (!title || description.length < 5) return toast('error', 'Informe um título e uma descrição mais completa.');
    setButtonBusy(button, true, 'Enviando...');
    try {
        const assetId = document.getElementById('request-asset').value;
        const created = await push(ref(db, 'maintenance_requests'), {
            title,
            description,
            assetId,
            assetName: assets[assetId]?.name || '',
            priority: document.getElementById('request-priority').value,
            area: document.getElementById('request-area').value.trim(),
            status: 'new',
            requesterUid: context.user.uid,
            requesterName: context.profile.name || context.user.email || '',
            requesterRole: context.profile.role || '',
            createdAt: Date.now()
        });
        await writeAuditLog({ action: 'create', entity: 'maintenance_request', entityId: created.key, description: `Solicitação ${title} criada.`, metadata: { assetId } });
        closeDialog('request-dialog');
        toast('success', 'Solicitação enviada para triagem.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível enviar a solicitação.');
    } finally {
        setButtonBusy(button, false);
    }
});

document.getElementById('reject-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('reject-request-id').value;
    const decisionReason = document.getElementById('reject-reason').value.trim();
    if (!id || decisionReason.length < 5 || !canTriage()) return;
    try {
        await update(ref(db, `maintenance_requests/${id}`), { status: 'rejected', decisionReason, decidedAt: Date.now(), decidedByUid: context.user.uid, decidedBy: context.profile.name || '' });
        await writeAuditLog({ action: 'reject', entity: 'maintenance_request', entityId: id, description: 'Solicitação rejeitada na triagem.', metadata: { decisionReason } });
        closeDialog('reject-dialog');
        toast('warning', 'Solicitação rejeitada com justificativa.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível rejeitar a solicitação.');
    }
});

startProtectedPage('solicitacoes', (pageContext) => {
    context = pageContext;
    onValue(ref(db, 'assets'), (snapshot) => { assets = snapshot.val() || {}; renderAssetOptions(); render(); });
    onValue(ref(db, 'maintenance_requests'), (snapshot) => { requests = snapshot.val() || {}; render(); });
});
