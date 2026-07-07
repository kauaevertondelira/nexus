import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD6gj_6e0WuGr6C_hJDkXBK7cI2EopWV1s",
    authDomain: "nexus-iot-senai.firebaseapp.com",
    databaseURL: "https://nexus-iot-senai-default-rtdb.firebaseio.com",
    projectId: "nexus-iot-senai"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// 🔒 SISTEMA DE PROTEÇÃO E BARREIRA DA CONTROLADORIA (RBAC)
onAuthStateChanged(auth, (user) => {
    if (user) {
        onValue(ref(db, 'users/' + user.uid), (snapshot) => {
            const userData = snapshot.val();
            if (userData) {
                
                // --- NOVA TRAVA DE ACESSO AQUI ---
                // Verifica se é Operador. Se for, bloqueia e redireciona.
                if (userData.role === 'Operador') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Acesso Restrito',
                        text: 'Operadores não têm permissão para aceder a esta área.',
                        timer: 2000,
                        showConfirmButton: false
                    }).then(() => {
                        window.location.href = 'menu.html'; // Redireciona para o menu principal
                    });
                    return; // Interrompe a execução do resto do script
                }
                // ---------------------------------

                // Carregamento dos dados do cabeçalho de perfil
                document.getElementById('user-name').innerText = userData.name || "Utilizador";
                document.getElementById('user-role').innerText = userData.role || "Cargo não definido";
                
                // 📸 CORREÇÃO: Renderização idêntica ao estoque.js para carregar a foto de perfil
                if (userData.photoURL) {
                    const photoEl = document.getElementById('user-photo');
                    if (photoEl) {
                        photoEl.innerHTML = `<img src="${userData.photoURL}" class="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-dark-700" alt="Avatar">`;
                    }
                }
            }
        });
    } else {
        window.location.href = 'index.html';
    }
});

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

let chartBar = null;
let chartDoughnut = null;

const getGridColor = () => document.documentElement.classList.contains('dark') ? '#1e293b' : '#f1f5f9';
const getTextColor = () => document.documentElement.classList.contains('dark') ? '#64748b' : '#94a3b8';

function initCharts() {
    const ctxTrend = document.getElementById('trendChart')?.getContext('2d');
    if (ctxTrend) {
        chartBar = new Chart(ctxTrend, {
            type: 'bar',
            data: {
                labels: ['Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar'],
                datasets: [
                    { label: 'Custo Manutenção (R$)', data: [8500, 7200, 10400, 6800, 9100, 4500], backgroundColor: '#3b82f6', borderRadius: 4, barPercentage: 0.5 },
                    { label: 'Prejuízo Downtime (R$)', data: [3000, 1500, 5200, 1200, 2400, 800], backgroundColor: '#ef4444', borderRadius: 4, barPercentage: 0.5 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: getTextColor() } } },
                scales: {
                    y: { grid: { color: getGridColor() }, ticks: { color: getTextColor(), callback: (val) => 'R$ ' + val } },
                    x: { grid: { display: false }, ticks: { color: getTextColor() } }
                }
            }
        });
    }

    const ctxDist = document.getElementById('distributionChart')?.getContext('2d');
    if (ctxDist) {
        chartDoughnut = new Chart(ctxDist, {
            type: 'doughnut',
            data: {
                labels: ['Urgente / Falha', 'Manutenção Normal'],
                datasets: [{
                    data: [1, 1],
                    backgroundColor: ['#ef4444', '#3b82f6'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: getTextColor(), padding: 20 } } },
                cutout: '70%'
            }
        });
    }
}

initCharts();

// Definição industrial de teto de gastos mensais (OPEX da Planta)
const BUDGET_CEILING = 15000.00; 

