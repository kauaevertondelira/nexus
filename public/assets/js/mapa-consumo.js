import { auth, db, getAllowedPages, applyAllowedMenu, revealProtectedPage } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { onValue, ref } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { escapeHtml, nonNegative, periodStart } from './security-utils.js';

const TYPE_LABELS = {
    all: 'Todos os tipos',
    energia: 'Energia Elétrica',
    manutencao: 'Manutenção',
    insumos: 'Insumos / MRO'
};
const AREA_LABELS = { producao: 'Produção', utilidades: 'Utilidades', logistica: 'Logística', default: 'Não definida' };
const PERIOD_FACTORS = { '7': 7 / 30, '30': 1, '90': 3, '365': 12 };

let assets = {};
let workOrders = {};
let consumoChart;

function showRestricted(data) {
    document.body.style.overflow = 'hidden';
    document.body.innerHTML = `<div style="min-height:100vh;background:#1d2b40;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;gap:16px;padding:32px;font-family:sans-serif"><div style="font-size:36px">🔒</div><h1>Acesso Restrito</h1><p>O cargo ${escapeHtml(data.role)} não possui acesso a esta página.</p><a href="menu.html" style="padding:12px 24px;background:#3b82f6;border-radius:12px;color:white;text-decoration:none">Voltar ao Painel</a></div>`;
    revealProtectedPage();
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace('login.html?return=mapa-consumo.html');
        return;
    }
    onValue(ref(db, `users/${user.uid}`), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        if (!getAllowedPages(data).includes('mapa-consumo')) {
            showRestricted(data);
            return;
        }
        applyAllowedMenu(data);
        document.getElementById('user-name').textContent = data.name || user.email || 'Usuário';
        document.getElementById('user-role').textContent = data.role || '';
        if (data.photoURL) document.getElementById('user-photo').style.backgroundImage = `url(${data.photoURL})`;
        else document.getElementById('user-photo').innerHTML = '<i class="fas fa-user"></i>';
        revealProtectedPage();
    });
});

