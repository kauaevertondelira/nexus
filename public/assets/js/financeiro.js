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
                const cargo = userData.role || "Operador";

                // 🛑 BLOQUEIO CRÍTICO DE URL PARA OPERADORES E TÉCNICOS
                if (cargo === "Operador" || cargo === "Técnico") {
                    Swal.fire({
                        icon: 'error',
                        title: 'Acesso Restrito à Gestão',
                        text: `O seu cargo atual (${cargo}) não confere permissões de auditoria para analisar faturamento, custos de downtime ou custos de MRO.`,
                        confirmButtonColor: '#3b82f6',
                        allowOutsideClick: false
                    }).then(() => {
                        window.location.href = 'menu.html';
                    });
                    return;
                }

                document.getElementById('user-name').innerText = userData.name || "Diretor Financeiro";
                document.getElementById('user-role').innerText = cargo;
                if (userData.photoURL) {
                    document.getElementById('user-photo').innerHTML = `<img src="${userData.photoURL}" class="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-dark-700" alt="Avatar">`;
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

// Consolidação e Processamento de Custos e Cruzamento de Dados
onValue(ref(db, 'work_orders'), (osSnapshot) => {
    const orders = osSnapshot.val() || {};
    
    onValue(ref(db, 'assets'), (assetsSnapshot) => {
        const assets = assetsSnapshot.val() || {};
        
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
            
            // Simulação matemática precisa de custos baseada em tipo de OS e criticidade (RN01)
            let baseCost = os.type === "Elétrica" ? 450 : os.type === "Mecânica" ? 300 : 150;
            if (os.priority === "Alta") {
                baseCost *= 2.5;
                urgentCount++;
                totalDowntimeLoss += 800; // Prejuízo simulado por parada crítica ativa
            } else {
                normalCount++;
            }

            if (os.status === "done") {
                totalMaintCost += baseCost;
                if (equipmentStats[assetId]) {
                    equipmentStats[assetId].count++;
                    equipmentStats[assetId].cost += baseCost;
                }
            }
        });

        // Atualização de KPIS na UI
        const kpiMaint = document.getElementById('kpi-custo-manutencao');
        const kpiLoss = document.getElementById('kpi-prejuizo-downtime');
        if (kpiMaint) kpiMaint.innerText = `R$ ${totalMaintCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        if (kpiLoss) kpiLoss.innerText = `R$ ${totalDowntimeLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

        // Renderização da tabela de maiores custos por ativo
        const tableBody = document.getElementById('cost-table');
        if (tableBody) {
            tableBody.innerHTML = '';
            const sortedEquip = Object.values(equipmentStats).sort((a,b) => b.cost - a.cost);
            
            if (sortedEquip.length === 0 || sortedEquip.every(e => e.cost === 0)) {
                tableBody.innerHTML = `<tr><td colspan="3" class="py-6 text-center text-slate-500">Nenhum custo registrado para Ordens concluídas.</td></tr>`;
            } else {
                sortedEquip.forEach(e => {
                    if(e.cost === 0 && e.count === 0) return;
                    const tr = document.createElement('tr');
                    tr.className = "border-b border-slate-100 dark:border-dark-800/30 text-xs text-slate-600 dark:text-slate-300";
                    tr.innerHTML = `
                        <td class="py-3.5 font-medium text-slate-800 dark:text-slate-200">${esc(e.name)}</td>
                        <td class="py-3.5 text-center font-semibold text-brand">${e.count}</td>
                        <td class="py-3.5 text-right font-bold text-slate-700 dark:text-slate-100">R$ ${e.cost.toFixed(2)}</td>
                    `;
                    tableBody.appendChild(tr);
                });
            }
        }

        // Atualizar Distribuição Gráfica (Doughnut)
        if (chartDoughnut) {
            chartDoughnut.data.datasets[0].data = [urgentCount, normalCount];
            chartDoughnut.update();
        }
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