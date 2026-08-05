
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
        import { getDatabase, ref, onValue, set, push, remove, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
        import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
        const db = getDatabase(app);
        const auth = getAuth(app);

        // --- SISTEMA DE RASTREABILIDADE ---
        let currentUserInfo = { name: "Operador", uid: "null" };

        if (firebaseConfig.apiKey === "SUA_API_KEY") {
            currentUserInfo = { name: "Técnico de Manutenção", uid: "simulado" };
            document.getElementById('user-name').innerText = currentUserInfo.name;
            document.getElementById('user-role').innerText = "Engenharia";
            document.getElementById('user-photo').innerHTML = '<i class="fas fa-tools text-xl"></i>';
        } else {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    onValue(ref(db, 'users/' + user.uid), (snapshot) => {
                        const data = snapshot.val();
                        if(data) {
                            currentUserInfo = { name: data.name, uid: user.uid };
                            document.getElementById('user-name').innerText = data.name;
                            document.getElementById('user-role').innerText = data.role;
                            if (!checkPageAccess('ativos', data)) return;
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
        
        const getSwalTheme = () => document.documentElement.classList.contains('dark') ? { background: '#1e293b', color: '#f8fafc', confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' } : { confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' };

        // Renderizar Tabela
        onValue(ref(db, 'assets'), (snapshot) => {
            const data = snapshot.val();
            const list = document.getElementById('assets-list');
            list.innerHTML = ''; 
            
            if (data) {
                Object.entries(data).forEach(([id, ativo]) => {
                    let statusBadge = '';
                    if(ativo.status === 'online') statusBadge = '<span class="px-2 py-1 bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400 rounded-md text-xxs font-bold uppercase"><i class="fas fa-circle text-[8px] mr-1"></i> Operando</span>';
                    else if(ativo.status === 'offline') statusBadge = '<span class="px-2 py-1 bg-slate-200 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 rounded-md text-xxs font-bold uppercase"><i class="fas fa-power-off mr-1"></i> Desligada</span>';
                    else statusBadge = '<span class="px-2 py-1 bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 rounded-md text-xxs font-bold uppercase animate-pulse"><i class="fas fa-exclamation-triangle mr-1"></i> Falha</span>';

                    let tempColor = ativo.temp > 80 ? 'text-red-500 font-bold' : (ativo.temp > 60 ? 'text-amber-500' : 'text-slate-600 dark:text-slate-400');

                    list.innerHTML += `
                        <tr class="table-row-hover transition-colors text-slate-700 dark:text-slate-300">
                            <td class="px-5 py-4 text-xs font-mono text-slate-500">#${id.substring(1, 6).toUpperCase()}</td>
                            <td class="px-5 py-4 font-medium">${ativo.name}</td>
                            <td class="px-5 py-4">${statusBadge}</td>
                            <td class="px-5 py-4 ${tempColor}"><i class="fas fa-thermometer-half mr-1"></i> ${ativo.temp} °C</td>
                            <td class="px-5 py-4 text-xs text-slate-500 dark:text-slate-400"><i class="fas fa-user-tag mr-1"></i> ${ativo.lastUpdatedBy || ativo.createdBy || 'Sistema'}</td>
                            <td class="px-5 py-4 text-right space-x-2">
                                <button onclick="editAsset('${id}')" class="text-slate-400 hover:text-brand transition-colors p-2"><i class="fas fa-edit"></i></button>
                                <button onclick="deleteAsset('${id}')" class="text-slate-400 hover:text-red-500 transition-colors p-2"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                list.innerHTML = `<tr><td colspan="6" class="px-5 py-8 text-center text-slate-500 dark:text-slate-400">Nenhum equipamento cadastrado.</td></tr>`;
            }
        });

        window.addAsset = () => {
            Swal.fire({
                title: 'Novo Ativo',
                html: `
                    <input id="swal-name" class="swal2-input" placeholder="Nome / Linha da Máquina">
                    <select id="swal-status" class="swal2-select">
                        <option value="online">Operando (Online)</option>
                        <option value="offline">Desligada (Offline)</option>
                        <option value="danger">Falha Crítica (Danger)</option>
                    </select>
                `,
                showCancelButton: true,
                ...getSwalTheme(),
                confirmButtonText: 'Registar',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    return {
                        name: document.getElementById('swal-name').value || 'Máquina Sem Nome',
                        status: document.getElementById('swal-status').value,
                        temp: Math.floor(Math.random() * (90 - 30 + 1) + 30),
                        createdBy: currentUserInfo.name // Rastreabilidade
                    }
                }
            }).then((res) => {
                if (res.isConfirmed) push(ref(db, 'assets'), res.value);
            });
        };

        window.editAsset = (id) => {
            Swal.fire({
                title: 'Editar Status',
                html: `
                    <input id="swal-name" class="swal2-input" placeholder="Novo Nome">
                    <select id="swal-status" class="swal2-select">
                        <option value="online">Operando</option>
                        <option value="offline">Desligada</option>
                        <option value="danger">Falha</option>
                    </select>
                    <input type="number" id="swal-temp" class="swal2-input" placeholder="Temperatura simulada">
                `,
                showCancelButton: true,
                ...getSwalTheme(),
                confirmButtonText: 'Salvar',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    return {
                        name: document.getElementById('swal-name').value,
                        status: document.getElementById('swal-status').value,
                        temp: parseInt(document.getElementById('swal-temp').value) || 0,
                        lastUpdatedBy: currentUserInfo.name // Rastreabilidade
                    }
                }
            }).then((res) => {
                if (res.isConfirmed) update(ref(db, 'assets/' + id), res.value);
            });
        };

        window.deleteAsset = (id) => {
            Swal.fire({
                title: 'Remover ativo?',
                text: "Esta ação apagará o histórico da máquina.",
                icon: 'warning',
                showCancelButton: true,
                ...getSwalTheme(),
                confirmButtonText: 'Sim, remover',
                cancelButtonText: 'Cancelar'
            }).then((res) => {
                if (res.isConfirmed) remove(ref(db, 'assets/' + id));
            });
        };

        document.getElementById('searchInput')?.addEventListener('keyup', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('#assets-list tr').forEach(row => {
                if (!row.innerText.toLowerCase().includes('sincronizando') && !row.innerText.toLowerCase().includes('nenhum')) {
                    row.style.display = row.innerText.toLowerCase().includes(term) ? '' : 'none';
                }
            });
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