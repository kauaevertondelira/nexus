import {
    db, ref, onValue, push, set, update, increment, serverTimestamp, writeAuditLog,
    escapeHtml, nonNegative, formatCurrency, formatDateTime, mountMaintenanceShell,
    startProtectedPage, emptyState, toast, setButtonBusy
} from './maintenance-core.js';
import { csvCell, downloadFile } from './security-utils.js';

const STATUS = {
    submitted: ['Aguardando aprovação', 's3-badge--amber'], approved: ['Aprovada', 's3-badge--blue'],
    ordered: ['Pedido emitido', 's3-badge--purple'], received: ['Recebida', 's3-badge--green'],
    rejected: ['Rejeitada', 's3-badge--red'], cancelled: ['Cancelada', 's3-badge--slate']
};

mountMaintenanceShell({
    pageId: 'compras', title: 'Compras MRO', subtitle: 'Requisições, aprovação, pedido e recebimento integrado ao estoque',
    headerActions: '<button id="purchase-export" type="button" class="s3-btn s3-btn--sm"><i class="fas fa-file-csv" aria-hidden="true"></i><span class="hidden sm:inline">Exportar</span></button>',
    content: `
        <div class="s3-page">
            <div class="s4-notice"><i class="fas fa-shield-halved mt-1" aria-hidden="true"></i><div><strong>Fluxo com separação de responsabilidades</strong><p class="mt-1 text-xs">Qualquer perfil autorizado pode solicitar. Somente o Administrador aprova; Administrador ou Suprimentos emitem o pedido e confirmam o recebimento.</p></div></div>
            <div class="s3-grid s3-grid--kpi mt-4"><article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Aguardando aprovação</span><strong id="purchase-pending" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-hourglass-half" aria-hidden="true"></i></span></article><article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Em compra</span><strong id="purchase-progress" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-truck-ramp-box" aria-hidden="true"></i></span></article><article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Valor em aberto</span><strong id="purchase-open-value" class="s3-kpi__value">R$ 0</strong></div><span class="s3-kpi__icon"><i class="fas fa-coins" aria-hidden="true"></i></span></article><article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Recebidas no mês</span><strong id="purchase-received" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-circle-check" aria-hidden="true"></i></span></article></div>
            <div class="s3-grid s3-grid--2 mt-4 s6-split"><section class="s3-card"><div class="s3-card__head"><div><h3>Nova requisição</h3><p>Solicite peça, material ou serviço para manutenção.</p></div></div><form id="purchase-form" class="s3-card__body s6-form">
                <label>Item do estoque<select id="purchase-inventory" class="s3-input"><option value="">Item avulso / serviço</option></select></label><label>Descrição do item<input id="purchase-item" class="s3-input" maxlength="160" required></label>
                <div class="s6-form-grid"><label>Quantidade<input id="purchase-qty" type="number" class="s3-input" min="0.01" step="0.01" value="1" required></label><label>Custo unitário estimado<input id="purchase-unit-cost" type="number" class="s3-input" min="0" step="0.01" value="0" required></label></div>
                <div class="s6-form-grid"><label>Prioridade<select id="purchase-priority" class="s3-input"><option value="normal">Normal</option><option value="urgent">Urgente</option><option value="danger">Crítica</option><option value="low">Baixa</option></select></label><label>Fornecedor sugerido<select id="purchase-supplier" class="s3-input"><option value="">A definir</option></select></label></div>
                <label>Justificativa<textarea id="purchase-justification" class="s3-input" rows="3" maxlength="500" minlength="5" required></textarea></label><button id="purchase-submit" type="submit" class="s3-btn s3-btn--primary"><i class="fas fa-paper-plane" aria-hidden="true"></i>Enviar para aprovação</button>
            </form></section><section class="s3-card"><div class="s3-card__head"><div><h3>Fluxo de compras</h3><p>Acompanhe o histórico e execute a próxima ação permitida.</p></div></div><div class="s3-card__body"><div class="s3-toolbar mb-4"><div class="s3-toolbar-group w-full"><input id="purchase-search" class="s3-input w-full" type="search" placeholder="Buscar item ou solicitante" aria-label="Buscar compras"><select id="purchase-filter" class="s3-input" aria-label="Situação"><option value="open">Em aberto</option><option value="all">Todas</option>${Object.entries(STATUS).map(([key, data]) => `<option value="${key}">${data[0]}</option>`).join('')}</select></div></div><div id="purchase-list" class="s6-card-list"></div></div></section></div>
        </div>`
});

let requests = {}, suppliers = {}, inventory = {}, users = {}, context = null, currentRows = [];
const field = (id) => document.getElementById(id);
const amount = (item) => nonNegative(item.qty) * nonNegative(item.estimatedUnitCost);
const isAdmin = () => context?.profile.role === 'Administrador';
const isSupply = () => ['Administrador', 'Almoxarifado / Suprimentos'].includes(context?.profile.role);

