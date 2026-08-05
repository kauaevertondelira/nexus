// --- VARIÁVEIS GLOBAIS E CHART.JS ---
let telemetryInterval; 
let chartInstance = null; 

// --- 1. NAVEGAÇÃO PAN (ARRASTAR) E ZOOM ---
let currentZoom = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;

const mapContainer = document.getElementById('map-container');
const zoomWrapper = document.getElementById('zoom-wrapper');

// Atualiza o CSS Transform combinando Pan (Translação) e Zoom (Escala)
function updateMapTransform() {
    // Retiramos a animação CSS padrão durante o drag para não causar atraso visual ("lag")
    mapContainer.style.transition = isDragging ? 'none' : 'transform 0.3s ease';
    mapContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`;
}

// Inicia o arrasto
zoomWrapper.addEventListener('mousedown', (e) => {
    // Só permite arrastar se clicar no fundo (não permite arrastar se clicar no botão da máquina)
    if (e.target.closest('.machine-node')) return;
    
    isDragging = true;
    zoomWrapper.classList.add('grabbing');
});

// Durante o arrasto
window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    // Soma o movimento exato do rato à posição atual
    translateX += e.movementX;
    translateY += e.movementY;
    updateMapTransform();
});

// Termina o arrasto
window.addEventListener('mouseup', () => {
    isDragging = false;
    zoomWrapper.classList.remove('grabbing');
    updateMapTransform(); // Reaplica a transição CSS
});

// Controles de Zoom
document.getElementById('zoom-in').addEventListener('click', () => {
    if (currentZoom < 2.0) { currentZoom += 0.1; updateMapTransform(); }
});
document.getElementById('zoom-out').addEventListener('click', () => {
    if (currentZoom > 0.5) { currentZoom -= 0.1; updateMapTransform(); }
});
document.getElementById('zoom-reset').addEventListener('click', () => {
    currentZoom = 1; translateX = 0; translateY = 0; updateMapTransform();
});

// --- 2. FILTROS DINÂMICOS (LEGENDA) ---
const filterButtons = document.querySelectorAll('.status-filter');
const machineNodes = document.querySelectorAll('.machine-node');
let activeFilter = null;

filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetStatus = btn.getAttribute('data-filter');
        
        // Se clicar no filtro que já está ativo, desativa-o
        if (activeFilter === targetStatus) {
            activeFilter = null;
            btn.classList.remove('ring-2', 'ring-brand', 'bg-slate-200', 'dark:bg-dark-700');
        } else {
            // Limpa estilo dos outros
            filterButtons.forEach(b => b.classList.remove('ring-2', 'ring-brand', 'bg-slate-200', 'dark:bg-dark-700'));
            // Aplica estilo no clicado
            btn.classList.add('ring-2', 'ring-brand', 'bg-slate-200', 'dark:bg-dark-700');
            activeFilter = targetStatus;
        }

        // Aplica o efeito visual nas máquinas do mapa
        machineNodes.forEach(node => {
            const nodeStatus = node.getAttribute('data-status');
            if (!activeFilter || nodeStatus === activeFilter) {
                node.classList.remove('opacity-20', 'grayscale');
            } else {
                node.classList.add('opacity-20', 'grayscale');
            }
        });
    });
});

// --- 3. TOOLTIPS RÁPIDOS NO HOVER ---
const tooltip = document.getElementById('quick-tooltip');

machineNodes.forEach(node => {
    node.addEventListener('mouseenter', (e) => {
        // Se houver um modal aberto ou se o mapa estiver a ser arrastado, não mostra tooltip
        if (!document.getElementById('machine-modal').classList.contains('opacity-0') || isDragging) return;

        const name = node.getAttribute('data-name');
        const temp = node.getAttribute('data-temp');
        const status = node.getAttribute('data-status');
        
        let statusColor = "text-green-400";
        if(status === 'ALERTA') statusColor = "text-yellow-400";
        if(status === 'PARADA') statusColor = "text-red-400";
        if(status === 'CONFIGURAR') statusColor = "text-blue-400";

        tooltip.innerHTML = `
            <div class="font-bold text-[13px]">${name}</div>
            <div class="text-[10px] mt-1 text-slate-300">Temp: <span class="${statusColor} font-bold">${temp}</span></div>
        `;
        tooltip.classList.remove('hidden');
    });

    node.addEventListener('mousemove', (e) => {
        tooltip.style.left = e.clientX + 'px';
        tooltip.style.top = e.clientY - 15 + 'px'; // Ligeiramente acima do rato
    });

    node.addEventListener('mouseleave', () => {
        tooltip.classList.add('hidden');
    });
});

// --- 4. SISTEMA DE NOTIFICAÇÕES GLOBAIS (TOASTS) ---
const toastContainer = document.getElementById('toast-container');

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    
    // Configura as cores consoante o tipo do evento
    let icon = '<i class="fas fa-info-circle text-blue-500"></i>';
    let border = 'border-blue-500';
    if(type === 'warning') { icon = '<i class="fas fa-exclamation-triangle text-yellow-500"></i>'; border = 'border-yellow-500'; }
    if(type === 'error') { icon = '<i class="fas fa-times-circle text-red-500"></i>'; border = 'border-red-500'; }
    if(type === 'success') { icon = '<i class="fas fa-check-circle text-green-500"></i>'; border = 'border-green-500'; }

    toast.className = `toast-enter flex items-center gap-3 bg-white dark:bg-dark-800 text-slate-700 dark:text-slate-200 p-4 rounded-lg shadow-xl border-l-4 ${border} border-y border-r border-y-slate-200 border-r-slate-200 dark:border-y-dark-700 dark:border-r-dark-700 min-w-[250px]`;
    toast.innerHTML = `${icon} <span class="text-xs font-medium">${message}</span>`;
    
    toastContainer.appendChild(toast);

    // Remove automaticamente após 4.5 segundos
    setTimeout(() => {
        toast.classList.replace('toast-enter', 'toast-exit');
        setTimeout(() => toast.remove(), 300); // Aguarda fim da animação
    }, 4500);
}

// Simulador esporádico de eventos de chão de fábrica
setInterval(() => {
    const events = [
        { msg: "AGV (Empilhador 04) concluiu rota.", type: "success" },
        { msg: "M-003: Alerta térmico persistente.", type: "warning" },
        { msg: "M-001 atingiu meta de produção diária.", type: "info" }
    ];
    // Sorteia um evento aleatório com probabilidade moderada
    if(Math.random() > 0.6) {
        const randomEvent = events[Math.floor(Math.random() * events.length)];
        showToast(randomEvent.msg, randomEvent.type);
    }
}, 20000); // Tenta disparar a cada 20 segundos

// Dispara um toast de boas-vindas inicial ao carregar a página
setTimeout(() => showToast("Conexão com servidor IoT estabelecida.", "success"), 1000);


// --- LÓGICA DO MODAL, GRÁFICO E REDIRECIONAMENTOS (Mantidos e Melhorados) ---
window.redirectToOS = function() {
    const maquinaId = document.getElementById('modal-machine-id').innerText;
    window.location.href = `os.html?acao=nova_os&maquina=${maquinaId}`;
};

window.toggleMetrics = function() {
    const expansionArea = document.getElementById('metrics-expansion');
    if (expansionArea.classList.contains('hidden')) {
        expansionArea.classList.remove('hidden');
        expansionArea.classList.add('flex');
        renderChart();
    } else {
        expansionArea.classList.add('hidden');
        expansionArea.classList.remove('flex');
    }
};

function renderChart() {
    const ctx = document.getElementById('telemetryChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const tempText = document.getElementById('modal-temp').innerText;
    let baseTemp = parseFloat(tempText.replace(' °C', ''));
    if (isNaN(baseTemp)) baseTemp = 40; 

    const dummyData = [
        baseTemp - (Math.random() * 5 + 2),
        baseTemp - (Math.random() * 4 + 1),
        baseTemp - (Math.random() * 2 + 1),
        baseTemp + (Math.random() * 2),
        baseTemp - (Math.random() * 1),
        baseTemp 
    ].map(val => val.toFixed(1));

    const isDarkMode = document.documentElement.classList.contains('dark');
    const gridColor = isDarkMode ? '#334155' : '#e2e8f0'; 
    const textColor = isDarkMode ? '#94a3b8' : '#64748b';

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['-50m', '-40m', '-30m', '-20m', '-10m', 'Agora'],
            datasets: [{
                label: 'Temperatura (°C)',
                data: dummyData,
                borderColor: '#3b82f6', 
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2, pointBackgroundColor: '#3b82f6', pointRadius: 3, fill: true, tension: 0.4 
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
            scales: {
                y: { grid: { color: gridColor, drawBorder: false }, ticks: { color: textColor, font: { size: 10 } } },
                x: { grid: { display: false, drawBorder: false }, ticks: { color: textColor, font: { size: 10 } } }
            }
        }
    });
}

window.openMachineModal = function(id, nome, status, temperatura, producao, ip) {
    // Esconde a tooltip se ela existir
    tooltip.classList.add('hidden');

    const modal = document.getElementById('machine-modal');
    const modalContent = document.getElementById('modal-content');
    
    document.getElementById('metrics-expansion').classList.add('hidden');
    document.getElementById('metrics-expansion').classList.remove('flex');
    
    document.getElementById('modal-machine-id').innerText = id;
    document.getElementById('modal-machine-name').innerText = nome;
    document.getElementById('modal-machine-ip').innerText = ip;

    const badge = document.getElementById('modal-status-badge');
    badge.innerText = status;
    badge.className = "px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest border ";
    
    const tempElement = document.getElementById('modal-temp');
    const prodElement = document.getElementById('modal-prod');
    const rpmElement = document.getElementById('modal-rpm');
    
    tempElement.innerText = temperatura;
    prodElement.innerText = producao;

    if (status === 'OPERANDO') badge.className += "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30";
    else if (status === 'ALERTA') badge.className += "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30";
    else if (status === 'PARADA') badge.className += "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30";
    else if (status === 'CONFIGURAR') badge.className += "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 animate-pulse";

    modal.classList.remove('opacity-0', 'pointer-events-none');
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');

    clearInterval(telemetryInterval); 
    
    if(status !== 'PARADA' && status !== 'CONFIGURAR') {
        let baseTemp = parseFloat(temperatura.replace(' °C', ''));
        let baseProd = parseInt(producao);
        let baseRpm = 1200 + Math.floor(Math.random() * 200); 
        
        telemetryInterval = setInterval(() => {
            let currentTemp = (baseTemp + (Math.random() * 1 - 0.5)).toFixed(1);
            tempElement.innerText = currentTemp + ' °C';
            
            if(Math.random() > 0.7) { baseProd += 1; prodElement.innerText = baseProd; }
            rpmElement.innerText = baseRpm + Math.floor(Math.random() * 15 - 7);

            if (chartInstance && !document.getElementById('metrics-expansion').classList.contains('hidden')) {
                chartInstance.data.datasets[0].data[5] = currentTemp;
                chartInstance.update('none'); 
            }
        }, 1500); 
    }
}

window.closeMachineModal = function() {
    const modal = document.getElementById('machine-modal');
    const modalContent = document.getElementById('modal-content');
    
    clearInterval(telemetryInterval); 
    modal.classList.add('opacity-0', 'pointer-events-none');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');

    setTimeout(() => {
        document.getElementById('metrics-expansion').classList.add('hidden');
        document.getElementById('metrics-expansion').classList.remove('flex');
    }, 300); 
}

document.getElementById('machine-modal').addEventListener('click', function(e) {
    if(e.target === this) closeMachineModal();
});

document.getElementById('theme-toggle').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    if (!document.getElementById('metrics-expansion').classList.contains('hidden')) {
        renderChart(); 
    }
});

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