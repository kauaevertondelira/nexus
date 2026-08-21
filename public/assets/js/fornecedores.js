import {
    db, ref, onValue, push, set, update, remove, serverTimestamp, writeAuditLog,
    escapeHtml, nonNegative, formatDateTime, mountMaintenanceShell, startProtectedPage,
    emptyState, toast, setButtonBusy
} from './maintenance-core.js';

mountMaintenanceShell({
    pageId: 'fornecedores', title: 'Fornecedores', subtitle: 'Cadastro, desempenho e relacionamento com fornecedores MRO',
    headerActions: '<a href="compras.html" class="s3-btn s3-btn--primary s3-btn--sm"><i class="fas fa-cart-shopping" aria-hidden="true"></i><span class="hidden sm:inline">Compras</span></a>',
    content: `
        <div class="s3-page">
            <div class="s3-grid s3-grid--kpi">
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Fornecedores ativos</span><strong id="supplier-active" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-building" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Avaliação média</span><strong id="supplier-rating" class="s3-kpi__value">—</strong></div><span class="s3-kpi__icon"><i class="fas fa-star" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Lead time médio</span><strong id="supplier-lead" class="s3-kpi__value">—</strong></div><span class="s3-kpi__icon"><i class="fas fa-truck-fast" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Pedidos vinculados</span><strong id="supplier-orders" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-receipt" aria-hidden="true"></i></span></article>
            </div>
            <div class="s3-grid s3-grid--2 mt-4 s6-split">
                <section class="s3-card"><div class="s3-card__head"><div><h3 id="supplier-form-title">Novo fornecedor</h3><p>Dados comerciais e indicadores de atendimento.</p></div></div><form id="supplier-form" class="s3-card__body s6-form">
                    <input id="supplier-id" type="hidden">
                    <label>Razão social / Nome<input id="supplier-name" class="s3-input" maxlength="160" required></label>
                    <div class="s6-form-grid"><label>CNPJ<input id="supplier-tax" class="s3-input" inputmode="numeric" maxlength="18" placeholder="00.000.000/0000-00"></label><label>Categoria<select id="supplier-category" class="s3-input"><option>Peças e componentes</option><option>Serviços técnicos</option><option>Lubrificantes</option><option>Elétrica e automação</option><option>Ferramentas e EPI</option><option>Outros</option></select></label></div>
                    <div class="s6-form-grid"><label>Contato<input id="supplier-contact" class="s3-input" maxlength="100"></label><label>Telefone<input id="supplier-phone" class="s3-input" maxlength="30"></label></div>
                    <label>E-mail<input id="supplier-email" type="email" class="s3-input" maxlength="180"></label>
                    <div class="s6-form-grid"><label>Lead time (dias)<input id="supplier-lead-days" type="number" class="s3-input" min="0" max="365" value="7" required></label><label>Avaliação<select id="supplier-rating-input" class="s3-input"><option value="5">5 — Excelente</option><option value="4">4 — Muito bom</option><option value="3">3 — Regular</option><option value="2">2 — Abaixo do esperado</option><option value="1">1 — Ruim</option></select></label></div>
                    <label class="s3-row"><input id="supplier-active-input" type="checkbox" checked> Fornecedor ativo</label>
                    <div class="s3-row"><button id="supplier-submit" type="submit" class="s3-btn s3-btn--primary"><i class="fas fa-floppy-disk" aria-hidden="true"></i>Salvar fornecedor</button><button id="supplier-cancel" type="button" class="s3-btn hidden">Cancelar edição</button></div>
                </form></section>
                <section class="s3-card"><div class="s3-card__head"><div><h3>Base homologada</h3><p>Fornecedores disponíveis para requisições e contratos.</p></div></div><div class="s3-card__body"><div class="s3-toolbar mb-4"><div class="s3-toolbar-group w-full"><input id="supplier-search" class="s3-input w-full" type="search" placeholder="Buscar nome, categoria ou CNPJ" aria-label="Buscar fornecedores"><select id="supplier-filter" class="s3-input" aria-label="Situação"><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></div></div><div id="supplier-list" class="s6-card-list"></div></div></section>
            </div>
        </div>`
});

