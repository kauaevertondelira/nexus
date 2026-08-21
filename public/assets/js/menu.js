import { auth, db, getAllowedPages, revealProtectedPage } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { escapeHtml } from "./security-utils.js";

// --- SISTEMA INTERNO DE NOTIFICAÇÕES GLOBAIS ---
let systemNotifications = { assets: [], inventory: [], orders: [], iot: [] };

// --- MOTOR DE ANIMAÇÃO DE ESTADOS DOS CARDS (INTERPOLAÇÃO) ---
const cardStates = { oee: 0, ativos: 0, os: 0, stock: 0 };
let availabilityChart;

function renderDashboardAssets(data = {}) {
    const container = document.getElementById('dashboard-assets-list');
    if (!container) return;
    const score = (asset) => asset.status === 'danger' || Number(asset.temp) > 80 ? 3 : asset.status === 'online' ? 1 : 2;
    const rows = Object.entries(data).sort((a, b) => score(b[1]) - score(a[1]) || Number(b[1].temp || 0) - Number(a[1].temp || 0)).slice(0, 4);
    if (!rows.length) {
        container.innerHTML = '<div class="dashboard-empty-inline"><i class="fas fa-circle-info"></i>Nenhum equipamento cadastrado.</div>';
        return;
    }
    container.innerHTML = rows.map(([assetId, asset]) => {
        const critical = asset.status === 'danger' || Number(asset.temp) > 80;
        const online = asset.status === 'online' && !critical;
        const state = critical ? ['Crítico', 'danger'] : online ? ['Operando', 'success'] : ['Desligado', 'neutral'];
        const temperature = Number.isFinite(Number(asset.temp)) ? `${Number(asset.temp).toFixed(1)}°C` : '—';
        return `<a href="ativo-detalhes.html?id=${encodeURIComponent(assetId)}" data-page="ativo-detalhes" class="dashboard-asset-row"><span class="dashboard-status-dot" data-tone="${state[1]}"></span><span class="min-w-0 flex-1"><strong>${escapeHtml(asset.name || assetId)}</strong><small>${escapeHtml(asset.area || 'Área não definida')}</small></span><span class="text-right"><strong>${temperature}</strong><small>${state[0]}</small></span></a>`;
    }).join('');
}

function renderOrderSummary(data = {}) {
    const orders = Object.values(data);
    const todo = orders.filter((order) => order.status === 'todo').length;
    const doing = orders.filter((order) => order.status === 'doing').length;
    const done = orders.filter((order) => order.status === 'done').length;
    const overdue = orders.filter((order) => {
        if (order.status === 'done') return false;
        const hours = { danger: 4, urgent: 12, normal: 72, low: 168 }[order.priority] || 72;
        const dueAt = Number(order.dueAt) || ((Number(order.createdAt) || Date.now()) + hours * 3600000);
        return dueAt < Date.now();
    }).length;
    const completion = orders.length ? Math.round(done / orders.length * 100) : 0;
    document.getElementById('dash-os-todo').textContent = todo;
    document.getElementById('dash-os-doing').textContent = doing;
    document.getElementById('dash-os-done').textContent = done;
    document.getElementById('dash-os-overdue').textContent = overdue;
    document.getElementById('dash-os-progress-value').textContent = `${completion}%`;
    document.getElementById('dash-os-progress').style.width = `${completion}%`;
}

function animateKpi(elementId, key, targetValue) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const startValue = cardStates[key] || 0;
    if (startValue === targetValue) {
        el.innerText = targetValue;
        return;
    }

    const duration = 400; // Tempo da transição em milissegundos
    let startTime = null;

    function animation(currentTime) {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Algoritmo Easing Suave (OutQuad)
        const easeProgress = progress * (2 - progress);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * easeProgress);
        
        el.innerText = currentValue;

        if (progress < 1) {
            requestAnimationFrame(animation);
        } else {
            cardStates[key] = targetValue;
        }
    }
    requestAnimationFrame(animation);
}

