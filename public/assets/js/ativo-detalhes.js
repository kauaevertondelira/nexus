import {
    db, ref, onValue, push, update, remove, writeAuditLog, escapeHtml, entries, nonNegative, formatCurrency,
    mountMaintenanceShell, startProtectedPage, formatDate, formatDateTime, emptyState, openDialog, wireDialog, closeDialog, toast, setButtonBusy
} from './maintenance-core.js';
import { query, limitToLast } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const assetId = String(new URLSearchParams(location.search).get('id') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 160);

mountMaintenanceShell({
    pageId: 'ativo-detalhes',
    title: 'Ativo 360°',
    subtitle: 'Ficha técnica, saúde, manutenção, inspeções e telemetria',
    headerActions: '<a href="ativos.html" class="s3-btn s3-btn--sm"><i class="fas fa-arrow-left" aria-hidden="true"></i><span class="hidden sm:inline">Ativos</span></a>',
    content: `
        <div class="s3-page">
            <section id="asset-hero" class="s5-hero"><div><span class="s3-badge s3-badge--slate">Carregando</span><h2 class="text-2xl font-black mt-2">Ativo</h2><p class="text-slate-500 mt-1">Consultando informações...</p></div><div class="s5-score" style="--score:0"><div class="text-center"><strong>0%</strong><small>Saúde</small></div></div></section>
            <div class="s3-grid s3-grid--kpi mt-4">
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Disponibilidade estimada</span><strong id="kpi-availability" class="s3-kpi__value">—</strong></div><span class="s3-kpi__icon"><i class="fas fa-gauge-high" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">O.S. abertas</span><strong id="kpi-open-orders" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-clipboard-list" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">MTTR estimado</span><strong id="kpi-mttr" class="s3-kpi__value">—</strong></div><span class="s3-kpi__icon"><i class="fas fa-stopwatch" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Custo acumulado</span><strong id="kpi-cost" class="s3-kpi__value text-base">R$ 0</strong></div><span class="s3-kpi__icon"><i class="fas fa-coins" aria-hidden="true"></i></span></article>
            </div>
            <div class="s5-tabs mt-4" role="tablist" aria-label="Seções do ativo"><button class="s5-tab" role="tab" aria-selected="true" data-tab="overview">Visão geral</button><button class="s5-tab" role="tab" aria-selected="false" data-tab="orders">Manutenção</button><button class="s5-tab" role="tab" aria-selected="false" data-tab="telemetry">Telemetria</button><button class="s5-tab" role="tab" aria-selected="false" data-tab="inspections">Inspeções</button><button class="s5-tab" role="tab" aria-selected="false" data-tab="documents">Documentos</button></div>
            <section id="panel-overview" class="s5-panel mt-4" role="tabpanel"><div class="s3-grid s3-grid--2"><article class="s3-card"><div class="s3-card__head"><div><h3>Ficha técnica</h3><p>Identificação e estratégia de manutenção.</p></div><button id="edit-profile" class="s3-btn s3-btn--sm" type="button" hidden><i class="fas fa-pen" aria-hidden="true"></i>Editar</button></div><div id="asset-profile" class="s3-card__body"></div></article><article class="s3-card"><div class="s3-card__head"><div><h3>Diagnóstico consolidado</h3><p>Regras explicáveis usando dados atuais.</p></div></div><div id="health-reasons" class="s3-card__body s3-list"></div></article></div></section>
            <section id="panel-orders" class="s5-panel mt-4" role="tabpanel" hidden><article class="s3-card"><div class="s3-card__head"><div><h3>Histórico de manutenção</h3><p>Ordens vinculadas a este ativo.</p></div><a id="new-order-link" href="os.html" class="s3-btn s3-btn--primary s3-btn--sm"><i class="fas fa-plus" aria-hidden="true"></i>Nova O.S.</a></div><div class="overflow-x-auto"><table class="s3-table"><thead><tr><th>O.S.</th><th>Tipo</th><th>Status</th><th>Data</th><th>Parada</th><th>Custo</th><th></th></tr></thead><tbody id="asset-orders"></tbody></table></div></article></section>
            <section id="panel-telemetry" class="s5-panel mt-4" role="tabpanel" hidden><div class="s3-grid s3-grid--2"><article class="s3-card"><div class="s3-card__head"><div><h3>Leitura atual</h3><p id="telemetry-device">Dispositivo não vinculado.</p></div><span id="telemetry-status" class="s3-badge s3-badge--slate">Sem sinal</span></div><div id="telemetry-metrics" class="s3-card__body s4-metric-grid"></div></article><article class="s3-card"><div class="s3-card__head"><div><h3>Últimas leituras</h3><p>Temperatura e vibração.</p></div></div><div class="s4-chart"><canvas id="asset-telemetry-chart" aria-label="Histórico de telemetria do ativo"></canvas><div id="telemetry-empty" class="s3-empty" hidden></div></div></article></div></section>
            <section id="panel-inspections" class="s5-panel mt-4" role="tabpanel" hidden><article class="s3-card"><div class="s3-card__head"><div><h3>Achados de inspeção</h3><p>Registros mais recentes deste equipamento.</p></div><a href="inspecoes.html" class="s3-btn s3-btn--sm"><i class="fas fa-list-check" aria-hidden="true"></i>Inspeções</a></div><div id="inspection-findings" class="s3-card__body s3-list"></div></article></section>
            <section id="panel-documents" class="s5-panel mt-4" role="tabpanel" hidden><div class="s3-grid s3-grid--2"><article class="s3-card"><div class="s3-card__head"><div><h3>Documentos e referências</h3><p>Manuais, procedimentos e desenhos por link seguro.</p></div><button id="add-document" class="s3-btn s3-btn--primary s3-btn--sm" type="button" hidden><i class="fas fa-plus" aria-hidden="true"></i>Adicionar</button></div><div id="asset-documents" class="s3-card__body s3-grid"></div></article><article class="s3-card"><div class="s3-card__head"><div><h3>Garantias</h3><p>Coberturas vigentes ou vencidas do equipamento.</p></div><a href="contratos.html" class="s3-btn s3-btn--sm" data-page="contratos"><i class="fas fa-shield" aria-hidden="true"></i>Gerenciar</a></div><div id="asset-warranties" class="s3-card__body s3-grid"></div></article></div></section>
        </div>
        <dialog id="profile-dialog" class="s3-dialog" aria-labelledby="profile-title"><form id="profile-form"><div class="s3-dialog__head"><h2 id="profile-title">Ficha técnica do ativo</h2><button type="button" class="s3-btn s3-btn--sm" data-dialog-close aria-label="Fechar"><i class="fas fa-xmark" aria-hidden="true"></i></button></div><div class="s3-dialog__body s3-form-grid"><div class="s3-field"><label for="asset-criticality">Criticidade</label><select id="asset-criticality"><option value="A">A — Alta</option><option value="B">B — Média</option><option value="C">C — Baixa</option></select></div><div class="s3-field"><label for="asset-strategy">Estratégia</label><select id="asset-strategy"><option>Preventiva</option><option>Preditiva</option><option>Corretiva planejada</option><option>Run-to-failure</option></select></div><div class="s3-field"><label for="asset-manufacturer">Fabricante</label><input id="asset-manufacturer" maxlength="120"></div><div class="s3-field"><label for="asset-model">Modelo</label><input id="asset-model" maxlength="120"></div><div class="s3-field"><label for="asset-serial">Número de série</label><input id="asset-serial" maxlength="120"></div><div class="s3-field"><label for="asset-install-date">Data de instalação</label><input id="asset-install-date" type="date"></div><div class="s3-field"><label for="asset-target">Meta de disponibilidade (%)</label><input id="asset-target" type="number" min="1" max="100" step="0.1" value="95"></div><div class="s3-field"><label for="asset-class">Classe do ativo</label><input id="asset-class" maxlength="100" placeholder="Ex.: Compressor"></div></div><div class="s3-dialog__foot"><button type="button" class="s3-btn" data-dialog-close>Cancelar</button><button id="profile-submit" type="submit" class="s3-btn s3-btn--primary">Salvar ficha</button></div></form></dialog>
        <dialog id="document-dialog" class="s3-dialog" aria-labelledby="document-title"><form id="document-form"><div class="s3-dialog__head"><h2 id="document-title">Adicionar documento</h2><button type="button" class="s3-btn s3-btn--sm" data-dialog-close aria-label="Fechar"><i class="fas fa-xmark" aria-hidden="true"></i></button></div><div class="s3-dialog__body s3-form-grid"><div class="s3-field s3-field--wide"><label for="document-name">Título</label><input id="document-name" maxlength="140" required></div><div class="s3-field"><label for="document-type">Tipo</label><select id="document-type"><option>Manual</option><option>Procedimento</option><option>Desenho</option><option>Certificado</option><option>Outro</option></select></div><div class="s3-field"><label for="document-url">Link HTTPS</label><input id="document-url" type="url" maxlength="500" placeholder="https://..." required></div></div><div class="s3-dialog__foot"><button type="button" class="s3-btn" data-dialog-close>Cancelar</button><button id="document-submit" type="submit" class="s3-btn s3-btn--primary">Adicionar documento</button></div></form></dialog>`
});

