
// ==========================================
// GUARD DE ACESSO — bloqueia cargo sem permissão
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
        import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
        import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

        const firebaseConfig = {
            apiKey: "AIzaSyD6gj_6e0WuGr6C_hJDkXBK7cI2EopWV1s",
            authDomain: "nexus-iot-senai.firebaseapp.com",
            databaseURL: "https://nexus-iot-senai-default-rtdb.firebaseio.com",
            projectId: "nexus-iot-senai"
        };
        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        const auth = getAuth(app);

        // --- SISTEMA DE PERFIL ---
        if (firebaseConfig.apiKey === "SUA_API_KEY") {
            document.getElementById('user-name').innerText = "Diretor Financeiro";
            document.getElementById('user-role').innerText = "Gestão / Controladoria";
            document.getElementById('user-photo').innerHTML = '<i class="fas fa-chart-line text-xl"></i>';
        } else {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    onValue(ref(db, 'users/' + user.uid), (snapshot) => {
                        const data = snapshot.val();
                        if(data) {
                            document.getElementById('user-name').innerText = data.name;
                            document.getElementById('user-role').innerText = data.role;
                            if (!checkPageAccess('financeiro', data)) return;
                            if(data.photoURL) {
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
        }

        let chartDoughnut;

        onValue(ref(db, 'work_orders'), (snapshot) => {
            const data = snapshot.val();
            let totalDone = 0; let urgentCount = 0; let normalCount = 0;
            
            if (data) {
                Object.values(data).forEach(os => {
                    if (os.status === 'done') totalDone++;
                    if (os.priority === 'urgent' || os.priority === 'danger') urgentCount++;
                    else normalCount++;
                });
            }

            document.getElementById('kpi-os-done').innerText = totalDone;
            
            if(chartDoughnut) {
                chartDoughnut.data.datasets[0].data = [urgentCount, normalCount];
                chartDoughnut.update();
            }

            // Simula tabela de custos
            document.getElementById('cost-table').innerHTML = `
                <tr class="table-row-hover text-slate-700 dark:text-slate-300">
                    <td class="py-3 font-medium">Extrusora Principal <span class="text-xs text-slate-500 block">#EXT-001</span></td>
                    <td class="py-3 text-center">4</td>
                    <td class="py-3 text-right text-red-500 font-bold">R$ 5.200,00</td>
                </tr>
                <tr class="table-row-hover text-slate-700 dark:text-slate-300">
                    <td class="py-3 font-medium">Compressor Ar Linha B <span class="text-xs text-slate-500 block">#CMP-02</span></td>
                    <td class="py-3 text-center">2</td>
                    <td class="py-3 text-right">R$ 1.850,00</td>
                </tr>
            `;
            document.getElementById('kpi-downtime').innerText = "R$ 7.050,00";
        });

        const getGridColor = () => document.documentElement.classList.contains('dark') ? '#1e293b' : '#f1f5f9';
        const getTextColor = () => document.documentElement.classList.contains('dark') ? '#64748b' : '#94a3b8';

        // Gráfico de Barras
        const ctxBar = document.getElementById('costChart').getContext('2d');
        window.chartBar = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar'],
                datasets: [{
                    label: 'Custo Downtime (R$)',
                    data: [3000, 1500, 5200, 1200, 2400, 800],
                    backgroundColor: '#ef4444',
                    borderRadius: 4,
                    barPercentage: 0.5
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: getGridColor() }, ticks: { color: getTextColor(), callback: (val) => 'R$ ' + val } },
                    x: { grid: { display: false }, ticks: { color: getTextColor() } }
                }
            }
        });

        // Gráfico Doughnut
        const ctxDist = document.getElementById('distributionChart').getContext('2d');
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
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: getTextColor(), padding: 20 } } },
                cutout: '70%'
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

// --- 5. LOGICA DA SIDEBAR RETRÁTIL COM MEMÓRIA ---
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const sidebarIcon = document.getElementById('sidebar-icon');
const sidebarTexts = document.querySelectorAll('.sidebar-text');
const sidebarLogo = document.getElementById('sidebar-logo');
const sidebarLogoMini = document.getElementById('sidebar-logo-mini');

// Função centralizada para aplicar o visual da Sidebar
function applySidebarState(isCollapsed, isInstant = false) {
    if (isCollapsed) {
        // Encolher Sidebar
        sidebar.classList.remove('w-64');
        sidebar.classList.add('w-20');
        sidebarIcon.classList.add('rotate-180');
        
        // Esconder Textos
        sidebarTexts.forEach(text => {
            if (isInstant) {
                text.classList.add('hidden', 'opacity-0');
            } else {
                text.classList.add('opacity-0');
                setTimeout(() => text.classList.add('hidden'), 200);
            }
        });
        
        // Trocar Logo
        sidebarLogo.classList.add('hidden');
        sidebarLogoMini.classList.remove('hidden');
    } else {
        // Expandir Sidebar
        sidebar.classList.remove('w-20');
        sidebar.classList.add('w-64');
        sidebarIcon.classList.remove('rotate-180');
        
        // Mostrar Textos
        sidebarTexts.forEach(text => {
            text.classList.remove('hidden');
            if (isInstant) {
                text.classList.remove('opacity-0');
            } else {
                setTimeout(() => text.classList.remove('opacity-0'), 10);
            }
        });
        
        // Trocar Logo
        sidebarLogoMini.classList.add('hidden');
        sidebarLogo.classList.remove('hidden');
    }
}

// 1. LER MEMÓRIA: Verifica se há registo no localStorage ao carregar a página
let isSidebarCollapsed = localStorage.getItem('nexus_sidebar_state') === 'collapsed';

// Aplica o estado guardado instantaneamente (para não piscar ao trocar de página)
applySidebarState(isSidebarCollapsed, true);

// 2. AÇÃO DE CLIQUE: Alternar e gravar
toggleSidebarBtn.addEventListener('click', () => {
    isSidebarCollapsed = !isSidebarCollapsed;
    
    // Grava a nova preferência no navegador do utilizador
    localStorage.setItem('nexus_sidebar_state', isSidebarCollapsed ? 'collapsed' : 'expanded');
    
    // Aplica o novo visual de forma suave (animada)
    applySidebarState(isSidebarCollapsed, false);
});

// ==========================================
// MARCADOR DE PÁGINA ATIVA AUTOMÁTICO
// ==========================================
function highlightActiveMenu() {
    // Pega o nome do arquivo atual da URL (ex: 'os.html', 'ativos.html')
    let currentPage = window.location.pathname.split('/').pop();
    
    // Fallback se estiver na raiz do sistema
    if (currentPage === '' || currentPage === '/') {
        currentPage = 'menu.html';
    }

    // Seleciona todos os links dentro da nav
    const navLinks = document.querySelectorAll('#sidebar-nav .nav-link');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        
        if (href === currentPage) {
            // Remove as classes de inativo
            link.classList.remove('text-slate-500', 'hover:bg-slate-100', 'hover:text-brand', 'dark:text-slate-400', 'dark:hover:bg-dark-800', 'dark:hover:text-white');
            
            // Adiciona as classes de ativo (Azul)
            link.classList.add('bg-brand/10', 'text-brand', 'font-medium', 'border', 'border-brand/20');
        }
    });
}

// Executa ao carregar a página
highlightActiveMenu();