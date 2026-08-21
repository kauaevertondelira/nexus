import {
    db, ref, onValue, escapeHtml, entries, nonNegative, formatCurrency,
    mountMaintenanceShell, startProtectedPage, emptyState
} from './maintenance-core.js';
import { csvCell, downloadFile, periodStart } from './security-utils.js';

mountMaintenanceShell({
    pageId: 'confiabilidade', title: 'Centro de Confiabilidade', subtitle: 'MTBF, MTTR, disponibilidade, backlog e Pareto de falhas',
    headerActions: '<button id="reliability-print" type="button" class="s3-btn s3-btn--sm"><i class="fas fa-print" aria-hidden="true"></i><span class="hidden sm:inline">Imprimir</span></button>',
    content: `
        <div class="s3-page">
            <div class="s4-notice"><i class="fas fa-circle-info mt-1" aria-hidden="true"></i><div><strong>Indicadores operacionais estimados</strong><p class="mt-1 text-xs">Os cálculos usam as horas e paradas registradas nas O.S. A precisão depende do preenchimento do histórico e não substitui uma análise de engenharia.</p></div></div>
            <div class="s3-toolbar mt-4"><div class="s3-toolbar-group"><select id="reliability-period" class="s3-input" aria-label="Período"><option value="30">Últimos 30 dias</option><option value="90" selected>Últimos 90 dias</option><option value="180">Últimos 180 dias</option><option value="365">Últimos 12 meses</option><option value="all">Todo o histórico</option></select><select id="reliability-area" class="s3-input" aria-label="Área"><option value="all">Todas as áreas</option></select><input id="reliability-search" class="s3-input" type="search" placeholder="Buscar equipamento" aria-label="Buscar equipamento"></div><button id="reliability-export" type="button" class="s3-btn s3-btn--primary s3-btn--sm"><i class="fas fa-file-csv" aria-hidden="true"></i>Exportar CSV</button></div>
            <div class="s3-grid s3-grid--kpi"><article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Disponibilidade</span><strong id="kpi-availability" class="s3-kpi__value">—</strong></div><span class="s3-kpi__icon"><i class="fas fa-gauge-high" aria-hidden="true"></i></span></article><article class="s3-card s3-kpi"><div><span class="s3-kpi__label">MTBF médio</span><strong id="kpi-mtbf" class="s3-kpi__value">—</strong></div><span class="s3-kpi__icon"><i class="fas fa-arrow-trend-up" aria-hidden="true"></i></span></article><article class="s3-card s3-kpi"><div><span class="s3-kpi__label">MTTR médio</span><strong id="kpi-mttr" class="s3-kpi__value">—</strong></div><span class="s3-kpi__icon"><i class="fas fa-stopwatch" aria-hidden="true"></i></span></article><article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Backlog</span><strong id="kpi-backlog" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-layer-group" aria-hidden="true"></i></span></article></div>
            <div class="s3-grid s3-grid--2"><article class="s3-card"><div class="s3-card__head"><div><h3>Falhas por equipamento</h3><p>Pareto de ocorrências corretivas.</p></div></div><div id="failure-pareto" class="s3-card__body"></div></article><article class="s3-card"><div class="s3-card__head"><div><h3>Desempenho do período</h3><p>Conformidade preventiva e de inspeção.</p></div></div><div class="s3-card__body space-y-4"><div><div class="s3-row justify-between mb-2"><strong>Preventivas concluídas</strong><span id="preventive-value">0%</span></div><div class="s3-progress"><span id="preventive-progress" style="width:0%"></span></div></div><div><div class="s3-row justify-between mb-2"><strong>Inspeções conformes</strong><span id="inspection-value">0%</span></div><div class="s3-progress"><span id="inspection-progress" style="width:0%"></span></div></div><div><div class="s3-row justify-between mb-2"><strong>O.S. dentro do SLA</strong><span id="sla-value">0%</span></div><div class="s3-progress"><span id="sla-progress" style="width:0%"></span></div></div><div class="s4-metric-grid"><div class="s4-metric"><span>Falhas</span><strong id="summary-failures">0</strong></div><div class="s4-metric"><span>Parada</span><strong id="summary-downtime">0h</strong></div><div class="s4-metric"><span>Custo</span><strong id="summary-cost">R$ 0</strong></div><div class="s4-metric"><span>Backlog crítico</span><strong id="summary-critical">0</strong></div></div></div></article></div>
            <section class="s3-card mt-4"><div class="s3-card__head"><div><h3>Ranking de equipamentos</h3><p>Indicadores calculados individualmente.</p></div><span id="asset-count" class="s3-badge s3-badge--blue">0 ativos</span></div><div class="overflow-x-auto"><table class="s3-table"><thead><tr><th>Equipamento</th><th>Criticidade</th><th>Falhas</th><th>MTBF</th><th>MTTR</th><th>Disponibilidade</th><th>Parada</th><th>Custo</th><th></th></tr></thead><tbody id="reliability-table"></tbody></table></div></section>
        </div>`
});

