/**
 * auth-guard.js — Controle de Acesso por Cargo
 * Importar em TODAS as páginas protegidas.
 * Uso: import { guardPage, applyRoleMenu } from './auth-guard.js';
 *       guardPage('ativos');   // ID da página atual
 *       applyRoleMenu();       // Oculta itens de menu sem permissão
 */

import { auth, db, ROLE_PERMISSIONS, getAllowedPages, revealProtectedPage } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { escapeHtml } from "./security-utils.js";

// Mapa de permissões por cargo (espelho do login.js)
export { ROLE_PERMISSIONS };

// IDs de página → elementos do menu lateral
export const PAGE_MENU_MAP = {
    "menu":         '[data-page="menu"]',
    "mapa":         '[data-page="mapa"]',
    "ativos":       '[data-page="ativos"]',
    "ativo-detalhes": '[data-page="ativo-detalhes"]',
    "os":           '[data-page="os"]',
    "os-detalhes":  '[data-page="os-detalhes"]',
    "planejamento": '[data-page="planejamento"]',
    "preventiva":   '[data-page="preventiva"]',
    "inspecoes":    '[data-page="inspecoes"]',
    "confiabilidade": '[data-page="confiabilidade"]',
    "fornecedores": '[data-page="fornecedores"]',
    "compras":      '[data-page="compras"]',
    "contratos":    '[data-page="contratos"]',
    "executivo":    '[data-page="executivo"]',
    "solicitacoes": '[data-page="solicitacoes"]',
    "tecnico":      '[data-page="tecnico"]',
    "estoque":      '[data-page="estoque"]',
    "financeiro":   '[data-page="financeiro"]',
    "mapa-consumo": '[data-page="mapa-consumo"]',
    "iot":          '[data-page="iot"]',
    "notificacoes": '[data-page="notificacoes"]',
    "continuidade": '[data-page="continuidade"]',
};

/**
 * Verifica se o usuário logado tem acesso à página atual.
 * Se não tiver, redireciona para menu.html com alerta.
 * @param {string} pageId - ex: 'financeiro', 'ativos'
 */
export function guardPage(pageId) {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            const currentPage = window.location.pathname.split('/').pop() || 'menu.html';
            window.location.replace('login.html?return=' + encodeURIComponent(currentPage));
            return;
        }
        onValue(ref(db, 'users/' + user.uid), (snap) => {
            const data = snap.val();
            if (!data) return;
            const allowed = getAllowedPages(data);
            if (!allowed.includes(pageId)) {
                // Sem permissão: bloqueia a página com overlay
                document.body.innerHTML = `
                  <div class="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 p-8">
                    <div class="h-16 w-16 rounded-2xl bg-red-500/20 flex items-center justify-center text-4xl text-red-400">
                      <i class="fas fa-lock"></i>
                    </div>
                    <h1 class="text-2xl font-bold">Acesso Restrito</h1>
                    <p class="text-slate-400 text-center max-w-sm">
                      Seu cargo <strong class="text-white">${escapeHtml(data.role)}</strong> não tem permissão para acessar esta página.
                    </p>
                    <a href="menu.html" class="mt-4 px-6 py-3 bg-brand rounded-xl font-bold hover:bg-blue-600 transition-colors">
                      Voltar ao Painel
                    </a>
                  </div>`;
                revealProtectedPage();
                return;
            }
            revealProtectedPage();
        }, { onlyOnce: true });
    });
}

/**
 * Oculta itens do menu lateral que o usuário não pode acessar.
 * Requer que cada <a> do menu tenha data-page="nome".
 */
export function applyRoleMenu() {
    onAuthStateChanged(auth, (user) => {
        if (!user) return;
        onValue(ref(db, 'users/' + user.uid), (snap) => {
            const data = snap.val();
            if (!data) return;
            const allowed = getAllowedPages(data);
            Object.entries(PAGE_MENU_MAP).forEach(([page, selector]) => {
                document.querySelectorAll(selector).forEach(el => {
                    el.style.display = allowed.includes(page) ? '' : 'none';
                });
            });
        }, { onlyOnce: true });
    });
}