wireDialog('profile-dialog'); wireDialog('document-dialog');
let context, asset;
let orders = {}, parts = {}, telemetryLatest = {}, deviceConfigs = {}, documents = {}, warranties = {}, inspectionResults = {};
let telemetryHistoryUnsubscribe, chart;

const canEdit = () => ['Administrador', 'Técnico de Manutenção'].includes(context?.profile?.role);
const safeUrl = (value) => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
const linkedOrders = () => entries(orders).filter(([, order]) => order.assetId === assetId);

function stats() {
    const rows = linkedOrders();
    const done = rows.filter(([, order]) => order.status === 'done');
    const open = rows.filter(([, order]) => order.status !== 'done');
    const recentDone = done.filter(([, order]) => nonNegative(order.completedAt, order.createdAt) >= Date.now() - 30 * 86400000);
    const downtime = recentDone.reduce((sum, [, order]) => sum + nonNegative(order.downtimeHours), 0);
    const repairHours = done.map(([, order]) => nonNegative(order.actualHours, order.downtimeHours)).filter(Boolean);
    const mttr = repairHours.length ? repairHours.reduce((a, b) => a + b, 0) / repairHours.length : 0;
    const partsCost = rows.reduce((sum, [id]) => sum + entries(parts[id]).reduce((partSum, [, item]) => partSum + nonNegative(item.qty) * nonNegative(item.unitPrice), 0), 0);
    const orderCost = rows.reduce((sum, [, order]) => sum + nonNegative(order.actualCost, order.estimatedCost), 0);
    const availability = Math.max(0, 100 - downtime / (30 * 24) * 100);
    return { rows, done, open, downtime, mttr, totalCost: orderCost + partsCost, availability };
}

