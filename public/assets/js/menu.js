import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6gj_6e0WuGr6C_hJDkXBK7cI2EopWV1s",
  authDomain: "nexus-iot-senai.firebaseapp.com",
  databaseURL: "https://nexus-iot-senai-default-rtdb.firebaseio.com",
  projectId: "nexus-iot-senai",
  storageBucket: "nexus-iot-senai.firebasestorage.app",
  messagingSenderId: "717361923500",
  appId: "1:717361923500:web:9e55a4dcb002e049abe609",
  measurementId: "G-JJ84BQSXJX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- SISTEMA INTERNO DE NOTIFICAÇÕES GLOBAIS ---
let systemNotifications = { assets: [], inventory: [] };

function renderNotifications() {
    const listContainer = document.getElementById('notification-list');
    const badge = document.getElementById('notification-badge');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const allNotifs = [...systemNotifications.assets, ...systemNotifications.inventory];

    if (allNotifs.length === 0) {
        listContainer.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">Nenhum alerta pendente</div>';
        if (badge) badge.classList.add('hidden');
        return;
    }

    if (badge) {
        badge.classList.remove('hidden');
        badge.innerText = allNotifs.length;
    }

    allNotifs.forEach(n => {
        const item = document.createElement('div');
        item.className = "p-3 border-b border-slate-100 dark:border-dark-700/50 hover:bg-slate-50 dark:hover:bg-dark-700/30 text-xs transition-colors flex items-start gap-2";
        item.innerHTML = `
            <i class="${n.icon} mt-0.5"></i>
            <div>
                <p class="font-medium text-slate-700 dark:text-slate-300">${n.title}</p>
                <p class="text-slate-400 text-xxs mt-0.5">${n.time}</p>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// Ouvir Ativos Críticos
onValue(ref(db, 'assets'), (snapshot) => {
    const data = snapshot.val() || {};
    systemNotifications.assets = [];
    let criticalHtml = '';
    let totalAssets = 0;
    let onlineAssets = 0;

    Object.keys(data).forEach(id => {
        const a = data[id];
        totalAssets++;
        if (a.status === 'online') onlineAssets++;

        if (a.status === 'offline' || a.temp > 75) {
            const isTemp = a.temp > 75;
            systemNotifications.assets.push({
                title: isTemp ? `Superaquecimento: ${a.name} (${a.temp}°C)` : `Equipamento Offline: ${a.name}`,
                icon: isTemp ? "fas fa-thermometer-high text-amber-500" : "fas fa-exclamation-triangle text-red-500",
                time: "Agora mesmo"
            });

            criticalHtml += `
                <div class="flex items-center justify-between p-3 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 rounded-xl">
                    <div class="flex items-center gap-3">
                        <div class="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 shadow-sm">
                            <i class="${isTemp ? 'fas fa-temperature-high' : 'fas fa-power-off'} text-xs"></i>
                        </div>
                        <div>
                            <h4 class="text-xs font-semibold text-slate-800 dark:text-slate-200">${a.name}</h4>
                            <p class="text-xxs text-slate-500 dark:text-slate-400">${isTemp ? 'Temperatura Limite Excedida' : 'Interrupção de Linha Detetada'}</p>
                        </div>
                    </div>
                    <span class="px-2 py-0.5 bg-red-500/10 text-red-500 font-medium rounded-full text-xxs uppercase tracking-wider">${isTemp ? a.temp + '°C' : 'Parado'}</span>
                </div>`;
        }
    });

    // Atualiza KPIs da tela
    const kpiStatus = document.getElementById('kpi-status-ativos');
    if (kpiStatus) kpiStatus.innerText = `${onlineAssets}/${totalAssets}`;

    const criticalList = document.getElementById('critical-list');
    if (criticalList) {
        criticalList.innerHTML = criticalHtml || `
            <div class="flex flex-col items-center justify-center h-full text-slate-400 py-6">
                <i class="fas fa-check-circle text-2xl mb-2 text-green-500/20"></i>
                <p class="text-xs text-center">Nenhum alerta crítico pendente.</p>
            </div>`;
    }

    const disp = totalAssets > 0 ? Math.round((onlineAssets / totalAssets) * 100) : 0;
    const kpiOee = document.getElementById('kpi-oee');
    const barOee = document.getElementById('bar-oee');
    if (kpiOee) kpiOee.innerText = `${disp}%`;
    if (barOee) barOee.style.width = `${disp}%`;

    renderNotifications();
});

// Ouvir Ordens de Serviço Ativas
onValue(ref(db, 'work_orders'), (snapshot) => {
    const data = snapshot.val() || {};
    let todo = 0, doing = 0, done = 0;

    Object.values(data).forEach(os => {
        if (os.status === 'todo') todo++;
        if (os.status === 'doing') doing++;
        if (os.status === 'done') done++;
    });

    const kpiOs = document.getElementById('kpi-os-ativas');
    if (kpiOs) kpiOs.innerText = (todo + doing).toString();
});

// Ouvir Stock MRO Mínimo
onValue(ref(db, 'inventory'), (snapshot) => {
    const data = snapshot.val() || {};
    systemNotifications.inventory = [];
    let alertCount = 0;

    Object.values(data).forEach(item => {
        if (parseInt(item.quantity) <= parseInt(item.minStock)) {
            alertCount++;
            systemNotifications.inventory.push({
                title: `Stock Baixo: ${item.name}`,
                icon: "fas fa-box-open text-amber-500",
                time: "Abaixo da margem"
            });
        }
    });

    const kpiMro = document.getElementById('kpi-mro-alerta');
    if (kpiMro) kpiMro.innerText = alertCount.toString();

    renderNotifications();
});

// --- CONTROLE DE ROTAS, PERFIL E SESSÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        onValue(ref(db, 'users/' + user.uid), (snapshot) => {
            const userData = snapshot.val();
            if (userData) {
                document.getElementById('user-name').innerText = userData.name || "Utilizador";
                
                const cargoFormatado = userData.role || "Operador";
                document.getElementById('user-role').innerText = cargoFormatado;

                if (userData.photoURL) {
                    document.getElementById('user-photo').innerHTML = `<img src="${userData.photoURL}" class="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-dark-700" alt="Avatar">`;
                } else {
                    document.getElementById('user-photo').innerHTML = '<i class="fas fa-user text-xl text-slate-400"></i>';
                }

                // 🔒 EXCLUSÃO DA SIDEBAR EM TEMPO REAL CONFORME O CARGO
                if (cargoFormatado === "Operador") {
                    document.querySelectorAll('a[href*="estoque.html"]').forEach(el => el.remove());
                    document.querySelectorAll('a[href*="financeiro.html"]').forEach(el => el.remove());
                } else if (cargoFormatado === "Técnico") {
                    document.querySelectorAll('a[href*="financeiro.html"]').forEach(el => el.remove());
                }
            }
        });
    } else {
        window.location.href = 'index.html';
    }
});

// Dropdown Notificações Toggle
const bellBtn = document.getElementById('bell-btn');
const dropdown = document.getElementById('notification-dropdown');
if (bellBtn && dropdown) {
    bellBtn.addEventListener('click', () => dropdown.classList.toggle('hidden'));
    document.addEventListener('click', (e) => {
        if (!bellBtn.contains(e.target)) dropdown.classList.add('hidden');
    });
}

// Inicialização do Gráfico (Chart.js)
const ctx = document.getElementById('disponibilidadeChart')?.getContext('2d');
if (ctx) {
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Agora'],
            datasets: [{
                label: 'Disponibilidade (%)',
                data: [95, 96, 85, 88, 92, 90, 94],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f1f5f9' }, min: 50, max: 100 },
                x: { grid: { display: false } }
            }
        }
    });
}

// Modo Escuro Handler
window.toggleTheme = function() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
    }
    if (window.Chart && Chart.instances.length > 0) {
        Chart.instances[0].options.scales.y.grid.color = document.documentElement.classList.contains('dark') ? '#1e293b' : '#f1f5f9';
        Chart.instances[0].update();
    }
};

// Logout Handler
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = 'index.html'));
}