import {
    db, ref, onValue, push, set, update, remove, writeAuditLog, escapeHtml, entries, nonNegative,
    mountMaintenanceShell, startProtectedPage, formatDate, formatDateTime, emptyState, openDialog, wireDialog, closeDialog, toast, setButtonBusy
} from './maintenance-core.js';

mountMaintenanceShell({
    pageId: 'inspecoes', title: 'Inspeções Digitais', subtitle: 'Rotas recorrentes, coleta padronizada e abertura automática de solicitações',
    headerActions: '<button id="new-route" type="button" class="s3-btn s3-btn--primary"><i class="fas fa-plus" aria-hidden="true"></i><span class="hidden sm:inline">Nova rota</span></button>',
    content: `
        <div class="s3-page">
            <div class="s3-grid s3-grid--kpi"><article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Rotas ativas</span><strong id="kpi-routes" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-route" aria-hidden="true"></i></span></article><article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Vencidas</span><strong id="kpi-overdue" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-calendar-xmark" aria-hidden="true"></i></span></article><article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Executadas no mês</span><strong id="kpi-month" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-circle-check" aria-hidden="true"></i></span></article><article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Achados abertos</span><strong id="kpi-findings" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-magnifying-glass-chart" aria-hidden="true"></i></span></article></div>
            <div class="s3-toolbar"><div class="s3-toolbar-group"><input id="route-search" class="s3-input" type="search" placeholder="Buscar rota ou área" aria-label="Buscar rotas"><select id="route-filter" class="s3-input" aria-label="Filtrar rotas"><option value="all">Todas</option><option value="due">Vencidas/próximas</option><option value="inactive">Pausadas</option></select></div><a href="confiabilidade.html" class="s3-btn s3-btn--sm"><i class="fas fa-chart-line" aria-hidden="true"></i>Confiabilidade</a></div>
            <section id="route-list" class="s3-grid s3-grid--3" aria-live="polite"></section>
            <section class="s3-card mt-4"><div class="s3-card__head"><div><h3>Histórico de execuções</h3><p>Rastreabilidade das inspeções concluídas.</p></div></div><div class="overflow-x-auto"><table class="s3-table"><thead><tr><th>Data</th><th>Rota</th><th>Inspetor</th><th>Pontos</th><th>Desvios</th><th>Resultado</th></tr></thead><tbody id="execution-history"></tbody></table></div></section>
        </div>
        <dialog id="route-dialog" class="s3-dialog" aria-labelledby="route-title"><form id="route-form"><div class="s3-dialog__head"><h2 id="route-title">Nova rota de inspeção</h2><button type="button" class="s3-btn s3-btn--sm" data-dialog-close aria-label="Fechar"><i class="fas fa-xmark" aria-hidden="true"></i></button></div><div class="s3-dialog__body s3-form-grid"><div class="s3-field s3-field--wide"><label for="route-name">Nome da rota</label><input id="route-name" maxlength="140" placeholder="Ex.: Ronda diária da Linha 1" required></div><div class="s3-field"><label for="route-area">Área</label><input id="route-area" maxlength="100" placeholder="Produção"></div><div class="s3-field"><label for="route-shift">Turno</label><select id="route-shift"><option>Todos</option><option>1º turno</option><option>2º turno</option><option>3º turno</option></select></div><div class="s3-field"><label for="route-frequency">Periodicidade (dias)</label><input id="route-frequency" type="number" min="1" max="365" value="7" required></div><div class="s3-field"><label for="route-next">Próxima execução</label><input id="route-next" type="date" required></div><fieldset class="s3-field s3-field--wide"><legend class="s3-label">Equipamentos da rota</legend><p id="route-assets-help" class="text-xs text-slate-500 mb-2">Selecione pelo menos um equipamento.</p><div id="route-assets" class="s3-grid s3-grid--2 max-h-64 overflow-y-auto" aria-describedby="route-assets-help"></div></fieldset><div class="s3-field s3-field--wide"><label for="route-instruction">Instrução padrão</label><textarea id="route-instruction" maxlength="400" placeholder="Observar ruído, vazamento, temperatura, vibração e condições gerais."></textarea></div></div><div class="s3-dialog__foot"><button type="button" class="s3-btn" data-dialog-close>Cancelar</button><button id="route-submit" type="submit" class="s3-btn s3-btn--primary">Salvar rota</button></div></form></dialog>
        <dialog id="execution-dialog" class="s3-dialog s3-dialog--wide" aria-labelledby="execution-title"><form id="execution-form"><div class="s3-dialog__head"><div><h2 id="execution-title">Executar inspeção</h2><p id="execution-subtitle" class="text-xs text-slate-500 mt-1"></p></div><button type="button" class="s3-btn s3-btn--sm" data-dialog-close aria-label="Fechar"><i class="fas fa-xmark" aria-hidden="true"></i></button></div><div class="s3-dialog__body"><input id="execution-route-id" type="hidden"><div class="s4-notice mb-4"><i class="fas fa-circle-info mt-1" aria-hidden="true"></i><div><strong>Registro técnico</strong><p class="mt-1 text-xs">Marque cada ponto. Atenção ou crítico gera automaticamente uma solicitação de manutenção para triagem.</p></div></div><div id="execution-checkpoints" class="s3-list"></div></div><div class="s3-dialog__foot"><button type="button" class="s3-btn" data-dialog-close>Cancelar</button><button id="execution-submit" type="submit" class="s3-btn s3-btn--primary"><i class="fas fa-check" aria-hidden="true"></i>Concluir inspeção</button></div></form></dialog>`
});

