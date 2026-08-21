import { guardPage, applyRoleMenu } from './auth-guard.js';
import { db } from './firebase.js';
import { onValue, ref } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { nonNegative } from './security-utils.js';

guardPage('mapa');
applyRoleMenu();

let currentZoom = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;
let chartInstance = null;
let telemetryInterval = null;
let activeFilter = null;
let selectedAssetId = '';
let assetsById = {};

const mapContainer = document.getElementById('map-container');
const zoomWrapper = document.getElementById('zoom-wrapper');
const machineLayer = document.getElementById('machine-layer');
const tooltip = document.getElementById('quick-tooltip');
const toastContainer = document.getElementById('toast-container');

const AREA_POSITIONS = {
    producao: [[15, 25], [25, 65], [35, 40], [40, 75]],
    utilidades: [[60, 25], [72, 38], [82, 68], [65, 75]],
    logistica: [[48, 48], [58, 65], [75, 52], [88, 30]],
    default: [[20, 35], [40, 55], [62, 32], [78, 65]]
};

function updateMapTransform() {
    mapContainer.style.transition = isDragging ? 'none' : 'transform .3s ease';
    mapContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`;
}

zoomWrapper.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.machine-node, button')) return;
    isDragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    zoomWrapper.setPointerCapture?.(event.pointerId);
    zoomWrapper.classList.add('grabbing');
});

zoomWrapper.addEventListener('pointermove', (event) => {
    if (!isDragging) return;
    translateX += event.clientX - lastPointerX;
    translateY += event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    updateMapTransform();
});

function stopDragging() {
    isDragging = false;
    zoomWrapper.classList.remove('grabbing');
    updateMapTransform();
}

zoomWrapper.addEventListener('pointerup', stopDragging);
zoomWrapper.addEventListener('pointercancel', stopDragging);
document.getElementById('zoom-in').addEventListener('click', () => {
    currentZoom = Math.min(2, currentZoom + .1);
    updateMapTransform();
});
document.getElementById('zoom-out').addEventListener('click', () => {
    currentZoom = Math.max(.5, currentZoom - .1);
    updateMapTransform();
});
document.getElementById('zoom-reset').addEventListener('click', () => {
    currentZoom = 1;
    translateX = 0;
    translateY = 0;
    updateMapTransform();
});

function mapStatus(asset = {}) {
    if (asset.status === 'online' && nonNegative(asset.temp) < 80) return 'OPERANDO';
    if (asset.status === 'danger' || nonNegative(asset.temp) >= 80) return 'ALERTA';
    if (asset.status === 'offline') return 'PARADA';
    return 'CONFIGURAR';
}

function statusStyle(status) {
    if (status === 'OPERANDO') return { dot: 'bg-green-500 glow-green', badge: 'bg-green-500/10 text-green-500', label: 'Operando' };
    if (status === 'ALERTA') return { dot: 'bg-yellow-500 glow-yellow', badge: 'bg-yellow-500/10 text-yellow-500', label: 'Alerta' };
    if (status === 'PARADA') return { dot: 'bg-red-500 glow-red', badge: 'bg-red-500/10 text-red-500', label: 'Parada' };
    return { dot: 'bg-blue-500', badge: 'bg-blue-500/10 text-blue-500', label: 'Configurar' };
}

function machinePosition(asset, index) {
    const list = AREA_POSITIONS[asset.area] || AREA_POSITIONS.default;
    const base = list[index % list.length];
    const cycle = Math.floor(index / list.length);
    return [Math.min(90, base[0] + cycle * 4), Math.min(85, base[1] + cycle * 3)];
}

function renderMachines() {
    machineLayer.innerHTML = '';
    const entries = Object.entries(assetsById);
    if (!entries.length) {
        machineLayer.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-slate-400 pointer-events-none"><div class="nexus-empty-state"><i class="fas fa-industry text-2xl"></i><strong>Nenhum ativo cadastrado</strong><span>Cadastre um ativo para vê-lo na planta.</span></div></div>';
        return;
    }

    const areaCounts = {};
    entries.forEach(([id, asset]) => {
        const area = asset.area || 'default';
        const index = areaCounts[area] || 0;
        areaCounts[area] = index + 1;
        const [left, top] = machinePosition(asset, index);
        const status = mapStatus(asset);
        const style = statusStyle(status);
        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'machine-node absolute group cursor-pointer transform hover:scale-110 transition-all duration-300 z-10';
        node.style.left = `${left}%`;
        node.style.top = `${top}%`;
        node.dataset.status = status;
        node.dataset.id = id;
        node.dataset.name = asset.name || 'Ativo sem nome';
        node.dataset.temp = `${nonNegative(asset.temp)} °C`;
        node.setAttribute('aria-label', `Abrir ${asset.name || id}`);
        node.innerHTML = `<span class="block w-6 h-6 ${style.dot} rounded-full animate-pulse border-[3px] border-white dark:border-dark-900"></span><span class="absolute top-8 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-800 dark:text-white bg-white/90 dark:bg-dark-800/90 px-3 py-1 rounded-md backdrop-blur-sm border border-slate-300 dark:border-dark-600 shadow-md whitespace-nowrap"></span>`;
        node.querySelector('span:last-child').textContent = asset.name || id;
        node.addEventListener('click', () => openMachine(id));
        node.addEventListener('pointerenter', (event) => showTooltip(event, id));
        node.addEventListener('pointerleave', () => tooltip.classList.add('hidden'));
        machineLayer.appendChild(node);
    });
    applyMachineFilter();
}

function showTooltip(event, id) {
    const asset = assetsById[id];
    if (!asset || isDragging) return;
    const status = statusStyle(mapStatus(asset));
    tooltip.innerHTML = '';
    const title = document.createElement('strong');
    title.className = 'block mb-1';
    title.textContent = asset.name || id;
    const detail = document.createElement('span');
    detail.textContent = `${status.label} · ${nonNegative(asset.temp)} °C`;
    tooltip.append(title, detail);
    tooltip.style.left = `${event.clientX}px`;
    tooltip.style.top = `${event.clientY}px`;
    tooltip.classList.remove('hidden');
}

function applyMachineFilter() {
    document.querySelectorAll('.machine-node').forEach((node) => {
        const visible = !activeFilter || node.dataset.status === activeFilter;
        node.classList.toggle('opacity-20', !visible);
        node.classList.toggle('pointer-events-none', !visible);
    });
}

document.querySelectorAll('.status-filter').forEach((button) => {
    button.addEventListener('click', () => {
        const next = button.dataset.filter;
        activeFilter = activeFilter === next ? null : next;
        document.querySelectorAll('.status-filter').forEach((item) => item.classList.toggle('ring-2', item.dataset.filter === activeFilter));
        applyMachineFilter();
    });
});

function openMachine(id) {
    const asset = assetsById[id];
    if (!asset) return;
    selectedAssetId = id;
    const status = mapStatus(asset);
    const style = statusStyle(status);
    document.getElementById('modal-machine-name').textContent = asset.name || 'Ativo sem nome';
    document.getElementById('modal-machine-id').textContent = id;
    document.getElementById('modal-machine-ip').textContent = asset.ip || 'Não informado';
    document.getElementById('modal-temp').textContent = `${nonNegative(asset.temp).toFixed(1)} °C`;
    document.getElementById('modal-prod').textContent = String(Math.round(nonNegative(asset.productionCount || asset.production)));
    document.getElementById('modal-rpm').textContent = String(Math.round(nonNegative(asset.rpm)));
    document.getElementById('modal-kwh').textContent = nonNegative(asset.energyKwh).toLocaleString('pt-BR');
    const badge = document.getElementById('modal-status-badge');
    badge.className = `px-3 py-1 rounded-full text-[10px] font-bold uppercase ${style.badge}`;
    badge.textContent = style.label;
    document.getElementById('metrics-expansion').classList.add('hidden');
    document.getElementById('machine-modal').classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('modal-content').classList.remove('scale-95');
    startTelemetry(asset);
}

window.openMachineModal = (id) => openMachine(id);
window.closeMachineModal = function () {
    clearInterval(telemetryInterval);
    document.getElementById('machine-modal').classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('modal-content').classList.add('scale-95');
};

window.redirectToOS = function () {
    if (!selectedAssetId) return;
    window.location.href = `os.html?acao=nova_os&maquina=${encodeURIComponent(selectedAssetId)}`;
};

window.toggleMetrics = function () {
    const area = document.getElementById('metrics-expansion');
    const opening = area.classList.contains('hidden');
    area.classList.toggle('hidden', !opening);
    area.classList.toggle('flex', opening);
    if (opening) renderChart();
};

function startTelemetry(asset) {
    clearInterval(telemetryInterval);
    let temp = nonNegative(asset.temp, 40);
    telemetryInterval = window.setInterval(() => {
        temp = Math.max(0, temp + (Math.random() - .5) * 1.2);
        document.getElementById('modal-temp').textContent = `${temp.toFixed(1)} °C`;
    }, 2500);
}

function renderChart() {
    const asset = assetsById[selectedAssetId] || {};
    const base = nonNegative(asset.temp, 40);
    const data = [5, 4, 3, 2, 1, 0].map((step) => Math.max(0, base - step * .7));
    chartInstance?.destroy();
    chartInstance = new Chart(document.getElementById('telemetryChart').getContext('2d'), {
        type: 'line',
        data: { labels: ['-50m', '-40m', '-30m', '-20m', '-10m', 'Agora'], datasets: [{ data, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.1)', fill: true, tension: .35, pointRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }
    });
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = { success: 'border-green-500', warning: 'border-yellow-500', error: 'border-red-500', info: 'border-blue-500' };
    toast.className = `toast-enter bg-white dark:bg-dark-800 text-slate-700 dark:text-slate-200 p-4 rounded-lg shadow-xl border-l-4 ${colors[type] || colors.info}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3500);
}

