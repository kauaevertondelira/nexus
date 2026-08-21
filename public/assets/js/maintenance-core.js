import { auth, db, getAllowedPages, applyAllowedMenu, revealProtectedPage, writeAuditLog } from './firebase.js';
import { escapeHtml, nonNegative, formatCurrency } from './security-utils.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    ref,
    onValue,
    get,
    push,
    set,
    update,
    remove,
    runTransaction,
    increment,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

export {
    auth,
    db,
    ref,
    onValue,
    get,
    push,
    set,
    update,
    remove,
    runTransaction,
    increment,
    serverTimestamp,
    writeAuditLog,
    escapeHtml,
    nonNegative,
    formatCurrency
};

export const PRIORITIES = Object.freeze({
    low: { label: 'Baixa', className: 's3-badge--slate' },
    normal: { label: 'Normal', className: 's3-badge--blue' },
    urgent: { label: 'Urgente', className: 's3-badge--amber' },
    danger: { label: 'Crítica', className: 's3-badge--red' }
});

export const ORDER_STATUS = Object.freeze({
    todo: { label: 'Pendente', className: 's3-badge--slate' },
    doing: { label: 'Em execução', className: 's3-badge--blue' },
    done: { label: 'Concluída', className: 's3-badge--green' }
});

export const REQUEST_STATUS = Object.freeze({
    new: { label: 'Nova', className: 's3-badge--blue' },
    approved: { label: 'Aprovada', className: 's3-badge--green' },
    converted: { label: 'Convertida em O.S.', className: 's3-badge--purple' },
    rejected: { label: 'Rejeitada', className: 's3-badge--red' },
    cancelled: { label: 'Cancelada', className: 's3-badge--slate' }
});

const BASE_LINKS = [
    ['menu', 'menu.html', 'fa-chart-pie', 'Visão Global'],
    ['ativos', 'ativos.html', 'fa-microchip', 'Parque de Ativos'],
    ['os', 'os.html', 'fa-clipboard-list', 'Ordens de Serviço'],
    ['estoque', 'estoque.html', 'fa-boxes', 'Estoque (MRO)'],
    ['financeiro', 'financeiro.html', 'fa-wallet', 'Financeiro'],
    ['mapa', 'mapa.html', 'fa-map-marked-alt', 'Planta Industrial'],
    ['mapa-consumo', 'mapa-consumo.html', 'fa-fire-alt', 'Mapa de Consumo']
];

const MAINTENANCE_LINKS = [
    ['planejamento', 'planejamento.html', 'fa-calendar-days', 'Planejamento'],
    ['preventiva', 'preventiva.html', 'fa-arrows-rotate', 'Manutenção Preventiva'],
    ['solicitacoes', 'solicitacoes.html', 'fa-bullhorn', 'Solicitações'],
    ['tecnico', 'tecnico.html', 'fa-user-gear', 'Espaço do Técnico'],
    ['inspecoes', 'inspecoes.html', 'fa-list-check', 'Inspeções Digitais'],
    ['confiabilidade', 'confiabilidade.html', 'fa-chart-line', 'Confiabilidade'],
    ['fornecedores', 'fornecedores.html', 'fa-building', 'Fornecedores'],
    ['compras', 'compras.html', 'fa-cart-shopping', 'Compras MRO'],
    ['contratos', 'contratos.html', 'fa-file-signature', 'Contratos e Garantias'],
    ['executivo', 'executivo.html', 'fa-chart-column', 'Painel Executivo']
];

const INTEGRATION_LINKS = [
    ['iot', 'iot.html', 'fa-tower-broadcast', 'Central IoT'],
    ['notificacoes', 'notificacoes.html', 'fa-bell', 'Notificações'],
    ['continuidade', 'continuidade.html', 'fa-shield-halved', 'Continuidade']
];

function linkMarkup([page, href, icon, label], activePage) {
    const active = page === activePage ? ' bg-brand/10 text-brand font-medium' : ' text-slate-500 hover:bg-slate-100 hover:text-brand dark:text-slate-400 dark:hover:bg-dark-800 dark:hover:text-white';
    return `<a href="${href}" data-page="${page}" class="sb-link flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300${active}">
        <i class="fas ${icon} w-5 text-center shrink-0" aria-hidden="true"></i>
        <span class="sb-text">${label}</span>
    </a>`;
}