function health() {
    const result = stats();
    let score = 100; const reasons = [];
    if (asset?.status === 'danger') { score -= 35; reasons.push(['Crítico', 'Ativo cadastrado em estado de falha.', 'red']); }
    else if (asset?.status === 'offline') { score -= 12; reasons.push(['Parado', 'Ativo está marcado como desligado.', 'slate']); }
    if (nonNegative(asset?.temp) >= 80) { score -= 25; reasons.push(['Temperatura', `Leitura atual em ${nonNegative(asset.temp)} °C.`, 'red']); }
    else if (nonNegative(asset?.temp) >= 60) { score -= 10; reasons.push(['Temperatura', 'Temperatura pede acompanhamento.', 'amber']); }
    const urgent = result.open.filter(([, order]) => ['danger', 'urgent'].includes(order.priority)).length;
    if (urgent) { score -= Math.min(25, urgent * 8); reasons.push(['Backlog', `${urgent} O.S. urgente ou crítica aberta.`, 'amber']); }
    const reading = currentTelemetry().reading;
    if (reading?.severity === 'critical' && Date.now() - nonNegative(reading.receivedAt) < 60000) { score -= 20; reasons.push(['Telemetria', 'Gateway classificou a leitura atual como crítica.', 'red']); }
    if (result.availability < nonNegative(asset?.targetAvailability, 95)) { score -= 8; reasons.push(['Disponibilidade', `Estimativa de ${result.availability.toFixed(1)}%, abaixo da meta cadastrada.`, 'amber']); }
    const criticalFindings = findings().filter((item) => item.status === 'critical' && nonNegative(item.createdAt) >= Date.now() - 90 * 86400000).length;
    if (criticalFindings) { score -= Math.min(15, criticalFindings * 5); reasons.push(['Inspeção', `${criticalFindings} achado(s) crítico(s) registrado(s).`, 'red']); }
    if (!reasons.length) reasons.push(['Estável', 'Nenhum desvio relevante foi encontrado nas regras atuais.', 'green']);
    return { score: Math.max(0, Math.round(score)), reasons };
}