wireDialog('route-dialog'); wireDialog('execution-dialog');
let context, routes = {}, assets = {}, executions = {}, results = {}, executionStartedAt = 0;
const isAdmin = () => context?.profile?.role === 'Administrador';
const checkpoints = (route) => Array.isArray(route?.checkpoints) ? route.checkpoints : entries(route?.checkpoints).map(([, item]) => item);
const dueSoon = (route) => route.active !== false && nonNegative(route.nextDueAt) <= Date.now() + 2 * 86400000;
const overdue = (route) => route.active !== false && nonNegative(route.nextDueAt) < new Date().setHours(0, 0, 0, 0);

function executionRows() {
    return entries(executions).map(([id, item]) => ({ id, ...item })).sort((a, b) => nonNegative(b.finishedAt) - nonNegative(a.finishedAt));
}

function countDeviations(executionId) {
    return entries(results[executionId]).filter(([, item]) => item.status !== 'ok').length;
}

function render() {
    const routeRows = entries(routes); const active = routeRows.filter(([, item]) => item.active !== false); const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    document.getElementById('kpi-routes').textContent = active.length; document.getElementById('kpi-overdue').textContent = active.filter(([, item]) => overdue(item)).length; document.getElementById('kpi-month').textContent = executionRows().filter((item) => nonNegative(item.finishedAt) >= monthStart.getTime()).length; document.getElementById('kpi-findings').textContent = entries(results).reduce((sum, [, values]) => sum + entries(values).filter(([, item]) => item.status !== 'ok').length, 0);
    const term = document.getElementById('route-search').value.trim().toLowerCase(); const filter = document.getElementById('route-filter').value;
    const filtered = routeRows.filter(([, route]) => { if (!`${route.name || ''} ${route.area || ''}`.toLowerCase().includes(term)) return false; if (filter === 'due') return dueSoon(route); if (filter === 'inactive') return route.active === false; return true; }).sort((a, b) => nonNegative(a[1].nextDueAt, Infinity) - nonNegative(b[1].nextDueAt, Infinity));
    document.getElementById('route-list').innerHTML = filtered.map(([id, route]) => { const state = route.active === false ? ['Pausada', 'slate'] : overdue(route) ? ['Vencida', 'red'] : dueSoon(route) ? ['Próxima', 'amber'] : ['Em dia', 'green']; const points = checkpoints(route); return `<article class="s3-card"><div class="s3-card__head"><div><h3>${escapeHtml(route.name || 'Rota')}</h3><p><i class="fas fa-location-dot" aria-hidden="true"></i> ${escapeHtml(route.area || 'Área geral')}</p></div><span class="s3-badge s3-badge--${state[1]}">${state[0]}</span></div><div class="s3-card__body"><div class="s3-chip-row"><span class="s3-badge s3-badge--blue">${points.length} pontos</span><span class="s3-badge s3-badge--purple">A cada ${nonNegative(route.frequencyDays, 7)} dias</span></div><div class="s3-meta"><span><i class="fas fa-calendar" aria-hidden="true"></i> ${formatDate(route.nextDueAt)}</span><span><i class="fas fa-clock" aria-hidden="true"></i> ${escapeHtml(route.shift || 'Todos')}</span></div><p class="mt-3">${escapeHtml(route.instruction || 'Inspeção visual e coleta de condição.')}</p></div><div class="s3-card__foot s3-actions"><button type="button" class="s3-btn s3-btn--primary s3-btn--sm" data-execute="${escapeHtml(id)}" ${route.active === false ? 'disabled' : ''}><i class="fas fa-play" aria-hidden="true"></i>Executar</button><button type="button" class="s3-btn s3-btn--sm" data-toggle="${escapeHtml(id)}">${route.active === false ? 'Ativar' : 'Pausar'}</button>${isAdmin() ? `<button type="button" class="s3-btn s3-btn--danger s3-btn--sm" data-delete="${escapeHtml(id)}"><i class="fas fa-trash" aria-hidden="true"></i></button>` : ''}</div></article>`; }).join('') || emptyState('fa-route', 'Nenhuma rota encontrada', 'Crie uma rota ou altere os filtros.');
    renderHistory();
}