onValue(ref(db, 'assets'), (snapshot) => {
    assetsById = snapshot.val() || {};
    renderMachines();
}, () => {
    machineLayer.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-red-500">Não foi possível carregar os ativos.</div>';
    showToast('Falha ao carregar a planta industrial.', 'error');
});

const toggleSidebar = document.getElementById('toggle-sidebar');
toggleSidebar?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const collapsed = sidebar.classList.contains('w-64');
    sidebar.classList.toggle('w-64', !collapsed);
    sidebar.classList.toggle('w-20', collapsed);
    document.getElementById('sidebar-icon')?.classList.toggle('rotate-180', collapsed);
    document.querySelectorAll('.sidebar-text').forEach((text) => text.classList.toggle('hidden', collapsed));
    document.getElementById('sidebar-logo')?.classList.toggle('hidden', collapsed);
    document.getElementById('sidebar-logo-mini')?.classList.toggle('hidden', !collapsed);
    try { localStorage.setItem('nexus-map-sidebar', collapsed ? 'collapsed' : 'expanded'); } catch (error) {}
});

try {
    if (localStorage.getItem('nexus-map-sidebar') === 'collapsed') toggleSidebar?.click();
} catch (error) {
    // O mapa continua funcional mesmo quando o navegador bloqueia armazenamento local.
}

document.getElementById('theme-toggle')?.addEventListener('click', () => document.documentElement.classList.toggle('dark'));
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') window.closeMachineModal();
});

showToast('Planta conectada aos ativos cadastrados.', 'success');