function currentTelemetry() {
    const match = entries(deviceConfigs).find(([, config]) => config.assetId === assetId);
    const deviceId = match?.[0] || asset?.iotId || asset?.deviceId || '';
    return { deviceId, reading: telemetryLatest[deviceId] };
}

function findings() {
    return entries(inspectionResults).flatMap(([executionId, values]) => entries(values).map(([id, item]) => ({ ...item, id, executionId }))).filter((item) => item.assetId === assetId).sort((a, b) => nonNegative(b.createdAt) - nonNegative(a.createdAt));
}

function render() {
    if (!asset) return;
    const result = stats(); const condition = health();
    const status = asset.status === 'online' ? ['Operando', 'green'] : asset.status === 'danger' ? ['Falha', 'red'] : ['Desligado', 'slate'];
    document.getElementById('asset-hero').innerHTML = `<div><div class="s3-chip-row"><span class="s3-badge s3-badge--${status[1]}">${status[0]}</span><span class="s3-badge s3-badge--purple">Criticidade ${escapeHtml(asset.criticality || 'B')}</span></div><h2 class="text-2xl font-black mt-2">${escapeHtml(asset.name || assetId)}</h2><p class="text-slate-500 mt-1">${escapeHtml(asset.area || 'Área não definida')} · #${escapeHtml(assetId)}</p></div><div class="s5-score" style="--score:${condition.score}"><div class="text-center"><strong>${condition.score}%</strong><small>Saúde</small></div></div>`;
    document.getElementById('kpi-availability').textContent = `${result.availability.toFixed(1)}%`;
    document.getElementById('kpi-open-orders').textContent = result.open.length;
    document.getElementById('kpi-mttr').textContent = result.mttr ? `${result.mttr.toFixed(1)}h` : '—';
    document.getElementById('kpi-cost').textContent = formatCurrency(result.totalCost);
    document.getElementById('new-order-link').href = `os.html?acao=nova_os&maquina=${encodeURIComponent(assetId)}`;
    document.getElementById('edit-profile').hidden = !canEdit(); document.getElementById('add-document').hidden = !canEdit();
    renderProfile(); renderReasons(condition); renderOrders(result.rows); renderTelemetry(); renderFindings(); renderDocuments();
}

function renderProfile() {
    const fields = [['Fabricante', asset.manufacturer], ['Modelo', asset.model], ['Número de série', asset.serialNumber], ['Classe', asset.assetClass], ['Estratégia', asset.maintenanceStrategy || 'Preventiva'], ['Instalação', asset.installDate ? formatDate(new Date(asset.installDate + 'T12:00:00').getTime()) : '—'], ['Meta de disponibilidade', `${nonNegative(asset.targetAvailability, 95)}%`], ['Identificação IoT', asset.iotId || currentTelemetry().deviceId || 'Não vinculada']];
    document.getElementById('asset-profile').innerHTML = `<div class="s4-metric-grid">${fields.map(([label, value]) => `<div class="s4-metric"><span>${label}</span><strong class="text-sm">${escapeHtml(value || '—')}</strong></div>`).join('')}</div>`;
}

function renderReasons(condition) {
    document.getElementById('health-reasons').innerHTML = condition.reasons.map(([title, description, tone]) => `<div class="s3-list-item"><div class="s3-list-item__top"><h4>${escapeHtml(title)}</h4><span class="s3-badge s3-badge--${tone}">${tone === 'green' ? 'OK' : 'Verificar'}</span></div><p>${escapeHtml(description)}</p></div>`).join('');
}