function renderHistory() {
    document.getElementById('execution-history').innerHTML = executionRows().slice(0, 50).map((item) => { const deviations = countDeviations(item.id); return `<tr><td>${formatDateTime(item.finishedAt)}</td><td>${escapeHtml(item.routeName || item.routeId)}</td><td>${escapeHtml(item.inspectorName || '—')}</td><td>${nonNegative(item.checkpointCount)}</td><td>${deviations}</td><td><span class="s3-badge ${deviations ? 's3-badge--amber' : 's3-badge--green'}">${deviations ? 'Com desvios' : 'Conforme'}</span></td></tr>`; }).join('') || '<tr><td colspan="6"><div class="s3-empty">Nenhuma inspeção executada.</div></td></tr>';
}

function renderAssetChoices() {
    const assetRows = entries(assets).sort((a, b) => String(a[1]?.name || a[0]).localeCompare(String(b[1]?.name || b[0]), 'pt-BR'));
    document.getElementById('route-assets').innerHTML = assetRows.map(([id, asset]) => `<label class="s3-list-item flex items-start gap-3"><input type="checkbox" data-route-asset value="${escapeHtml(id)}" class="mt-1"><span><strong>${escapeHtml(asset.name || id)}</strong><small class="block mt-1 text-slate-500">${escapeHtml(asset.area || 'Sem área')}</small></span></label>`).join('') || '<p class="s4-notice" data-tone="warning">Nenhum equipamento cadastrado. Cadastre um ativo antes de criar a rota.</p>';
    const submit = document.getElementById('route-submit');
    if (submit) {
        submit.disabled = assetRows.length === 0;
        submit.title = assetRows.length ? '' : 'Cadastre um equipamento antes de salvar a rota';
    }
}

function openExecution(routeId) {
    const route = routes[routeId]; if (!route) return; const points = checkpoints(route);
    executionStartedAt = Date.now(); document.getElementById('execution-route-id').value = routeId; document.getElementById('execution-title').textContent = route.name || 'Executar inspeção'; document.getElementById('execution-subtitle').textContent = `${points.length} pontos · ${route.area || 'Área geral'}`;
    document.getElementById('execution-checkpoints').innerHTML = points.map((point, index) => { const asset = assets[point.assetId] || {}; return `<fieldset class="s5-checkpoint" data-checkpoint data-asset-id="${escapeHtml(point.assetId)}"><div><legend class="font-bold">${index + 1}. ${escapeHtml(asset.name || point.assetName || point.assetId)}</legend><p class="text-xs text-slate-500 mt-1">${escapeHtml(point.instruction || route.instruction || 'Inspeção visual e leitura.')}</p></div><div class="s3-field"><label>Condição</label><select data-result-status><option value="ok">Conforme</option><option value="attention">Atenção</option><option value="critical">Crítico</option></select></div><div class="s3-field"><label>Temperatura °C</label><input data-result-temp type="number" min="-40" max="250" step="0.1" placeholder="Opcional"></div><div class="s3-field"><label>Vibração mm/s</label><input data-result-vibration type="number" min="0" max="100" step="0.01" placeholder="Opcional"></div><div class="s3-field"><label>Observação</label><input data-result-note maxlength="300" placeholder="Condição encontrada"></div></fieldset>`; }).join('');
    openDialog('execution-dialog');
}