export function mountMaintenanceShell({ pageId, title, subtitle, content, headerActions = '' }) {
    try {
        if (localStorage.getItem('nexus-sidebar-collapsed') === '1') document.documentElement.classList.add('sidebar-collapsed');
    } catch (error) {}

    document.body.innerHTML = `
        <aside id="sidebar" class="bg-white dark:bg-dark-900 border-r border-slate-200 dark:border-dark-800 flex flex-col transition-all duration-300 z-20 shrink-0">
            <div class="h-20 flex items-center justify-between px-4 border-b border-slate-200 dark:border-dark-800/50 shrink-0">
                <div class="flex items-center gap-3 min-w-0 sb-text">
                    <img src="../../IMG/canvas-b.png" alt="Nexus Logo" class="h-9 w-9 object-contain invert dark:invert-0 shrink-0">
                    <div class="min-w-0"><p class="text-sm font-bold text-slate-800 dark:text-white truncate">Nexus Industrial</p><p class="text-[11px] text-slate-400 truncate">ERP · MRO</p></div>
                </div>
                <img src="../../IMG/canvas-b.png" alt="Nexus" class="h-8 w-8 object-contain invert dark:invert-0 sb-icon-collapsed shrink-0 mx-auto">
                <button id="sidebar-toggle" type="button" title="Recolher ou expandir menu" aria-label="Recolher ou expandir menu" class="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-800 hover:text-brand shrink-0">
                    <i class="fas fa-angles-left sb-icon-expanded" aria-hidden="true"></i><i class="fas fa-angles-right sb-icon-collapsed" aria-hidden="true"></i>
                </button>
            </div>
            <div class="px-4 pt-4 sb-text"><div class="relative"><i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" aria-hidden="true"></i><input type="text" placeholder="Pesquisar..." class="w-full bg-slate-100 dark:bg-dark-800 text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none"></div></div>
            <nav class="flex-1 p-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
                <p class="sb-text text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-1 px-2">Painel</p>
                ${BASE_LINKS.map((link) => linkMarkup(link, pageId)).join('')}
                <div class="mt-4 pt-3 border-t border-slate-200 dark:border-dark-800/70" data-maintenance-menu>
                    <p class="sb-text text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Operação e Gestão</p>
                    ${MAINTENANCE_LINKS.map((link) => linkMarkup(link, pageId)).join('')}
                </div>
                <div class="mt-4 pt-3 border-t border-slate-200 dark:border-dark-800/70" data-integration-menu>
                    <p class="sb-text text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Integrações</p>
                    ${INTEGRATION_LINKS.map((link) => linkMarkup(link, pageId)).join('')}
                </div>
            </nav>
            <div class="p-4 border-t border-slate-200 dark:border-dark-800/50 space-y-1 shrink-0">
                <button id="theme-toggle" type="button" class="sb-link w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-800 text-sm">
                    <span class="flex items-center gap-3"><i class="fas fa-sun text-amber-500 hidden dark:block w-5 text-center" aria-hidden="true"></i><i class="fas fa-moon block dark:hidden w-5 text-center" aria-hidden="true"></i><span class="font-medium theme-text-btn sb-text">Alternar tema</span></span>
                </button>
                <a href="../../index.html" class="sb-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm"><i class="fas fa-sign-out-alt w-5 text-center" aria-hidden="true"></i><span class="font-medium sb-text">Sair</span></a>
            </div>
        </aside>
        <main id="conteudo" class="flex-1 flex flex-col h-screen relative min-w-0" tabindex="-1">
            <header class="h-20 bg-white dark:bg-dark-900 border-b border-slate-200 dark:border-dark-800 flex items-center justify-between px-8 z-10 shrink-0">
                <div><h1 class="text-xl font-bold text-slate-800 dark:text-white tracking-wide">${escapeHtml(title)}</h1><p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${escapeHtml(subtitle)}</p></div>
                <div class="flex items-center gap-3">${headerActions}<div class="hidden md:flex items-center gap-3 border-l border-slate-200 dark:border-dark-700 pl-4"><div id="user-photo" class="h-10 w-10 rounded-full bg-gradient-to-tr from-brand to-emerald-400 flex items-center justify-center text-white font-bold bg-cover bg-center"><i class="fas fa-user" aria-hidden="true"></i></div><div><p id="user-name" class="text-sm font-bold text-slate-800 dark:text-white">Validando...</p><p id="user-role" class="text-xs text-slate-500 dark:text-slate-400">Acesso protegido</p></div></div></div>
            </header>
            <section id="maintenance-content" class="flex-1 min-h-0">${content}</section>
        </main>`;

    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        const collapsed = !document.documentElement.classList.contains('sidebar-collapsed');
        document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
        try { localStorage.setItem('nexus-sidebar-collapsed', collapsed ? '1' : '0'); } catch (error) {}
    });
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        if (window.NexusTheme) window.NexusTheme.set(next);
        else document.documentElement.classList.toggle('dark', next === 'dark');
    });
}