function renderNotifications() {
    const listContainer = document.getElementById('notification-items');
    const badge = document.getElementById('bell-badge');
    const countEl = document.getElementById('notification-count');

    const allAlerts = [...systemNotifications.assets, ...systemNotifications.inventory, ...systemNotifications.orders, ...systemNotifications.iot];
    window.NexusPendingAlerts = allAlerts;
    window.NexusNotifications?.sync(allAlerts);

    if (allAlerts.length === 0) {
        badge.classList.add('hidden');
        countEl.innerText = "0";
        listContainer.innerHTML = `
                    <div class="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                        <i class="fas fa-check-circle text-lg text-green-500/50 mb-1 block"></i>
                        Nenhum alerta pendente.
                    </div>`;
    } else {
        badge.classList.remove('hidden');
        countEl.innerText = allAlerts.length;

        listContainer.innerHTML = allAlerts.map(alert => `
                    <div class="p-2 flex items-start gap-3 rounded-xl hover:bg-slate-50 dark:hover:bg-dark-700/40 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-dark-700">
                        <div class="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-xs ${alert.type === 'danger' ? 'bg-red-50 text-red-500 dark:bg-red-500/10' : 'bg-amber-50 text-amber-500 dark:bg-amber-500/10'}">
                            <i class="${alert.icon}"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">${escapeHtml(alert.title)}</p>
                            <p class="text-xxs text-slate-400 dark:text-slate-400 truncate mt-0.5">${escapeHtml(alert.desc)}</p>
                        </div>
                    </div>
                `).join('');
    }
}

    // --- CONEXÃO REAL COM FIREBASE ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            onValue(ref(db, 'users/' + user.uid), (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    document.getElementById('user-name').innerText = data.name;
                    document.getElementById('user-role').innerText = data.role;
                    if (data.photoURL) {
                        document.getElementById('user-photo').style.backgroundImage = `url(${data.photoURL})`;
                        document.getElementById('user-photo').innerHTML = '';
                    } else {
                        document.getElementById('user-photo').innerHTML = '<i class="fas fa-user text-xl"></i>';
                    }
                    revealProtectedPage();
                }
            });
        } else {
            const currentPage = window.location.pathname.split('/').pop() || 'menu.html';
            window.location.replace('login.html?return=' + encodeURIComponent(currentPage));
        }
    });

    // 1. Contagem de Ativos e Alertas Críticos (Real)
    onValue(ref(db, 'assets'), (snapshot) => {
        const data = snapshot.val();
        let total = 0;
        let availability = 0;
        let criticalHtml = '';
        systemNotifications.assets = []; 

        if (data) {
            const ativos = Object.values(data);
            total = ativos.length;
            const onlineCount = ativos.filter((ativo) => ativo.status === 'online').length;
            availability = total ? Math.round((onlineCount / total) * 100) : 0;

            Object.entries(data).forEach(([assetId, ativo]) => {
                if (ativo.status === 'danger' || ativo.temp > 80) {
                    criticalHtml += `
                                <div class="p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-start gap-3">
                                    <i class="fas fa-exclamation-circle text-red-500 mt-0.5"></i>
                                    <div>
                                        <p class="text-xs font-bold text-red-600 dark:text-red-400">${escapeHtml(ativo.name || 'Ativo')}</p>
                                        <p class="text-xxs text-red-500/80">Sobreaquecimento / Falha (${escapeHtml(ativo.temp)}°C)</p>
                                    </div>
                                </div>`;

                    systemNotifications.assets.push({
                        key: `asset:${assetId}`,
                        type: 'danger',
                        icon: 'fas fa-exclamation-circle',
                        title: ativo.name,
                        desc: `Crítico: ${ativo.temp}°C`
                    });
                }
            });
        }
        renderDashboardAssets(data || {});
        
        // REATIVIDADE: Aplica contagem interpolada nos cards de Ativos e OEE
        animateKpi('kpi-ativos', 'ativos', total);
        animateKpi('kpi-oee', 'oee', availability);
        if (availabilityChart) {
            availabilityChart.data.labels.push(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
            availabilityChart.data.datasets[0].data.push(availability);
            if (availabilityChart.data.labels.length > 7) {
                availabilityChart.data.labels.shift();
                availabilityChart.data.datasets[0].data.shift();
            }
            availabilityChart.update();
        }

        const listEl = document.getElementById('critical-list');
        if (criticalHtml === '') {
            listEl.innerHTML = `
                        <div class="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                            <i class="fas fa-check-circle text-3xl mb-2 text-green-500/40 dark:text-green-500/20"></i>
                            <p class="text-xs text-center">Nenhum alerta crítico detectado.</p>
                        </div>`;
        } else {
            listEl.innerHTML = criticalHtml;
        }
        renderNotifications();
    });

    // 2. Contagem Real de O.S. Abertas + Adaptação Visual de Sobrecarga
    onValue(ref(db, 'work_orders'), (snapshot) => {
        const data = snapshot.val();
        let openOsCount = 0;
        systemNotifications.orders = [];
        if (data) {
            Object.entries(data).forEach(([orderId, os]) => {
                if (os.status === 'done') return;
                openOsCount++;
                const slaHours = { danger: 4, urgent: 12, normal: 72, low: 168 }[os.priority] || 72;
                const dueAt = Number(os.dueAt) || ((Number(os.createdAt) || Date.now()) + slaHours * 3600000);
                if (dueAt < Date.now()) {
                    systemNotifications.orders.push({
                        key: `work-order:${orderId}`,
                        type: 'danger',
                        icon: 'fas fa-clock',
                        title: os.title || 'O.S. com SLA atrasado',
                        desc: `SLA vencido em ${new Date(dueAt).toLocaleString('pt-BR')}`
                    });
                }
            });
        }
        renderOrderSummary(data || {});
        
        // REATIVIDADE VISUAL: Transforma a cor do ícone se a fila do PCM acumular
        const iconBox = document.getElementById('icon-os-box');
        if (iconBox) {
            if (openOsCount > 5) {
                iconBox.className = "h-10 w-10 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 flex items-center justify-center text-lg transition-all duration-300 group-hover:scale-110";
            } else {
                iconBox.className = "h-10 w-10 rounded-xl bg-amber-100 text-amber-500 dark:bg-amber-500/10 flex items-center justify-center text-lg transition-all duration-300 group-hover:scale-110";
            }
        }

        animateKpi('kpi-os', 'os', openOsCount);
        renderNotifications();
    });

    // 3. Contagem Real de Estoque Crítico + Alerta de Ruptura Injetado no DOM
    onValue(ref(db, 'inventory'), (snapshot) => {
        const data = snapshot.val();
        let critStockCount = 0;
        systemNotifications.inventory = []; 

        if (data) {
            Object.entries(data).forEach(([itemId, item]) => {
                if (item.qty <= item.min) {
                    critStockCount++;
                    systemNotifications.inventory.push({
                        key: `inventory:${itemId}`,
                        type: 'warning',
                        icon: 'fas fa-box-open',
                        title: item.name || 'Item de Estoque',
                        desc: `Abaixo do mínimo (${item.qty}/${item.min})`
                    });
                } else {
                    const monthlyUse = Number(item.monthlyUse) || 0;
                    const coverageDays = monthlyUse > 0 ? Math.floor((Number(item.qty) / monthlyUse) * 30) : null;
                    if (coverageDays !== null && coverageDays <= 30) {
                        systemNotifications.inventory.push({
                            key: `inventory-forecast:${itemId}`,
                            type: 'warning',
                            icon: 'fas fa-hourglass-half',
                            title: item.name || 'Item de Estoque',
                            desc: `Ruptura estimada em ${coverageDays} dia(s)`
                        });
                    }
                }
            });
        }
        
        // REATIVIDADE VISUAL: O card ganha bordas vermelhas agressivas se houver falha de MRO
        const cardStock = document.getElementById('card-stock');
        const msgStock = document.getElementById('msg-stock');
        
        if (cardStock && msgStock) {
            if (critStockCount > 0) {
                cardStock.classList.add('border-red-300', 'dark:border-red-900/50', 'bg-red-50/10');
                msgStock.className = "text-xs text-red-500 font-medium animate-pulse";
                msgStock.innerHTML = `<i class="fas fa-exclamation-circle mr-1"></i> Ruptura iminente!`;
            } else {
                cardStock.classList.remove('border-red-300', 'dark:border-red-900/50', 'bg-red-50/10');
                msgStock.className = "text-xs text-green-500 font-medium";
                msgStock.innerHTML = `<i class="fas fa-check mr-1"></i> Níveis controlados`;
            }
        }

        animateKpi('kpi-stock', 'stock', critStockCount);
        renderNotifications();
    });

    // 4. Alertas validados pelo gateway MQTT (somente leitura no navegador)
    onValue(ref(db, 'iot_alerts'), (snapshot) => {
        systemNotifications.iot = [];
        const data = snapshot.val() || {};
        Object.entries(data).forEach(([alertId, alert]) => {
            if (alert.acknowledged) return;
            systemNotifications.iot.push({
                key: `iot:${alertId}`,
                type: alert.severity === 'critical' ? 'danger' : 'warning',
                icon: 'fas fa-tower-broadcast',
                title: alert.title || 'Alerta IoT',
                desc: alert.message || 'Telemetria fora do limite'
            });
        });
        renderNotifications();
    });
// --- CONTROLE DE EXIBIÇÃO DO DROPDOWN (SININHO) ---
const bellBtn = document.getElementById('bell-btn');
const dropdown = document.getElementById('notification-dropdown');

bellBtn.addEventListener('click', (e) => {
    e.stopPropagation(); 
    dropdown.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!bellBtn.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// 4. Inicialização do Gráfico (Chart.js)
function chartTheme() {
    const dark = document.documentElement.classList.contains('dark');
    return dark
        ? { line: '#60a5fa', fill: 'rgba(96, 165, 250, 0.10)', grid: '#2b3c55', tick: '#94a3b8' }
        : { line: '#5278a5', fill: 'rgba(82, 120, 165, 0.08)', grid: '#dde3ea', tick: '#6b7788' };
}

const chartCanvas = document.getElementById('disponibilidadeChart');
if (window.Chart) {
    const ctx = chartCanvas.getContext('2d');
    const initialChartTheme = chartTheme();
    availabilityChart = new window.Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Disponibilidade (%)',
                data: [],
                borderColor: initialChartTheme.line,
                backgroundColor: initialChartTheme.fill,
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: initialChartTheme.grid }, ticks: { color: initialChartTheme.tick }, min: 50, max: 100 },
                x: { grid: { display: false }, ticks: { color: initialChartTheme.tick } }
            }
        }
    });

    new MutationObserver(() => {
        const palette = chartTheme();
        availabilityChart.data.datasets[0].borderColor = palette.line;
        availabilityChart.data.datasets[0].backgroundColor = palette.fill;
        availabilityChart.options.scales.y.grid.color = palette.grid;
        availabilityChart.options.scales.y.ticks.color = palette.tick;
        availabilityChart.options.scales.x.ticks.color = palette.tick;
        availabilityChart.update('none');
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
} else {
    chartCanvas.hidden = true;
    chartCanvas.parentElement.insertAdjacentHTML('beforeend', '<div class="dashboard-empty-inline"><i class="fas fa-chart-line"></i>O gráfico será exibido quando a biblioteca visual estiver disponível.</div>');
}

// ==========================================
// CONTROLE DO MODO ESCURO (THEME)
// ==========================================
function toggleTheme() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
    } else {
        html.classList.add('dark');
    }
}

const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
}
// ==========================================
// CONTROLE DE ACESSO — Ocultar itens de menu por cargo
// ==========================================
function applyMenuRestrictions(allowedPages) {
    document.querySelectorAll('[data-page]').forEach((element) => {
        element.style.display = allowedPages.includes(element.dataset.page) ? '' : 'none';
    });
}

// Aplica restrições assim que o usuário for autenticado
onAuthStateChanged(auth, (user) => {
        if (user) {
            const userRef = ref(db, 'users/' + user.uid);
            onValue(userRef, (snap) => {
                const data = snap.val();
                if (data) {
                    applyMenuRestrictions(getAllowedPages(data));
                }
            }, { onlyOnce: true });
        }
});