document.getElementById('new-route').addEventListener('click', () => { document.getElementById('route-form').reset(); document.getElementById('route-frequency').value = 7; document.getElementById('route-next').value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); renderAssetChoices(); openDialog('route-dialog'); });
document.getElementById('route-search').addEventListener('input', render); document.getElementById('route-filter').addEventListener('change', render);

document.getElementById('route-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    if (!context?.user?.uid) return toast('error', 'Sua sessão ainda não está pronta. Aguarde alguns segundos e tente novamente.');

    const selected = Array.from(document.querySelectorAll('[data-route-asset]:checked')).map((input) => input.value);
    if (!selected.length) return toast('warning', 'Selecione ao menos um equipamento.');

    const button = document.getElementById('route-submit');
    const name = document.getElementById('route-name').value.trim();
    const dateValue = document.getElementById('route-next').value;
    const nextDueAt = new Date(`${dateValue}T12:00:00`).getTime();
    if (!name) return toast('warning', 'Informe um nome para a rota.');
    if (!Number.isFinite(nextDueAt)) return toast('warning', 'Informe uma data válida para a próxima execução.');

    setButtonBusy(button, true, 'Salvando...');
    try {
        const instruction = document.getElementById('route-instruction').value.trim();
        const routeRef = push(ref(db, 'inspection_routes'));
        const routePayload = {
            name,
            area: document.getElementById('route-area').value.trim(),
            shift: document.getElementById('route-shift').value,
            frequencyDays: Math.min(365, Math.max(1, nonNegative(document.getElementById('route-frequency').value, 7))),
            nextDueAt,
            instruction,
            checkpoints: selected.map((id) => ({ assetId: id, assetName: assets[id]?.name || id, instruction })),
            active: true,
            createdAt: Date.now(),
            createdByUid: context.user.uid,
            createdBy: context.profile?.name || context.user.email || ''
        };
        await set(routeRef, routePayload);
        await writeAuditLog({ action: 'create', entity: 'inspection_route', entityId: routeRef.key, description: `Rota de inspeção ${name} criada.`, metadata: { checkpoints: selected.length } });
        closeDialog('route-dialog');
        form.reset();
        toast('success', 'Rota criada com sucesso.');
    } catch (error) {
        console.error('Falha ao criar rota de inspeção.', error);
        const denied = String(error?.code || error?.message || '').toLowerCase().includes('permission');
        toast('error', denied ? 'Seu perfil não tem permissão para salvar rotas. Verifique as regras publicadas do banco de dados.' : 'Não foi possível criar a rota. Verifique a conexão e tente novamente.');
    } finally {
        setButtonBusy(button, false);
    }
});