function blockAccess(profile = {}) {
    const role = escapeHtml(profile.role || 'não identificado');
    document.body.innerHTML = `<main class="nexus-access-error" role="alert"><div class="nexus-access-error__icon" aria-hidden="true"><i class="fas fa-lock"></i></div><h1>Acesso restrito</h1><p>O cargo <strong>${role}</strong> não possui permissão para abrir esta tela.</p><div class="nexus-access-error__actions"><a href="menu.html">Voltar ao painel</a></div></main>`;
    revealProtectedPage();
}

export function startProtectedPage(pageId, onReady) {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            const currentPage = window.location.pathname.split('/').pop() || 'menu.html';
            window.location.replace('login.html?return=' + encodeURIComponent(currentPage + window.location.search));
            return;
        }

        onValue(ref(db, `users/${user.uid}`), (snapshot) => {
            const profile = snapshot.val();
            if (!profile) {
                window.NexusAccessGate?.block('Seu perfil não foi localizado. Entre novamente ou solicite ajuda ao administrador.');
                return;
            }
            if (!getAllowedPages(profile).includes(pageId)) {
                blockAccess(profile);
                return;
            }

            applyAllowedMenu(profile);
            const name = document.getElementById('user-name');
            const role = document.getElementById('user-role');
            const photo = document.getElementById('user-photo');
            if (name) name.textContent = profile.name || user.email || 'Usuário';
            if (role) role.textContent = profile.role || 'Usuário';
            if (photo && profile.photoURL) {
                photo.style.backgroundImage = `url(${profile.photoURL})`;
                photo.textContent = '';
            }
            onReady?.({ user, profile });
            revealProtectedPage();
        }, (error) => {
            console.error('Falha ao consultar perfil.', error);
            window.NexusAccessGate?.block('Não foi possível consultar seu perfil. Verifique a conexão e tente novamente.');
        }, { onlyOnce: true });
    });
}

export function formatDate(timestamp, fallback = '—') {
    const value = Number(timestamp);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return new Date(value).toLocaleDateString('pt-BR');
}

export function formatDateTime(timestamp, fallback = '—') {
    const value = Number(timestamp);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function toDateTimeLocal(timestamp = Date.now()) {
    const date = new Date(Number(timestamp) || Date.now());
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function badge(meta = ORDER_STATUS.todo) {
    return `<span class="s3-badge ${meta.className}">${escapeHtml(meta.label)}</span>`;
}

export function orderStatusBadge(status) {
    return badge(ORDER_STATUS[status] || ORDER_STATUS.todo);
}

export function requestStatusBadge(status) {
    return badge(REQUEST_STATUS[status] || REQUEST_STATUS.new);
}

export function priorityBadge(priority) {
    return badge(PRIORITIES[priority] || PRIORITIES.normal);
}

export function entries(value) {
    return value && typeof value === 'object' ? Object.entries(value) : [];
}

export function emptyState(icon, title, description) {
    return `<div class="s3-empty"><div><i class="fas ${escapeHtml(icon)}" aria-hidden="true"></i><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p></div></div>`;
}

export function openDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog && !dialog.open) dialog.showModal();
}

export function closeDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog?.open) dialog.close();
}

export function wireDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    dialog.querySelectorAll('[data-dialog-close]').forEach((button) => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
    });
}

export function setButtonBusy(button, busy, label = 'Processando...') {
    if (!button) return;
    if (busy) {
        button.dataset.originalLabel = button.innerHTML;
        button.innerHTML = `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>${escapeHtml(label)}`;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
    } else {
        button.innerHTML = button.dataset.originalLabel || button.innerHTML;
        button.disabled = false;
        button.removeAttribute('aria-busy');
    }
}

export function toast(type, message) {
    if (window.nexusToast) window.nexusToast(type, message);
    else console[type === 'error' ? 'error' : 'log'](message);
}