let suppliers = {}, purchaseRequests = {}, context = null;
const value = (id) => document.getElementById(id).value.trim();

function resetForm() {
    document.getElementById('supplier-form').reset();
    document.getElementById('supplier-id').value = '';
    document.getElementById('supplier-lead-days').value = '7';
    document.getElementById('supplier-rating-input').value = '5';
    document.getElementById('supplier-active-input').checked = true;
    document.getElementById('supplier-form-title').textContent = 'Novo fornecedor';
    document.getElementById('supplier-cancel').classList.add('hidden');
}

function render() {
    const rows = Object.entries(suppliers);
    const active = rows.filter(([, item]) => item.active !== false);
    const rating = active.reduce((sum, [, item]) => sum + nonNegative(item.rating), 0);
    const lead = active.reduce((sum, [, item]) => sum + nonNegative(item.leadTimeDays), 0);
    document.getElementById('supplier-active').textContent = active.length;
    document.getElementById('supplier-rating').textContent = active.length ? `${(rating / active.length).toFixed(1)}/5` : '—';
    document.getElementById('supplier-lead').textContent = active.length ? `${Math.round(lead / active.length)} dias` : '—';
    document.getElementById('supplier-orders').textContent = Object.values(purchaseRequests).filter((item) => item.supplierId).length;

    const search = value('supplier-search').toLowerCase();
    const status = document.getElementById('supplier-filter').value;
    const filtered = rows.filter(([, item]) => {
        const matches = `${item.name || ''} ${item.category || ''} ${item.taxId || ''}`.toLowerCase().includes(search);
        const isActive = item.active !== false;
        return matches && (status === 'all' || (status === 'active' ? isActive : !isActive));
    }).sort((a, b) => String(a[1].name || '').localeCompare(String(b[1].name || ''), 'pt-BR'));

    document.getElementById('supplier-list').innerHTML = filtered.map(([id, item]) => `
        <article class="s6-list-card">
            <div class="min-w-0"><div class="s3-row flex-wrap"><strong class="text-base">${escapeHtml(item.name || 'Sem nome')}</strong><span class="s3-badge ${item.active === false ? 's3-badge--slate' : 's3-badge--green'}">${item.active === false ? 'Inativo' : 'Ativo'}</span></div><p>${escapeHtml(item.category || 'Sem categoria')} · ${escapeHtml(item.taxId || 'CNPJ não informado')}</p><small>${escapeHtml(item.contact || 'Sem contato')} ${item.email ? `· ${escapeHtml(item.email)}` : ''}</small><div class="s3-row mt-3"><span class="s3-badge s3-badge--amber"><i class="fas fa-star" aria-hidden="true"></i> ${nonNegative(item.rating, 0)}/5</span><span class="s3-badge s3-badge--blue">Lead time: ${nonNegative(item.leadTimeDays)} dias</span></div></div>
            <div class="s6-card-actions"><button type="button" class="s3-btn s3-btn--sm" data-action="edit" data-id="${escapeHtml(id)}">Editar</button><button type="button" class="s3-btn s3-btn--sm" data-action="toggle" data-id="${escapeHtml(id)}">${item.active === false ? 'Ativar' : 'Pausar'}</button>${context?.profile.role === 'Administrador' ? `<button type="button" class="s3-btn s3-btn--danger s3-btn--sm" data-action="delete" data-id="${escapeHtml(id)}">Excluir</button>` : ''}</div>
        </article>`).join('') || emptyState('fa-building-circle-xmark', 'Nenhum fornecedor encontrado', 'Cadastre um fornecedor ou altere os filtros.');
}