let assets = {}, orders = {}, parts = {}, inspectionResults = {};
let currentRows = [];

function orderTimestamp(order) { return nonNegative(order.completedAt, order.createdAt); }
function isCorrective(order) { return !String(order.type || '').toLowerCase().includes('prevent'); }
function repairHours(order) { return nonNegative(order.actualHours, order.downtimeHours); }
function partCost(orderId) { return entries(parts[orderId]).reduce((sum, [, item]) => sum + nonNegative(item.qty) * nonNegative(item.unitPrice), 0); }
function orderCost(id, order) { return nonNegative(order.actualCost, order.estimatedCost) + partCost(id); }
function dueAt(order) { const hours = { danger: 4, urgent: 12, normal: 72, low: 168 }[order.priority] || 72; return nonNegative(order.dueAt, nonNegative(order.createdAt) + hours * 3600000); }

function filters() {
    const days = document.getElementById('reliability-period').value; const earliest = Math.min(Date.now(), ...entries(orders).map(([, order]) => nonNegative(order.createdAt, Date.now()))); const periodHours = days === 'all' ? Math.max(24, (Date.now() - earliest) / 3600000) : Number(days) * 24; return { days, since: periodStart(days), area: document.getElementById('reliability-area').value, search: document.getElementById('reliability-search').value.trim().toLowerCase(), periodHours };
}

function calculateRows() {
    const f = filters();
    return entries(assets).filter(([, asset]) => (f.area === 'all' || asset.area === f.area) && `${asset.name || ''} ${asset.area || ''}`.toLowerCase().includes(f.search)).map(([assetId, asset]) => {
        const allLinked = entries(orders).filter(([, order]) => order.assetId === assetId);
        const linked = allLinked.filter(([, order]) => orderTimestamp(order) >= f.since);
        const failures = linked.filter(([, order]) => order.status === 'done' && isCorrective(order));
        const downtime = linked.reduce((sum, [, order]) => sum + nonNegative(order.downtimeHours), 0);
        const repair = failures.reduce((sum, [, order]) => sum + repairHours(order), 0);
        const operating = Math.max(0, f.periodHours - downtime);
        const mtbf = failures.length ? operating / failures.length : operating;
        const mttr = failures.length ? repair / failures.length : 0;
        const availability = f.periodHours ? Math.max(0, Math.min(100, operating / f.periodHours * 100)) : 100;
        const cost = linked.reduce((sum, [id, order]) => sum + orderCost(id, order), 0);
        const backlog = allLinked.filter(([, order]) => order.status !== 'done').length;
        const criticalBacklog = allLinked.filter(([, order]) => order.status !== 'done' && ['urgent', 'danger'].includes(order.priority)).length;
        return { assetId, asset, linked, failures: failures.length, downtime, repair, mtbf, mttr, availability, cost, backlog, criticalBacklog };
    }).sort((a, b) => b.failures - a.failures || b.downtime - a.downtime);
}

function percentage(done, total) { return total ? Math.round(done / total * 100) : 0; }
function setProgress(id, value) { const bounded = Math.max(0, Math.min(100, value)); document.getElementById(`${id}-value`).textContent = `${bounded}%`; document.getElementById(`${id}-progress`).style.width = `${bounded}%`; }

