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
    const listContainer = document.getElementById('notification-items');
    const badge = document.getElementById('bell-badge');
    const countEl = document.getElementById('notification-count');

    const allAlerts = [...systemNotifications.assets, ...systemNotifications.inventory];

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
                            <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">${alert.title}</p>
                            <p class="text-xxs text-slate-400 dark:text-slate-400 truncate mt-0.5">${alert.desc}</p>
                        </div>
                    </div>
                `).join('');
    }
}

// --- MODO DE TESTE VISUAL (Bypass) ---
if (firebaseConfig.apiKey === "SUA_API_KEY") {
    document.getElementById('user-name').innerText = "Gestor Operacional";
    document.getElementById('user-role').innerText = "Engenharia & PCM";
    document.getElementById('user-photo').innerHTML = '<i class="fas fa-user-tie text-xl"></i>';
    document.getElementById('kpi-ativos').innerText = "18";
    document.getElementById('kpi-os').innerText = "4";
    document.getElementById('kpi-stock').innerText = "2";
    document.getElementById('critical-list').innerHTML = `
                <div class="p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-start gap-3">
                    <i class="fas fa-exclamation-circle text-red-500 mt-0.5"></i>
                    <div>
                        <p class="text-xs font-bold text-red-600 dark:text-red-400">Extrusora Principal (EXT-001)</p>
                        <p class="text-xxs text-red-500/80">Sobreaquecimento do Motor (88°C)</p>
                    </div>
                </div>`;

    // Popula simulação no Sininho
    systemNotifications.assets = [{ type: 'danger', icon: 'fas fa-exclamation-circle', title: 'Extrusora Principal (EXT-001)', desc: 'Sobreaquecimento do Motor (88°C)' }];
    systemNotifications.inventory = [{ type: 'warning', icon: 'fas fa-box-open', title: 'Estoque Crítico', desc: 'Componentes abaixo da quantidade mínima!' }];
    renderNotifications();
} else {
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
                }
            });
        } else {
            window.location.href = '../../index.html';
        }
    });

    // 1. Contagem de Ativos e Alertas Críticos (Real)
    onValue(ref(db, 'assets'), (snapshot) => {
        const data = snapshot.val();
        let total = 0;
        let criticalHtml = '';
        systemNotifications.assets = []; // Limpa anteriores

        if (data) {
            const ativos = Object.values(data);
            total = ativos.length;

            ativos.forEach(ativo => {
                if (ativo.status === 'danger' || ativo.temp > 80) {
                    criticalHtml += `
                                <div class="p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-start gap-3">
                                    <i class="fas fa-exclamation-circle text-red-500 mt-0.5"></i>
                                    <div>
                                        <p class="text-xs font-bold text-red-600 dark:text-red-400">${ativo.name}</p>
                                        <p class="text-xxs text-red-500/80">Sobreaquecimento / Falha (${ativo.temp}°C)</p>
                                    </div>
                                </div>`;

                    // Adiciona ao array do Sininho
                    systemNotifications.assets.push({
                        type: 'danger',
                        icon: 'fas fa-exclamation-circle',
                        title: ativo.name,
                        desc: `Crítico: ${ativo.temp}°C`
                    });
                }
            });
        }
        document.getElementById('kpi-ativos').innerText = total;

        const listEl = document.getElementById('critical-list');
        if (criticalHtml === '') {
            listEl.innerHTML = `
                        <div class="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                            <i class="fas fa-check-circle text-3xl mb-2 text-green-500/40 dark:text-green-500/20"></i>
                            <p class="text-xs text-center">Nenhum alerta crítico detetado.</p>
                        </div>`;
        } else {
            listEl.innerHTML = criticalHtml;
        }
        renderNotifications();
    });

    // 2. Contagem Real de O.S. Abertas
    onValue(ref(db, 'work_orders'), (snapshot) => {
        const data = snapshot.val();
        let openOsCount = 0;
        if (data) {
            Object.values(data).forEach(os => {
                if (os.status !== 'done') openOsCount++;
            });
        }
        document.getElementById('kpi-os').innerText = openOsCount;
    });

    // 3. Contagem Real de Estoque Crítico
    onValue(ref(db, 'inventory'), (snapshot) => {
        const data = snapshot.val();
        let critStockCount = 0;
        systemNotifications.inventory = []; // Limpa anteriores

        if (data) {
            Object.values(data).forEach(item => {
                if (item.qty <= item.min) {
                    critStockCount++;
                    systemNotifications.inventory.push({
                        type: 'warning',
                        icon: 'fas fa-box-open',
                        title: item.name || 'Item de Estoque',
                        desc: `Abaixo do mínimo (${item.qty}/${item.min})`
                    });
                }
            });
        }
        document.getElementById('kpi-stock').innerText = critStockCount;
        renderNotifications();
    });
}

// --- CONTROLE DE EXIBIÇÃO DO DROPDOWN (SININHO) ---
const bellBtn = document.getElementById('bell-btn');
const dropdown = document.getElementById('notification-dropdown');

bellBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Evita fechar imediatamente ao clicar
    dropdown.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!bellBtn.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// 4. Inicialização do Gráfico (Chart.js)
const ctx = document.getElementById('disponibilidadeChart').getContext('2d');
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
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { grid: { color: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f1f5f9' }, min: 50, max: 100 },
            x: { grid: { display: false } }
        }
    }
});


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

// Garante que o clique seja ouvido no novo ID do botão
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
}