function populateSelects() {
    const inventorySelect = field('purchase-inventory'); const selectedInventory = inventorySelect.value;
    inventorySelect.innerHTML = '<option value="">Item avulso / serviço</option>' + Object.entries(inventory).sort((a, b) => String(a[1].name || '').localeCompare(String(b[1].name || ''), 'pt-BR')).map(([id, item]) => `<option value="${escapeHtml(id)}">${escapeHtml(item.name || id)} · saldo ${nonNegative(item.qty)}</option>`).join('');
    if (inventory[selectedInventory]) inventorySelect.value = selectedInventory;
    const supplierSelect = field('purchase-supplier'); const selectedSupplier = supplierSelect.value;
    supplierSelect.innerHTML = '<option value="">A definir</option>' + Object.entries(suppliers).filter(([, item]) => item.active !== false).sort((a, b) => String(a[1].name || '').localeCompare(String(b[1].name || ''), 'pt-BR')).map(([id, item]) => `<option value="${escapeHtml(id)}">${escapeHtml(item.name || id)}</option>`).join('');
    if (suppliers[selectedSupplier]) supplierSelect.value = selectedSupplier;
}

function actionButtons(id, item) {
    const buttons = [];
    if (item.status === 'submitted' && isAdmin()) buttons.push(`<button class="s3-btn s3-btn--primary s3-btn--sm" data-action="approve" data-id="${id}">Aprovar</button><button class="s3-btn s3-btn--danger s3-btn--sm" data-action="reject" data-id="${id}">Rejeitar</button>`);
    if (item.status === 'approved' && isSupply()) buttons.push(`<button class="s3-btn s3-btn--primary s3-btn--sm" data-action="order" data-id="${id}">Emitir pedido</button>`);
    if (item.status === 'ordered' && isSupply()) buttons.push(`<button class="s3-btn s3-btn--primary s3-btn--sm" data-action="receive" data-id="${id}">Confirmar recebimento</button>`);
    if (item.status === 'submitted' && item.requesterUid === context?.user.uid) buttons.push(`<button class="s3-btn s3-btn--sm" data-action="cancel" data-id="${id}">Cancelar</button>`);
    return buttons.join('');
}

function render() {
    const rows = Object.entries(requests);
    const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    field('purchase-pending').textContent = rows.filter(([, item]) => item.status === 'submitted').length;
    field('purchase-progress').textContent = rows.filter(([, item]) => ['approved', 'ordered'].includes(item.status)).length;
    field('purchase-open-value').textContent = formatCurrency(rows.filter(([, item]) => ['submitted', 'approved', 'ordered'].includes(item.status)).reduce((sum, [, item]) => sum + amount(item), 0));
    field('purchase-received').textContent = rows.filter(([, item]) => item.status === 'received' && nonNegative(item.receivedAt) >= monthStart).length;
    const search = field('purchase-search').value.trim().toLowerCase(); const filter = field('purchase-filter').value;
    currentRows = rows.filter(([, item]) => {
        const user = users[item.requesterUid] || {}; const matches = `${item.itemName || ''} ${item.justification || ''} ${user.name || ''}`.toLowerCase().includes(search);
        return matches && (filter === 'all' || (filter === 'open' ? ['submitted', 'approved', 'ordered'].includes(item.status) : item.status === filter));
    }).sort((a, b) => nonNegative(b[1].createdAt) - nonNegative(a[1].createdAt));
    field('purchase-list').innerHTML = currentRows.map(([id, item]) => {
        const state = STATUS[item.status] || ['Situação desconhecida', 's3-badge--slate']; const supplier = suppliers[item.supplierId]; const requester = users[item.requesterUid];
        return `<article class="s6-list-card"><div class="min-w-0"><div class="s3-row flex-wrap"><strong class="text-base">${escapeHtml(item.itemName || 'Item')}</strong><span class="s3-badge ${state[1]}">${state[0]}</span><span class="s3-badge ${item.priority === 'danger' ? 's3-badge--red' : item.priority === 'urgent' ? 's3-badge--amber' : 's3-badge--slate'}">${escapeHtml(item.priority || 'normal')}</span></div><p>${nonNegative(item.qty)} × ${formatCurrency(nonNegative(item.estimatedUnitCost))} = <strong>${formatCurrency(amount(item))}</strong></p><small>${escapeHtml(supplier?.name || 'Fornecedor a definir')} · solicitado por ${escapeHtml(requester?.name || item.requesterName || 'Usuário')} em ${formatDateTime(item.createdAt)}</small><p class="mt-2 text-xs">${escapeHtml(item.justification || '')}</p>${item.decisionNote ? `<p class="mt-2 text-xs text-slate-500">Decisão: ${escapeHtml(item.decisionNote)}</p>` : ''}</div><div class="s6-card-actions">${actionButtons(escapeHtml(id), item)}</div></article>`;
    }).join('') || emptyState('fa-cart-arrow-down', 'Nenhuma requisição encontrada', 'Crie uma requisição ou altere os filtros.');
}