function renderAreas() {
    const select = document.getElementById('reliability-area'); const current = select.value; const areas = [...new Set(entries(assets).map(([, asset]) => asset.area).filter(Boolean))].sort(); select.innerHTML = '<option value="all">Todas as áreas</option>' + areas.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join(''); if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function render() {
    currentRows = calculateRows(); const f = filters(); const totalPeriodHours = Math.max(1, currentRows.length * f.periodHours); const totalDowntime = currentRows.reduce((sum, row) => sum + row.downtime, 0); const totalFailures = currentRows.reduce((sum, row) => sum + row.failures, 0); const totalRepair = currentRows.reduce((sum, row) => sum + row.repair, 0); const totalCost = currentRows.reduce((sum, row) => sum + row.cost, 0); const backlog = currentRows.reduce((sum, row) => sum + row.backlog, 0); const critical = currentRows.reduce((sum, row) => sum + row.criticalBacklog, 0); const availability = Math.max(0, Math.min(100, (totalPeriodHours - totalDowntime) / totalPeriodHours * 100)); const mtbf = totalFailures ? Math.max(0, totalPeriodHours - totalDowntime) / totalFailures : 0; const mttr = totalFailures ? totalRepair / totalFailures : 0;
    document.getElementById('kpi-availability').textContent = `${availability.toFixed(1)}%`; document.getElementById('kpi-mtbf').textContent = totalFailures ? `${mtbf.toFixed(1)}h` : '—'; document.getElementById('kpi-mttr').textContent = totalFailures ? `${mttr.toFixed(1)}h` : '—'; document.getElementById('kpi-backlog').textContent = backlog; document.getElementById('summary-failures').textContent = totalFailures; document.getElementById('summary-downtime').textContent = `${totalDowntime.toFixed(1)}h`; document.getElementById('summary-cost').textContent = formatCurrency(totalCost); document.getElementById('summary-critical').textContent = critical; document.getElementById('asset-count').textContent = `${currentRows.length} ativo${currentRows.length === 1 ? '' : 's'}`;
    const selectedOrderIds = new Set(currentRows.flatMap((row) => row.linked.map(([id]) => id))); const selectedOrders = entries(orders).filter(([id]) => selectedOrderIds.has(id)); const preventive = selectedOrders.filter(([, order]) => String(order.type || '').toLowerCase().includes('prevent')); const completedPreventive = preventive.filter(([, order]) => order.status === 'done').length; const completed = selectedOrders.filter(([, order]) => order.status === 'done'); const slaDone = completed.filter(([, order]) => nonNegative(order.completedAt, Infinity) <= dueAt(order)).length; const selectedAssetIds = new Set(currentRows.map((row) => row.assetId)); const inspection = entries(inspectionResults).flatMap(([, values]) => entries(values).map(([, item]) => item)).filter((item) => selectedAssetIds.has(item.assetId) && nonNegative(item.createdAt) >= f.since); setProgress('preventive', percentage(completedPreventive, preventive.length)); setProgress('inspection', percentage(inspection.filter((item) => item.status === 'ok').length, inspection.length)); setProgress('sla', percentage(slaDone, completed.length));
    renderPareto(totalFailures); renderTable();
}

function renderPareto(totalFailures) {
    const rows = currentRows.filter((row) => row.failures > 0).slice(0, 8); const max = Math.max(1, ...rows.map((row) => row.failures)); document.getElementById('failure-pareto').innerHTML = rows.map((row) => `<div class="s5-pareto-row"><strong class="truncate">${escapeHtml(row.asset.name || row.assetId)}</strong><div class="s5-bar"><span style="width:${row.failures / max * 100}%"></span></div><span class="font-bold text-right">${row.failures}</span></div>`).join('') + (rows.length ? `<p class="text-xs text-slate-500 mt-4">${totalFailures} ocorrência(s) corretiva(s) no recorte atual.</p>` : emptyState('fa-circle-check', 'Sem falhas corretivas', 'Nenhuma O.S. corretiva concluída no período.'));
}

function renderTable() {
    document.getElementById('reliability-table').innerHTML = currentRows.map((row) => `<tr><td><strong>${escapeHtml(row.asset.name || row.assetId)}</strong><small>${escapeHtml(row.asset.area || 'Sem área')}</small></td><td><span class="s3-badge ${row.asset.criticality === 'A' ? 's3-badge--red' : row.asset.criticality === 'C' ? 's3-badge--green' : 's3-badge--amber'}">${escapeHtml(row.asset.criticality || 'B')}</span></td><td>${row.failures}</td><td>${row.failures ? `${row.mtbf.toFixed(1)}h` : '—'}</td><td>${row.failures ? `${row.mttr.toFixed(1)}h` : '—'}</td><td>${row.availability.toFixed(1)}%</td><td>${row.downtime.toFixed(1)}h</td><td>${formatCurrency(row.cost)}</td><td><a class="s3-btn s3-btn--sm" href="ativo-detalhes.html?id=${encodeURIComponent(row.assetId)}">Ativo 360°</a></td></tr>`).join('') || '<tr><td colspan="9"><div class="s3-empty">Nenhum ativo corresponde aos filtros.</div></td></tr>';
}

['reliability-period', 'reliability-area'].forEach((id) => document.getElementById(id).addEventListener('change', render)); document.getElementById('reliability-search').addEventListener('input', render); document.getElementById('reliability-print').addEventListener('click', () => window.print());
document.getElementById('reliability-export').addEventListener('click', () => { const header = ['Ativo', 'Área', 'Criticidade', 'Falhas', 'MTBF h', 'MTTR h', 'Disponibilidade %', 'Parada h', 'Custo R$']; const lines = [header, ...currentRows.map((row) => [row.asset.name || row.assetId, row.asset.area || '', row.asset.criticality || 'B', row.failures, row.mtbf.toFixed(2), row.mttr.toFixed(2), row.availability.toFixed(2), row.downtime.toFixed(2), row.cost.toFixed(2)])]; downloadFile('\uFEFF' + lines.map((line) => line.map(csvCell).join(';')).join('\n'), `nexus-confiabilidade-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8'); });

startProtectedPage('confiabilidade', () => { onValue(ref(db, 'assets'), (snapshot) => { assets = snapshot.val() || {}; renderAreas(); render(); }); onValue(ref(db, 'work_orders'), (snapshot) => { orders = snapshot.val() || {}; render(); }); onValue(ref(db, 'work_order_parts'), (snapshot) => { parts = snapshot.val() || {}; render(); }); onValue(ref(db, 'inspection_results'), (snapshot) => { inspectionResults = snapshot.val() || {}; render(); }); });