function renderOrders(rows) {
    document.getElementById('asset-orders').innerHTML = rows.sort((a, b) => nonNegative(b[1].createdAt) - nonNegative(a[1].createdAt)).map(([id, order]) => `<tr><td><strong>${escapeHtml(order.title || id)}</strong><small>#${escapeHtml(id)}</small></td><td>${escapeHtml(order.type || '—')}</td><td><span class="s3-badge ${order.status === 'done' ? 's3-badge--green' : order.status === 'doing' ? 's3-badge--blue' : 's3-badge--slate'}">${order.status === 'done' ? 'Concluída' : order.status === 'doing' ? 'Executando' : 'Pendente'}</span></td><td>${formatDate(order.completedAt || order.createdAt)}</td><td>${nonNegative(order.downtimeHours).toFixed(1)}h</td><td>${formatCurrency(nonNegative(order.actualCost, order.estimatedCost))}</td><td><a class="s3-btn s3-btn--sm" href="os-detalhes.html?id=${encodeURIComponent(id)}">Abrir</a></td></tr>`).join('') || '<tr><td colspan="7"><div class="s3-empty">Nenhuma O.S. vinculada.</div></td></tr>';
}

function renderTelemetry() {
    const { deviceId, reading } = currentTelemetry();
    document.getElementById('telemetry-device').textContent = deviceId ? `Dispositivo ${deviceId}` : 'Dispositivo não vinculado.';
    const fresh = reading && Date.now() - nonNegative(reading.receivedAt) < 60000;
    const badge = document.getElementById('telemetry-status'); badge.className = `s3-badge ${fresh ? reading.severity === 'critical' ? 's3-badge--red' : reading.severity === 'warning' ? 's3-badge--amber' : 's3-badge--green' : 's3-badge--slate'}`; badge.textContent = fresh ? reading.severity === 'critical' ? 'Crítico' : reading.severity === 'warning' ? 'Atenção' : 'Online' : 'Sem sinal';
    const values = [['Temperatura', reading ? `${Number(reading.temperature).toFixed(1)} °C` : '—'], ['Vibração', reading ? `${Number(reading.vibration).toFixed(2)} mm/s` : '—'], ['Energia', reading ? `${Number(reading.energyKwh).toFixed(2)} kWh` : '—'], ['Rotação', reading ? `${Number(reading.rpm).toFixed(0)} rpm` : '—']];
    document.getElementById('telemetry-metrics').innerHTML = values.map(([label, value]) => `<div class="s4-metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
    subscribeTelemetry(deviceId);
}

let subscribedDevice = '';
function subscribeTelemetry(deviceId) {
    if (deviceId === subscribedDevice) return; subscribedDevice = deviceId; telemetryHistoryUnsubscribe?.();
    if (!deviceId) return drawTelemetry({});
    telemetryHistoryUnsubscribe = onValue(query(ref(db, `telemetry/history/${deviceId}`), limitToLast(60)), (snapshot) => drawTelemetry(snapshot.val() || {}), () => drawTelemetry({}));
}

function drawTelemetry(history) {
    const rows = entries(history).map(([, item]) => item).sort((a, b) => nonNegative(a.receivedAt) - nonNegative(b.receivedAt)); const canvas = document.getElementById('asset-telemetry-chart'); const empty = document.getElementById('telemetry-empty'); chart?.destroy();
    if (!rows.length || !window.Chart) { canvas.hidden = true; empty.hidden = false; empty.innerHTML = emptyState('fa-chart-line', 'Sem histórico', 'Vincule um dispositivo pela Central IoT.'); return; }
    canvas.hidden = false; empty.hidden = true;
    chart = new window.Chart(canvas, { type: 'line', data: { labels: rows.map((item) => new Date(item.receivedAt).toLocaleTimeString('pt-BR')), datasets: [{ label: 'Temperatura °C', data: rows.map((item) => item.temperature), borderColor: '#f59e0b', tension: .25, yAxisID: 'y' }, { label: 'Vibração mm/s', data: rows.map((item) => item.vibration), borderColor: '#3b82f6', tension: .25, yAxisID: 'y1' }] }, options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { y1: { position: 'right', grid: { display: false } } } } });
}

function renderFindings() {
    document.getElementById('inspection-findings').innerHTML = findings().slice(0, 30).map((item) => `<article class="s3-list-item"><div class="s3-list-item__top"><h4>${escapeHtml(item.routeName || 'Inspeção')}</h4><span class="s3-badge ${item.status === 'critical' ? 's3-badge--red' : item.status === 'attention' ? 's3-badge--amber' : 's3-badge--green'}">${item.status === 'critical' ? 'Crítico' : item.status === 'attention' ? 'Atenção' : 'Conforme'}</span></div><p>${escapeHtml(item.note || 'Sem observações.')}</p><div class="s3-meta"><span>${formatDateTime(item.createdAt)}</span><span>${escapeHtml(item.inspectorName || '')}</span></div></article>`).join('') || emptyState('fa-list-check', 'Sem inspeções', 'Os resultados das rotas aparecerão aqui.');
}

function renderDocuments() {
    document.getElementById('asset-documents').innerHTML = entries(documents).map(([id, item]) => { const url = safeUrl(item.url); return `<article class="s3-list-item"><div class="s3-list-item__top"><h4><i class="fas fa-file-lines mr-2 text-blue-500" aria-hidden="true"></i>${escapeHtml(item.title || 'Documento')}</h4><span class="s3-badge s3-badge--slate">${escapeHtml(item.type || 'Arquivo')}</span></div><p>Adicionado em ${formatDate(item.createdAt)}</p><div class="s3-actions mt-3">${url ? `<a class="s3-btn s3-btn--sm" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Abrir</a>` : ''}${canEdit() ? `<button class="s3-btn s3-btn--sm s3-btn--danger" type="button" data-remove-document="${escapeHtml(id)}">Excluir</button>` : ''}</div></article>`; }).join('') || emptyState('fa-folder-open', 'Nenhum documento', 'Adicione links para manuais, procedimentos e desenhos.');
    const linkedWarranties = entries(warranties).filter(([, item]) => item.assetId === assetId).sort((a, b) => String(b[1].endDate || '').localeCompare(String(a[1].endDate || '')));
    document.getElementById('asset-warranties').innerHTML = linkedWarranties.map(([, item]) => { const active = item.endDate && new Date(`${item.endDate}T23:59:59`).getTime() >= Date.now(); return `<article class="s3-list-item"><div class="s3-list-item__top"><h4><i class="fas fa-shield-halved mr-2 ${active ? 'text-emerald-500' : 'text-slate-400'}" aria-hidden="true"></i>${escapeHtml(item.coverageType || 'Garantia')}</h4><span class="s3-badge ${active ? 's3-badge--green' : 's3-badge--slate'}">${active ? 'Vigente' : 'Vencida'}</span></div><p>Vencimento: ${escapeHtml(item.endDate || '—')} · Ref. ${escapeHtml(item.reference || '—')}</p><small>${escapeHtml(item.notes || 'Sem condições adicionais.')}</small></article>`; }).join('') || emptyState('fa-shield', 'Sem garantia cadastrada', 'Consulte o fornecedor antes de aprovar custos externos.');
}

document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('[data-tab]').forEach((item) => item.setAttribute('aria-selected', String(item === button))); document.querySelectorAll('.s5-panel').forEach((panel) => { panel.hidden = panel.id !== `panel-${button.dataset.tab}`; }); }));
document.getElementById('edit-profile').addEventListener('click', () => { if (!canEdit() || !asset) return; document.getElementById('asset-criticality').value = asset.criticality || 'B'; document.getElementById('asset-strategy').value = asset.maintenanceStrategy || 'Preventiva'; document.getElementById('asset-manufacturer').value = asset.manufacturer || ''; document.getElementById('asset-model').value = asset.model || ''; document.getElementById('asset-serial').value = asset.serialNumber || ''; document.getElementById('asset-install-date').value = asset.installDate || ''; document.getElementById('asset-target').value = nonNegative(asset.targetAvailability, 95); document.getElementById('asset-class').value = asset.assetClass || ''; openDialog('profile-dialog'); });
document.getElementById('add-document').addEventListener('click', () => { document.getElementById('document-form').reset(); openDialog('document-dialog'); });

document.getElementById('profile-form').addEventListener('submit', async (event) => { event.preventDefault(); if (!canEdit()) return toast('error', 'Seu cargo possui acesso somente para consulta.'); const button = document.getElementById('profile-submit'); setButtonBusy(button, true, 'Salvando...'); try { await update(ref(db, `assets/${assetId}`), { criticality: document.getElementById('asset-criticality').value, maintenanceStrategy: document.getElementById('asset-strategy').value, manufacturer: document.getElementById('asset-manufacturer').value.trim(), model: document.getElementById('asset-model').value.trim(), serialNumber: document.getElementById('asset-serial').value.trim(), installDate: document.getElementById('asset-install-date').value, targetAvailability: Number(document.getElementById('asset-target').value), assetClass: document.getElementById('asset-class').value.trim(), profileUpdatedAt: Date.now(), profileUpdatedByUid: context.user.uid }); await writeAuditLog({ action: 'update', entity: 'asset_profile', entityId: assetId, description: `Ficha técnica de ${asset.name || assetId} atualizada.` }); closeDialog('profile-dialog'); toast('success', 'Ficha técnica atualizada.'); } catch (error) { console.error(error); toast('error', 'Não foi possível atualizar a ficha.'); } finally { setButtonBusy(button, false); } });

document.getElementById('document-form').addEventListener('submit', async (event) => { event.preventDefault(); if (!canEdit()) return toast('error', 'Seu cargo possui acesso somente para consulta.'); const url = safeUrl(document.getElementById('document-url').value.trim()); if (!url) return toast('error', 'Informe um link HTTPS válido.'); const button = document.getElementById('document-submit'); setButtonBusy(button, true, 'Adicionando...'); try { const created = await push(ref(db, `asset_documents/${assetId}`), { title: document.getElementById('document-name').value.trim(), type: document.getElementById('document-type').value, url, createdAt: Date.now(), createdByUid: context.user.uid, createdBy: context.profile.name || '' }); await writeAuditLog({ action: 'create', entity: 'asset_document', entityId: created.key, description: `Documento adicionado ao ativo ${asset.name || assetId}.` }); closeDialog('document-dialog'); toast('success', 'Documento adicionado.'); } catch (error) { console.error(error); toast('error', 'Não foi possível adicionar o documento.'); } finally { setButtonBusy(button, false); } });

document.addEventListener('click', async (event) => { const button = event.target.closest('[data-remove-document]'); if (!button || !canEdit() || !confirm('Excluir este documento da ficha?')) return; await remove(ref(db, `asset_documents/${assetId}/${button.dataset.removeDocument}`)); await writeAuditLog({ action: 'delete', entity: 'asset_document', entityId: button.dataset.removeDocument, description: `Documento removido do ativo ${assetId}.` }); toast('success', 'Documento removido.'); });

startProtectedPage('ativo-detalhes', (pageContext) => {
    context = pageContext;
    if (!assetId) { document.getElementById('maintenance-content').innerHTML = '<div class="s3-empty"><div><i class="fas fa-circle-exclamation"></i><strong>Ativo não informado</strong><p>Retorne ao Parque de Ativos e escolha um equipamento.</p></div></div>'; return; }
    onValue(ref(db, `assets/${assetId}`), (snapshot) => { asset = snapshot.val(); if (!asset) { document.getElementById('maintenance-content').innerHTML = '<div class="s3-empty"><div><i class="fas fa-industry"></i><strong>Ativo não encontrado</strong><p>O equipamento pode ter sido removido.</p></div></div>'; return; } render(); });
    onValue(ref(db, 'work_orders'), (snapshot) => { orders = snapshot.val() || {}; render(); });
    onValue(ref(db, 'work_order_parts'), (snapshot) => { parts = snapshot.val() || {}; render(); });
    onValue(ref(db, 'telemetry/latest'), (snapshot) => { telemetryLatest = snapshot.val() || {}; render(); });
    onValue(ref(db, 'iot_device_config'), (snapshot) => { deviceConfigs = snapshot.val() || {}; render(); });
    onValue(ref(db, `asset_documents/${assetId}`), (snapshot) => { documents = snapshot.val() || {}; render(); });
    onValue(ref(db, 'asset_warranties'), (snapshot) => { warranties = snapshot.val() || {}; render(); });
    onValue(ref(db, 'inspection_results'), (snapshot) => { inspectionResults = snapshot.val() || {}; render(); });
});