document.getElementById('execution-form').addEventListener('submit', async (event) => { event.preventDefault(); const routeId = document.getElementById('execution-route-id').value; const route = routes[routeId]; if (!route) return; const rows = Array.from(document.querySelectorAll('[data-checkpoint]')); const button = document.getElementById('execution-submit'); setButtonBusy(button, true, 'Concluindo...'); try { const finishedAt = Date.now(); const executionId = push(ref(db, 'inspection_executions')).key; const updates = {}; let deviations = 0; const resultRows = rows.map((row) => { const status = row.querySelector('[data-result-status]').value; const linkedAssetId = row.dataset.assetId; const note = row.querySelector('[data-result-note]').value.trim(); const temperatureText = row.querySelector('[data-result-temp]').value; const vibrationText = row.querySelector('[data-result-vibration]').value; const resultId = push(ref(db, `inspection_results/${executionId}`)).key; const result = { routeId, routeName: route.name || '', assetId: linkedAssetId, assetName: assets[linkedAssetId]?.name || linkedAssetId, status, temperature: temperatureText === '' ? null : Number(temperatureText), vibration: vibrationText === '' ? null : Number(vibrationText), note, createdAt: finishedAt, inspectorUid: context.user.uid, inspectorName: context.profile.name || '' }; if (status !== 'ok') { deviations++; const requestId = push(ref(db, 'maintenance_requests')).key; result.maintenanceRequestId = requestId; updates[`maintenance_requests/${requestId}`] = { title: `Achado de inspeção: ${assets[linkedAssetId]?.name || linkedAssetId}`, description: note || `Desvio ${status === 'critical' ? 'crítico' : 'de atenção'} identificado na rota ${route.name}.`, assetId: linkedAssetId, assetName: assets[linkedAssetId]?.name || linkedAssetId, priority: status === 'critical' ? 'danger' : 'normal', status: 'new', source: 'inspection', inspectionExecutionId: executionId, inspectionResultId: resultId, requesterUid: context.user.uid, requesterName: context.profile.name || '', createdAt: finishedAt }; } updates[`inspection_results/${executionId}/${resultId}`] = result; return result; }); const nextDueAt = Math.max(Date.now(), nonNegative(route.nextDueAt, Date.now())) + Math.max(1, nonNegative(route.frequencyDays, 7)) * 86400000; updates[`inspection_executions/${executionId}`] = { routeId, routeName: route.name || '', checkpointCount: resultRows.length, deviationCount: deviations, startedAt: executionStartedAt || finishedAt, finishedAt, status: 'completed', inspectorUid: context.user.uid, inspectorName: context.profile.name || '' }; updates[`inspection_routes/${routeId}/lastExecutionAt`] = finishedAt; updates[`inspection_routes/${routeId}/lastExecutionId`] = executionId; updates[`inspection_routes/${routeId}/nextDueAt`] = nextDueAt; updates[`inspection_routes/${routeId}/updatedAt`] = finishedAt; updates[`inspection_routes/${routeId}/updatedByUid`] = context.user.uid; await update(ref(db), updates); await writeAuditLog({ action: 'execute', entity: 'inspection', entityId: executionId, description: `Rota ${route.name} concluída com ${deviations} desvio(s).`, metadata: { routeId, deviations } }); closeDialog('execution-dialog'); toast('success', deviations ? `Inspeção concluída. ${deviations} solicitação(ões) criada(s).` : 'Inspeção concluída sem desvios.'); } catch (error) { console.error(error); toast('error', 'Não foi possível concluir a inspeção.'); } finally { setButtonBusy(button, false); } });

document.addEventListener('click', async (event) => {
    const execute = event.target.closest('[data-execute]');
    if (execute) return openExecution(execute.dataset.execute);

    const toggle = event.target.closest('[data-toggle]');
    if (toggle) {
        const route = routes[toggle.dataset.toggle];
        setButtonBusy(toggle, true, route?.active === false ? 'Ativando...' : 'Pausando...');
        try {
            await update(ref(db, `inspection_routes/${toggle.dataset.toggle}`), { active: route?.active === false, updatedAt: Date.now(), updatedByUid: context.user.uid });
            await writeAuditLog({ action: 'status', entity: 'inspection_route', entityId: toggle.dataset.toggle, description: `Rota ${route?.active === false ? 'ativada' : 'pausada'}.` });
        } catch (error) {
            console.error('Falha ao alterar situação da rota.', error);
            toast('error', 'Não foi possível alterar a situação da rota.');
        } finally {
            setButtonBusy(toggle, false);
        }
        return;
    }

    const removeButton = event.target.closest('[data-delete]');
    if (!removeButton || !isAdmin() || !confirm('Excluir esta rota? O histórico de execuções será mantido.')) return;
    setButtonBusy(removeButton, true, 'Excluindo...');
    try {
        await remove(ref(db, `inspection_routes/${removeButton.dataset.delete}`));
        await writeAuditLog({ action: 'delete', entity: 'inspection_route', entityId: removeButton.dataset.delete, description: 'Rota de inspeção removida.' });
        toast('success', 'Rota removida.');
    } catch (error) {
        console.error('Falha ao excluir rota de inspeção.', error);
        toast('error', 'Não foi possível excluir a rota.');
    } finally {
        setButtonBusy(removeButton, false);
    }
});

startProtectedPage('inspecoes', (pageContext) => { context = pageContext; onValue(ref(db, 'assets'), (snapshot) => { assets = snapshot.val() || {}; renderAssetChoices(); render(); }); onValue(ref(db, 'inspection_routes'), (snapshot) => { routes = snapshot.val() || {}; render(); }); onValue(ref(db, 'inspection_executions'), (snapshot) => { executions = snapshot.val() || {}; render(); }); onValue(ref(db, 'inspection_results'), (snapshot) => { results = snapshot.val() || {}; render(); }); });