document.getElementById('supplier-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('supplier-submit');
    const id = value('supplier-id');
    const payload = {
        name: value('supplier-name'), taxId: value('supplier-tax'), category: value('supplier-category'),
        contact: value('supplier-contact'), phone: value('supplier-phone'), email: value('supplier-email'),
        leadTimeDays: Number(value('supplier-lead-days')), rating: Number(value('supplier-rating-input')),
        active: document.getElementById('supplier-active-input').checked, updatedAt: serverTimestamp(), updatedByUid: context.user.uid
    };
    if (!payload.name || !Number.isFinite(payload.leadTimeDays)) return toast('error', 'Preencha os campos obrigatórios.');
    setButtonBusy(button, true);
    try {
        let entityId = id;
        if (id) await update(ref(db, `suppliers/${id}`), payload);
        else {
            const node = push(ref(db, 'suppliers'));
            entityId = node.key;
            await set(node, { ...payload, createdAt: serverTimestamp(), createdByUid: context.user.uid });
        }
        await writeAuditLog({ action: id ? 'update' : 'create', entity: 'supplier', entityId, description: `${id ? 'Fornecedor atualizado' : 'Fornecedor cadastrado'}: ${payload.name}.` });
        resetForm(); toast('success', 'Fornecedor salvo com sucesso.');
    } catch (error) { console.error(error); toast('error', 'Não foi possível salvar o fornecedor.'); }
    finally { setButtonBusy(button, false); }
});

document.getElementById('supplier-list').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const id = button.dataset.id; const item = suppliers[id]; if (!item) return;
    if (button.dataset.action === 'edit') {
        document.getElementById('supplier-id').value = id;
        document.getElementById('supplier-name').value = item.name || '';
        document.getElementById('supplier-tax').value = item.taxId || '';
        document.getElementById('supplier-category').value = item.category || 'Outros';
        document.getElementById('supplier-contact').value = item.contact || '';
        document.getElementById('supplier-phone').value = item.phone || '';
        document.getElementById('supplier-email').value = item.email || '';
        document.getElementById('supplier-lead-days').value = nonNegative(item.leadTimeDays, 7);
        document.getElementById('supplier-rating-input').value = String(nonNegative(item.rating, 5));
        document.getElementById('supplier-active-input').checked = item.active !== false;
        document.getElementById('supplier-form-title').textContent = 'Editar fornecedor'; document.getElementById('supplier-cancel').classList.remove('hidden'); document.getElementById('supplier-name').focus();
    }
    if (button.dataset.action === 'toggle') {
        setButtonBusy(button, true);
        try {
            await update(ref(db, `suppliers/${id}`), { active: item.active === false, updatedAt: serverTimestamp(), updatedByUid: context.user.uid });
            toast('success', 'Situação atualizada.');
        } catch (error) {
            console.error('Falha ao alterar situação do fornecedor.', error);
            toast('error', 'Não foi possível alterar a situação do fornecedor.');
        } finally {
            setButtonBusy(button, false);
        }
    }
    if (button.dataset.action === 'delete' && context.profile.role === 'Administrador' && confirm(`Excluir o fornecedor ${item.name}?`)) {
        setButtonBusy(button, true, 'Excluindo...');
        try {
            await remove(ref(db, `suppliers/${id}`));
            await writeAuditLog({ action: 'delete', entity: 'supplier', entityId: id, description: `Fornecedor excluído: ${item.name}.` });
            toast('success', 'Fornecedor excluído.');
        } catch (error) {
            console.error('Falha ao excluir fornecedor.', error);
            toast('error', 'Não foi possível excluir o fornecedor.');
        } finally {
            setButtonBusy(button, false);
        }
    }
});

document.getElementById('supplier-cancel').addEventListener('click', resetForm);
document.getElementById('supplier-search').addEventListener('input', render);
document.getElementById('supplier-filter').addEventListener('change', render);

startProtectedPage('fornecedores', (pageContext) => {
    context = pageContext;
    onValue(ref(db, 'suppliers'), (snapshot) => { suppliers = snapshot.val() || {}; render(); });
    onValue(ref(db, 'purchase_requests'), (snapshot) => { purchaseRequests = snapshot.val() || {}; render(); });
});
