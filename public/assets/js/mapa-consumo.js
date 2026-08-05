
// ==========================================
// GUARD DE ACESSO
// ==========================================
const ROLE_PAGES_MAP = {
    "Administrador":              ["menu","ativos","os","estoque","financeiro","mapa-consumo"],
    "Técnico de Manutenção":      ["menu","ativos","os"],
    "Almoxarifado / Suprimentos": ["menu","ativos","os","estoque","mapa-consumo"]
};
function checkPageAccess(pageId, userData) {
    const allowed = userData.allowedPages || ROLE_PAGES_MAP[userData.role] || ["menu"];
    if (!allowed.includes(pageId)) {
        document.body.style.overflow = "hidden";
        document.body.innerHTML = `
          <div style="min-height:100vh;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;gap:16px;padding:32px;font-family:sans-serif">
            <div style="width:64px;height:64px;border-radius:16px;background:rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;font-size:28px">🔒</div>
            <h1 style="font-size:22px;font-weight:800;margin:0">Acesso Restrito</h1>
            <p style="color:#94a3b8;text-align:center;max-width:360px;margin:0">
              Seu cargo <strong style="color:white">${userData.role}</strong> não tem permissão para acessar esta página.
            </p>
            <a href="menu.html" style="margin-top:8px;padding:12px 24px;background:#3b82f6;border-radius:12px;font-weight:700;color:white;text-decoration:none">
              ← Voltar ao Painel
            </a>
          </div>`;
        return false;
    }
    return true;
}

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
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ==========================================
// DADOS DE DEMONSTRAÇÃO (substituir por Firebase real)
// ==========================================
const DEMO_MACHINES = [
    { id: 'EXT-001', name: 'Extrusora Principal', area: 'producao', energia: 12400, manutencao: 8200, insumos: 3100 },
    { id: 'INJ-002', name: 'Injetora #2', area: 'producao', energia: 9800, manutencao: 5600, insumos: 2400 },
    { id: 'CMP-003', name: 'Compressor Central', area: 'utilidades', energia: 8300, manutencao: 2100, insumos: 1200 },
    { id: 'EST-004', name: 'Esteira Logística', area: 'logistica', energia: 5200, manutencao: 3400, insumos: 1800 },
    { id: 'FRN-005', name: 'Forno Industrial', area: 'producao', energia: 7600, manutencao: 6800, insumos: 4200 },
    { id: 'BOM-006', name: 'Bomba Hidráulica', area: 'utilidades', energia: 4950, manutencao: 1900, insumos: 900 },
];

// ==========================================
// CONTROLE DE AUTENTICAÇÃO E PERFIL
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        onValue(ref(db, 'users/' + user.uid), (snap) => {
            const data = snap.val();
            if (data) {
                document.getElementById('user-name').innerText = data.name;
                document.getElementById('user-role').innerText = data.role;
                if (data.photoURL) {
                    document.getElementById('user-photo').style.backgroundImage = `url(${data.photoURL})`;
                    document.getElementById('user-photo').innerHTML = '';
                } else {
                    document.getElementById('user-photo').innerHTML = '<i class="fas fa-user text-xl"></i>';
                }
                if (!checkPageAccess('mapa-consumo', data)) return;
            }
        });
    } else {
        window.location.href = '../../index.html';
    }
});

// ==========================================
// RENDERIZAR RANKING DE BARRAS
// ==========================================
function renderRanking(containerId, machines, field, unit, color) {
    const container = document.getElementById(containerId);
    const maxVal = Math.max(...machines.map(m => m[field]));
    container.innerHTML = machines
        .sort((a, b) => b[field] - a[field])
        .slice(0, 6)
        .map((m, i) => {
            const pct = ((m[field] / maxVal) * 100).toFixed(1);
            const colors = ['bg-brand', 'bg-blue-400', 'bg-purple-500', 'bg-amber-400', 'bg-green-400', 'bg-red-400'];
            const barColor = colors[i % colors.length];
            return `
                <div>
                    <div class="flex justify-between items-center text-xs mb-1">
                        <span class="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[60%]">${m.name}</span>
                        <span class="text-slate-500 dark:text-slate-400 font-bold text-xxs">${m[field].toLocaleString('pt-BR')} ${unit}</span>
                    </div>
                    <div class="h-2.5 bg-slate-100 dark:bg-dark-700 rounded-full overflow-hidden">
                        <div class="h-full ${barColor} rounded-full bar-fill" style="width:${pct}%"></div>
                    </div>
                    <div class="flex justify-between text-xxs text-slate-400 mt-0.5">
                        <span class="text-slate-400">${m.id}</span>
                        <span>${pct}% do total</span>
                    </div>
                </div>`;
        }).join('');
}

// ==========================================
// FILTROS — refiltra ao mudar seleção
// ==========================================
function applyFilters() {
    const area = document.getElementById('filter-area').value;
    const type = document.getElementById('filter-type').value;

    let machines = [...DEMO_MACHINES];
    if (area !== 'all') machines = machines.filter(m => m.area === area);

    renderRanking('energia-ranking', machines, 'energia', 'kWh', 'blue');
    renderRanking('manutencao-ranking', machines, 'manutencao', 'R$', 'orange');

    // Atualiza KPIs
    const totalEnergia = machines.reduce((s, m) => s + m.energia, 0);
    const totalManut = machines.reduce((s, m) => s + m.manutencao, 0);
    const totalMRO = machines.reduce((s, m) => s + m.insumos, 0);
    document.getElementById('kpi-energia').innerText = totalEnergia.toLocaleString('pt-BR');
    document.getElementById('kpi-manutencao').innerText = totalManut.toLocaleString('pt-BR');
    document.getElementById('kpi-mro').innerText = totalMRO.toLocaleString('pt-BR');
}

document.getElementById('filter-area').addEventListener('change', applyFilters);
document.getElementById('filter-period').addEventListener('change', applyFilters);
document.getElementById('filter-type').addEventListener('change', applyFilters);

// Renderização inicial
applyFilters();

// ==========================================
// GRÁFICO DE EVOLUÇÃO (Chart.js)
// ==========================================
const isDark = document.documentElement.classList.contains('dark');
const gridColor = isDark ? '#1e293b' : '#f1f5f9';
const ctx = document.getElementById('consumoChart').getContext('2d');
new Chart(ctx, {
    type: 'line',
    data: {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
        datasets: [
            {
                label: 'Energia (kWh)',
                data: [41200, 43800, 46500, 44100, 47300, 48250],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.08)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
            {
                label: 'Manutenção (R$)',
                data: [35000, 33200, 34800, 31900, 33800, 32480],
                borderColor: '#f97316',
                backgroundColor: 'rgba(249,115,22,0.05)',
                borderWidth: 2.5,
                fill: false,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
            }
        ]
    },
    options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 11 }, boxWidth: 12 } }
        },
        scales: {
            y: { grid: { color: gridColor }, ticks: { color: isDark ? '#475569' : '#94a3b8', font: { size: 10 } } },
            x: { grid: { display: false }, ticks: { color: isDark ? '#475569' : '#94a3b8', font: { size: 10 } } }
        }
    }
});

// ==========================================
// TEMA
// ==========================================
document.getElementById('theme-toggle')?.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
});
