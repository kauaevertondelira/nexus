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

// --- MOTOR DE ANIMAÇÃO DE ESTADOS DOS CARDS (INTERPOLAÇÃO) ---
const cardStates = { oee: 0, ativos: 0, os: 0, stock: 0 };

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
    
    animateKpi('kpi-oee', 'oee', 87);
    animateKpi('kpi-ativos', 'ativos', 18);
    animateKpi('kpi-os', 'os', 4);
    animateKpi('kpi-stock', 'stock', 2);
    
    document.getElementById('critical-list').innerHTML = `
                <div class="p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-start gap-3">
                    <i class="fas fa-exclamation-circle text-red-500 mt-0.5"></i>
                    <div>
                        <p class="text-xs font-bold text-red-600 dark:text-red-400">Extrusora Principal (EXT-001)</p>
                        <p class="text-xxs text-red-500/80">Sobreaquecimento do Motor (88°C)</p>
                    </div>
                </div>`;

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
        systemNotifications.assets = []; 

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

                    systemNotifications.assets.push({
                        type: 'danger',
                        icon: 'fas fa-exclamation-circle',
                        title: ativo.name,
                        desc: `Crítico: ${ativo.temp}°C`
                    });
                }
            });
        }
        
        // REATIVIDADE: Aplica contagem interpolada nos cards de Ativos e OEE
        animateKpi('kpi-ativos', 'ativos', total);
        animateKpi('kpi-oee', 'oee', total > 0 ? 87 : 0);

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

    // 2. Contagem Real de O.S. Abertas + Adaptação Visual de Sobrecarga
    onValue(ref(db, 'work_orders'), (snapshot) => {
        const data = snapshot.val();
        let openOsCount = 0;
        if (data) {
            Object.values(data).forEach(os => {
                if (os.status !== 'done') openOsCount++;
            });
        }
        
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
    });

    // 3. Contagem Real de Estoque Crítico + Alerta de Ruptura Injetado no DOM
    onValue(ref(db, 'inventory'), (snapshot) => {
        const data = snapshot.val();
        let critStockCount = 0;
        systemNotifications.inventory = []; 

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
}

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

const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
}
// ==========================================
// CONTROLE DE ACESSO — Ocultar itens de menu por cargo
// ==========================================
const ROLE_PAGES = {
    "Administrador":              ["menu", "ativos", "os", "estoque", "financeiro", "mapa-consumo"],
    "Técnico de Manutenção":      ["menu", "ativos", "os"],
    "Almoxarifado / Suprimentos": ["menu", "ativos", "os", "estoque", "mapa-consumo"]
};

function applyMenuRestrictions(allowedPages) {
    const menuMap = {
        "ativos":       'a[data-page="ativos"]',
        "os":           'a[data-page="os"]',
        "estoque":      'a[data-page="estoque"]',
        "financeiro":   'a[data-page="financeiro"]',
        "mapa-consumo": 'a[data-page="mapa-consumo"]',
    };
    Object.entries(menuMap).forEach(([page, selector]) => {
        const el = document.querySelector(selector);
        if (el) {
            el.style.display = allowedPages.includes(page) ? '' : 'none';
        }
    });
}

// Aplica restrições assim que o usuário for autenticado
if (firebaseConfig.apiKey !== "SUA_API_KEY") {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const userRef = ref(db, 'users/' + user.uid);
            onValue(userRef, (snap) => {
                const data = snap.val();
                if (data) {
                    const allowed = data.allowedPages || ROLE_PAGES[data.role] || ["menu"];
                    applyMenuRestrictions(allowed);
                }
            }, { onlyOnce: true });
        }
    });
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