field('purchase-inventory').addEventListener('change', () => { const item = inventory[field('purchase-inventory').value]; if (item) { field('purchase-item').value = item.name || ''; field('purchase-unit-cost').value = nonNegative(item.price).toFixed(2); } });
field('purchase-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const button = field('purchase-submit');
    const payload = { inventoryId: field('purchase-inventory').value, itemName: field('purchase-item').value.trim(), qty: Number(field('purchase-qty').value), estimatedUnitCost: Number(field('purchase-unit-cost').value), priority: field('purchase-priority').value, supplierId: field('purchase-supplier').value, justification: field('purchase-justification').value.trim(), status: 'submitted', requesterUid: context.user.uid, requesterName: context.profile.name || context.user.email || 'Usuário', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    if (!payload.itemName || payload.justification.length < 5 || !(payload.qty > 0) || !(payload.estimatedUnitCost >= 0)) return toast('error', 'Revise os dados da requisição.');
    setButtonBusy(button, true);
    try { const node = push(ref(db, 'purchase_requests')); await set(node, payload); await writeAuditLog({ action: 'create', entity: 'purchase_request', entityId: node.key, description: `Requisição de compra criada: ${payload.itemName}.`, metadata: { value: amount(payload), priority: payload.priority } }); field('purchase-form').reset(); field('purchase-qty').value = '1'; field('purchase-unit-cost').value = '0'; toast('success', 'Requisição enviada para aprovação.'); }
    catch (error) { console.error(error); toast('error', 'Não foi possível criar a requisição.'); }
    finally { setButtonBusy(button, false); }
});

field('purchase-list').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return; const id = button.dataset.id; const item = requests[id]; if (!item) return; const action = button.dataset.action;
    const transitions = { approve: ['approved', 'Requisição aprovada.'], reject: ['rejected', 'Requisição rejeitada.'], order: ['ordered', 'Pedido de compra emitido.'], cancel: ['cancelled', 'Requisição cancelada.'] };
    if ((action === 'approve' || action === 'reject') && (!isAdmin() || item.status !== 'submitted')) return;
    if (action === 'order' && (!isSupply() || item.status !== 'approved')) return;
    if (action === 'cancel' && (item.requesterUid !== context.user.uid || item.status !== 'submitted')) return;
    try {
        if (action === 'receive' && isSupply() && item.status === 'ordered') {
            const changes = { [`purchase_requests/${id}/status`]: 'received', [`purchase_requests/${id}/receivedAt`]: serverTimestamp(), [`purchase_requests/${id}/receivedByUid`]: context.user.uid, [`purchase_requests/${id}/updatedAt`]: serverTimestamp() };
            const updatesStock = Boolean(item.inventoryId && inventory[item.inventoryId]);
            if (updatesStock) { changes[`inventory/${item.inventoryId}/qty`] = increment(nonNegative(item.qty)); changes[`inventory/${item.inventoryId}/updatedAt`] = serverTimestamp(); }
            await update(ref(db), changes);
            await writeAuditLog({ action: 'receive', entity: 'purchase_request', entityId: id, description: `${updatesStock ? 'Compra recebida e estoque atualizado' : 'Serviço ou item avulso recebido'}: ${item.itemName}.`, metadata: { qty: item.qty, inventoryId: item.inventoryId || '', stockUpdated: updatesStock } }); toast('success', updatesStock ? 'Recebimento confirmado e estoque atualizado.' : 'Recebimento confirmado.'); return;
        }
        const transition = transitions[action]; if (!transition) return; const note = action === 'reject' ? prompt('Informe o motivo da rejeição:') : '';
        if (action === 'reject' && (!note || note.trim().length < 3)) return toast('error', 'Informe o motivo da rejeição.');
        await update(ref(db, `purchase_requests/${id}`), { status: transition[0], decisionNote: note?.trim() || '', updatedAt: serverTimestamp(), updatedByUid: context.user.uid });
        await writeAuditLog({ action, entity: 'purchase_request', entityId: id, description: transition[1] }); toast('success', transition[1]);
    } catch (error) { console.error(error); toast('error', 'A ação não pôde ser concluída.'); }
});

field('purchase-search').addEventListener('input', render); field('purchase-filter').addEventListener('change', render);
field('purchase-export').addEventListener('click', () => { const lines = [['Item', 'Quantidade', 'Custo unitário', 'Valor total', 'Status', 'Fornecedor', 'Solicitante', 'Criada em'], ...currentRows.map(([, item]) => [item.itemName, item.qty, item.estimatedUnitCost, amount(item), STATUS[item.status]?.[0] || item.status, suppliers[item.supplierId]?.name || '', users[item.requesterUid]?.name || item.requesterName || '', new Date(nonNegative(item.createdAt)).toLocaleString('pt-BR')])]; downloadFile('\uFEFF' + lines.map((row) => row.map(csvCell).join(';')).join('\n'), `nexus-compras-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8'); });

startProtectedPage('compras', (pageContext) => {
    context = pageContext;
    onValue(ref(db, 'purchase_requests'), (snapshot) => { requests = snapshot.val() || {}; render(); });
    onValue(ref(db, 'suppliers'), (snapshot) => { suppliers = snapshot.val() || {}; populateSelects(); render(); });
    onValue(ref(db, 'inventory'), (snapshot) => { inventory = snapshot.val() || {}; populateSelects(); render(); });
    onValue(ref(db, 'users'), (snapshot) => { users = snapshot.val() || {}; render(); });
});