function formatValue(value, type) {
    if (type === 'energia') return `${Math.round(value).toLocaleString('pt-BR')} kWh`;
    if (type === 'all') return Math.round(value).toLocaleString('pt-BR');
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildMachines(period) {
    const factor = PERIOD_FACTORS[period] || 1;
    const start = periodStart(period);
    const maintenanceByAsset = {};

    Object.values(workOrders).forEach((order) => {
        if (!order.assetId || nonNegative(order.createdAt) < start) return;
        maintenanceByAsset[order.assetId] = (maintenanceByAsset[order.assetId] || 0) + nonNegative(order.estimatedCost);
    });

    return Object.entries(assets).map(([id, asset]) => ({
        id,
        name: asset.name || id,
        area: asset.area || 'default',
        energia: nonNegative(asset.energyKwh) * factor,
        manutencao: maintenanceByAsset[id] || 0,
        insumos: nonNegative(asset.mroCost) * factor
    }));
}

function renderRanking(containerId, machines, field, unit) {
    const container = document.getElementById(containerId);
    const ordered = [...machines].sort((a, b) => b[field] - a[field]).slice(0, 6);
    if (!ordered.length) {
        container.innerHTML = '<div class="nexus-empty-state"><i class="fas fa-filter"></i><strong>Nenhum dado</strong><span>Cadastre ativos ou escolha outro filtro.</span></div>';
        return;
    }
    const max = Math.max(1, ...ordered.map((machine) => machine[field]));
    const colors = ['bg-brand', 'bg-blue-400', 'bg-purple-500', 'bg-amber-400', 'bg-green-400', 'bg-red-400'];
    container.innerHTML = ordered.map((machine, index) => {
        const percent = Math.round((machine[field] / max) * 100);
        return `<div><div class="flex justify-between items-center text-xs mb-1"><span class="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[60%]">${escapeHtml(machine.name)}</span><span class="text-slate-500 dark:text-slate-400 font-bold text-xxs">${machine[field].toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unit}</span></div><div class="h-2.5 bg-slate-100 dark:bg-dark-700 rounded-full overflow-hidden"><div class="h-full ${colors[index % colors.length]} rounded-full bar-fill" style="width:${percent}%"></div></div><div class="flex justify-between text-xxs text-slate-400 mt-0.5"><span>${escapeHtml(machine.id.slice(-8))}</span><span>${percent}% do maior consumo</span></div></div>`;
    }).join('');
}

function setVisibleType(type) {
    document.querySelectorAll('[data-consumption-panel]').forEach((panel) => {
        const visible = type === 'all' || panel.dataset.consumptionType === type;
        panel.classList.toggle('hidden', !visible);
    });
}

function metric(machine, type) {
    if (type === 'energia') return machine.energia;
    if (type === 'manutencao') return machine.manutencao;
    if (type === 'insumos') return machine.insumos;
    return machine.energia + machine.manutencao + machine.insumos;
}

function renderAreaSummary(machines, type) {
    const grouped = machines.reduce((result, machine) => {
        result[machine.area] = (result[machine.area] || 0) + metric(machine, type);
        return result;
    }, {});
    const total = Object.values(grouped).reduce((sum, value) => sum + value, 0);
    const container = document.getElementById('area-summary');
    if (!total) {
        container.innerHTML = '<div class="nexus-empty-state"><strong>Sem valores no período</strong><span>Preencha energia e MRO nos ativos e custos nas O.S.</span></div>';
        return;
    }
    container.innerHTML = Object.entries(grouped).sort((a, b) => b[1] - a[1]).map(([area, value]) => {
        const percent = Math.round(value / total * 100);
        return `<div><div class="flex justify-between text-xs mb-1"><span class="text-slate-600 dark:text-slate-300 font-medium">${AREA_LABELS[area] || escapeHtml(area)}</span><span class="font-bold">${percent}%</span></div><div class="h-2 bg-slate-100 dark:bg-dark-700 rounded-full overflow-hidden"><div class="h-full bg-brand rounded-full" style="width:${percent}%"></div></div><div class="text-right text-xxs text-slate-400 mt-1">${formatValue(value, type)}</div></div>`;
    }).join('') + `<div class="pt-4 border-t border-slate-200 dark:border-dark-700 flex justify-between text-xs font-bold"><span>Total</span><span>${formatValue(total, type)}</span></div>`;
}

function renderEfficiencyInsights(machines) {
    const measurable = machines.filter((machine) => machine.energia > 0);
    const byArea = measurable.reduce((result, machine) => {
        result[machine.area] ||= [];
        result[machine.area].push(machine.energia);
        return result;
    }, {});
    const averages = Object.fromEntries(Object.entries(byArea).map(([area, values]) => [area, values.reduce((sum, value) => sum + value, 0) / values.length]));
    const deviations = measurable.map((machine) => {
        const average = averages[machine.area] || machine.energia;
        const percentAbove = average ? ((machine.energia - average) / average) * 100 : 0;
        return { ...machine, average, percentAbove, potential: Math.max(0, machine.energia - average) };
    }).filter((machine) => machine.percentAbove >= 25).sort((a, b) => b.percentAbove - a.percentAbove);

    document.getElementById('kpi-energy-alerts').textContent = String(deviations.length);
    document.getElementById('kpi-energy-potential').textContent = Math.round(deviations.reduce((sum, machine) => sum + machine.potential, 0)).toLocaleString('pt-BR');
    const container = document.getElementById('energy-insights');
    if (!measurable.length) {
        container.innerHTML = '<div class="nexus-empty-state"><strong>Sem dados de energia</strong><span>Preencha o consumo mensal nos ativos.</span></div>';
        return;
    }
    if (!deviations.length) {
        container.innerHTML = '<div class="flex items-center gap-3 text-sm text-green-600 dark:text-green-400"><i class="fas fa-circle-check text-xl"></i><span>Nenhum equipamento está 25% acima da média de sua área.</span></div>';
        return;
    }
    container.innerHTML = deviations.slice(0, 4).map((machine) => `<div class="flex items-center justify-between gap-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3"><div class="min-w-0"><p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">${escapeHtml(machine.name)}</p><p class="text-[10px] text-slate-400">${AREA_LABELS[machine.area] || escapeHtml(machine.area)} · média ${Math.round(machine.average).toLocaleString('pt-BR')} kWh</p></div><span class="shrink-0 text-xs font-black text-amber-600">+${Math.round(machine.percentAbove)}%</span></div>`).join('');
}

function updateChart(machines, type) {
    const top = [...machines].sort((a, b) => metric(b, type) - metric(a, type)).slice(0, 8);
    const source = [
        { key: 'energia', label: 'Energia (kWh)', color: '#3b82f6' },
        { key: 'manutencao', label: 'Manutenção (R$)', color: '#f97316' },
        { key: 'insumos', label: 'MRO (R$)', color: '#a855f7' }
    ].filter((item) => type === 'all' || item.key === type);
    consumoChart.data.labels = top.map((machine) => machine.name);
    consumoChart.data.datasets = source.map((item) => ({ label: item.label, data: top.map((machine) => machine[item.key]), backgroundColor: item.color, borderRadius: 5 }));
    consumoChart.update();
    document.getElementById('chart-title').innerHTML = `<i class="fas fa-chart-bar mr-2 text-brand"></i>Comparativo real por equipamento — ${TYPE_LABELS[type]}`;
}

function applyFilters() {
    const area = document.getElementById('filter-area').value;
    const type = document.getElementById('filter-type').value;
    const period = document.getElementById('filter-period').value;
    let machines = buildMachines(period);
    if (area !== 'all') machines = machines.filter((machine) => machine.area === area);

    renderRanking('energia-ranking', machines, 'energia', 'kWh');
    renderRanking('manutencao-ranking', machines, 'manutencao', 'R$');
    renderRanking('insumos-ranking', machines, 'insumos', 'R$');
    document.getElementById('kpi-energia').textContent = Math.round(machines.reduce((sum, machine) => sum + machine.energia, 0)).toLocaleString('pt-BR');
    document.getElementById('kpi-manutencao').textContent = machines.reduce((sum, machine) => sum + machine.manutencao, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('kpi-mro').textContent = machines.reduce((sum, machine) => sum + machine.insumos, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    renderEfficiencyInsights(machines);
    setVisibleType(type);
    renderAreaSummary(machines, type);
    updateChart(machines, type);
}

const dark = document.documentElement.classList.contains('dark');
consumoChart = new Chart(document.getElementById('consumoChart').getContext('2d'), {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: dark ? '#94a3b8' : '#64748b' } } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }
});

['filter-area', 'filter-period', 'filter-type'].forEach((id) => document.getElementById(id).addEventListener('change', applyFilters));

onValue(ref(db, 'assets'), (snapshot) => {
    assets = snapshot.val() || {};
    applyFilters();
}, () => window.nexusToast?.('error', 'Falha ao carregar ativos.'));
onValue(ref(db, 'work_orders'), (snapshot) => {
    workOrders = snapshot.val() || {};
    applyFilters();
}, () => window.nexusToast?.('error', 'Falha ao carregar ordens de serviço.'));

document.getElementById('theme-toggle')?.addEventListener('click', () => document.documentElement.classList.toggle('dark'));
applyFilters();