// 🔄 ALINHAMENTO INDUSTRIAL: Escuta tripla cruzada (Ordens x Ativos x Peças do Stock MRO)
onValue(ref(db, 'work_orders'), (osSnapshot) => {
    const orders = osSnapshot.val() || {};
    
    onValue(ref(db, 'assets'), (assetsSnapshot) => {
        const assets = assetsSnapshot.val() || {};
        
        onValue(ref(db, 'inventory'), (inventorySnapshot) => {
            const inventory = inventorySnapshot.val() || {};
            
            let totalMaintCost = 0;
            let totalDowntimeLoss = 0;
            let urgentCount = 0;
            let normalCount = 0;
            
            const equipmentStats = {};
            Object.keys(assets).forEach(id => {
                equipmentStats[id] = { name: assets[id].name, count: 0, cost: 0 };
            });

            Object.values(orders).forEach(os => {
                const assetId = os.assetId || "maquina_generica";
                
                // 1. Custo de Mão de Obra Técnico Estimado (Padrão Industrial)
                let laborCost = os.type === "Elétrica" ? 250 : os.type === "Mecânica" ? 180 : 100;
                if (os.priority === "Alta") {
                    laborCost *= 1.5; // Adicional de periculosidade/urgência
                    urgentCount++;
                    totalDowntimeLoss += 800; // Prejuízo por hora de máquina parada
                } else {
                    normalCount++;
                }

                // 2. Custo Real de Materiais (MRO Stock Capture)
                let materialCost = 0;
                if (os.partsUsed && typeof os.partsUsed === 'object') {
                    Object.entries(os.partsUsed).forEach(([partId, qtyUsed]) => {
                        const stockItem = inventory[partId];
                        if (stockItem) {
                            const price = parseFloat(stockItem.price) || 0;
                            materialCost += (price * qtyUsed);
                        }
                    });
                }

                // Custo Total da O.S = Mão de Obra + Peças Reais do Almoxarifado
                const totalOsCost = laborCost + materialCost;

                if (os.status === "done") {
                    totalMaintCost += totalOsCost;
                    if (equipmentStats[assetId]) {
                        equipmentStats[assetId].count++;
                        equipmentStats[assetId].cost += totalOsCost;
                    }
                }
            });

            // 📊 Alerta de Estouro de Orçamento (OPEX Guard)
            const kpiMaint = document.getElementById('kpi-custo-manutencao');
            const kpiLoss = document.getElementById('kpi-prejuizo-downtime');
            
            if (kpiMaint) {
                kpiMaint.innerText = `R$ ${totalMaintCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                
                const oldBadge = document.getElementById('budget-badge');
                if (oldBadge) oldBadge.remove();

                const percentUsed = ((totalMaintCost / BUDGET_CEILING) * 100).toFixed(1);
                const badge = document.createElement('div');
                badge.id = 'budget-badge';
                
                if (totalMaintCost > BUDGET_CEILING) {
                    badge.className = "text-xxs font-bold mt-2 px-2.5 py-1 bg-red-500/10 text-red-500 rounded-full border border-red-500/20 inline-flex items-center gap-1 animate-pulse";
                    badge.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Orçamento Estourado em ${percentUsed}%`;
                    kpiMaint.className = "text-2xl font-black text-red-500 tracking-tight transition-colors";
                } else if (totalMaintCost >= BUDGET_CEILING * 0.8) {
                    badge.className = "text-xxs font-bold mt-2 px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20 inline-flex items-center gap-1";
                    badge.innerHTML = `<i class="fas fa-shield-alt"></i> Limite Crítico: ${percentUsed}% consumido`;
                    kpiMaint.className = "text-2xl font-black text-amber-500 tracking-tight transition-colors";
                } else {
                    badge.className = "text-xxs font-bold mt-2 px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20 inline-flex items-center gap-1";
                    badge.innerHTML = `<i class="fas fa-check-circle"></i> Dentro da Meta: ${percentUsed}% utilizado`;
                    kpiMaint.className = "text-2xl font-black text-slate-950 dark:text-white tracking-tight transition-colors";
                }
                kpiMaint.parentElement.appendChild(badge);
            }

            if (kpiLoss) kpiLoss.innerText = `R$ ${totalDowntimeLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

            // Renderização da tabela com os custos REAIS acumulados por ativo
            const tableBody = document.getElementById('cost-table');
            if (tableBody) {
                tableBody.innerHTML = '';
                const sortedEquip = Object.values(equipmentStats).sort((a,b) => b.cost - a.cost);
                
                if (sortedEquip.length === 0 || sortedEquip.every(e => e.cost === 0)) {
                    tableBody.innerHTML = `<tr><td colspan=\"3\" class=\"py-6 text-center text-slate-500\">Nenhum custo registrado para Ordens concluídas.</td></tr>`;
                } else {
                    sortedEquip.forEach(e => {
                        if(e.cost === 0 && e.count === 0) return;
                        const tr = document.createElement('tr');
                        tr.className = "border-b border-slate-100 dark:border-dark-800/30 text-xs text-slate-600 dark:text-slate-300";
                        tr.innerHTML = `
                            <td class=\"py-3.5 font-medium text-slate-800 dark:text-slate-200\">${esc(e.name)}</td>
                            <td class=\"py-3.5 text-center font-semibold text-brand\">${e.count}</td>
                            <td class=\"py-3.5 text-right font-bold text-slate-700 dark:text-slate-100\">R$ ${e.cost.toFixed(2)}</td>
                        `;
                        tableBody.appendChild(tr);
                    });
                }
            }

            if (chartDoughnut) {
                chartDoughnut.data.datasets[0].data = [urgentCount, normalCount];
                chartDoughnut.update();
            }
        });
    });
});

window.toggleTheme = function() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        html.classList.add('dark');
        localStorage.theme = 'dark';
    }
    
    if (chartBar) {
        chartBar.options.scales.y.grid.color = getGridColor();
        chartBar.options.scales.y.ticks.color = getTextColor();
        chartBar.options.scales.x.ticks.color = getTextColor();
        chartBar.update();
    }
    if (chartDoughnut) {
        chartDoughnut.options.plugins.legend.labels.color = getTextColor();
        chartDoughnut.update();
    }
};

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = 'index.html'));
}