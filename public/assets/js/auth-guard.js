/**
 * auth-guard.js — Controle de Acesso por Cargo
 * Importar em TODAS as páginas protegidas.
 * Uso: import { guardPage, applyRoleMenu } from './auth-guard.js';
 *       guardPage('ativos');   // ID da página atual
 *       applyRoleMenu();       // Oculta itens de menu sem permissão
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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

// Evita inicializar o Firebase duas vezes se menu.js já o fez
let _app, _auth, _db;
try {
    const { getApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    _app = getApp();
} catch {
    _app = initializeApp(firebaseConfig, 'auth-guard');
}
_auth = getAuth(_app);
_db = getDatabase(_app);

// Mapa de permissões por cargo (espelho do login.js)
export const ROLE_PERMISSIONS = {
    "Administrador":            ["menu", "ativos", "os", "estoque", "financeiro", "mapa-consumo"],
    "Técnico de Manutenção":    ["menu", "ativos", "os"],
    "Almoxarifado / Suprimentos": ["menu", "ativos", "os", "estoque", "mapa-consumo"]
};

// IDs de página → elementos do menu lateral
export const PAGE_MENU_MAP = {
    "menu":         '[data-page="menu"]',
    "ativos":       '[data-page="ativos"]',
    "os":           '[data-page="os"]',
    "estoque":      '[data-page="estoque"]',
    "financeiro":   '[data-page="financeiro"]',
    "mapa-consumo": '[data-page="mapa-consumo"]',
};

/**
 * Verifica se o usuário logado tem acesso à página atual.
 * Se não tiver, redireciona para menu.html com alerta.
 * @param {string} pageId - ex: 'financeiro', 'ativos'
 */
export function guardPage(pageId) {
    onAuthStateChanged(_auth, (user) => {
        if (!user) {
            window.location.href = '../../index.html';
            return;
        }
        onValue(ref(_db, 'users/' + user.uid), (snap) => {
            const data = snap.val();
            if (!data) return;
            const allowed = data.allowedPages || ROLE_PERMISSIONS[data.role] || ["menu"];
            if (!allowed.includes(pageId)) {
                // Sem permissão: bloqueia a página com overlay
                document.body.innerHTML = `
                  <div class="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 p-8">
                    <div class="h-16 w-16 rounded-2xl bg-red-500/20 flex items-center justify-center text-4xl text-red-400">
                      <i class="fas fa-lock"></i>
                    </div>
                    <h1 class="text-2xl font-bold">Acesso Restrito</h1>
                    <p class="text-slate-400 text-center max-w-sm">
                      Seu cargo <strong class="text-white">${data.role}</strong> não tem permissão para acessar esta página.
                    </p>
                    <a href="menu.html" class="mt-4 px-6 py-3 bg-brand rounded-xl font-bold hover:bg-blue-600 transition-colors">
                      Voltar ao Painel
                    </a>
                  </div>`;
            }
        }, { onlyOnce: true });
    });
}

/**
 * Oculta itens do menu lateral que o usuário não pode acessar.
 * Requer que cada <a> do menu tenha data-page="nome".
 */
export function applyRoleMenu() {
    onAuthStateChanged(_auth, (user) => {
        if (!user) return;
        onValue(ref(_db, 'users/' + user.uid), (snap) => {
            const data = snap.val();
            if (!data) return;
            const allowed = data.allowedPages || ROLE_PERMISSIONS[data.role] || ["menu"];
            Object.entries(PAGE_MENU_MAP).forEach(([page, selector]) => {
                const el = document.querySelector(selector);
                if (el) {
                    if (!allowed.includes(page)) {
                        el.style.display = 'none';
                    } else {
                        el.style.display = '';
                    }
                }
            });
        }, { onlyOnce: true });
    });
}
