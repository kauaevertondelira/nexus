import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, push, ref, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export const firebaseConfig = {
    apiKey: "AIzaSyD6gj_6e0WuGr6C_hJDkXBK7cI2EopWV1s",
    authDomain: "nexus-iot-senai.firebaseapp.com",
    databaseURL: "https://nexus-iot-senai-default-rtdb.firebaseio.com",
    projectId: "nexus-iot-senai",
    storageBucket: "nexus-iot-senai.firebasestorage.app",
    messagingSenderId: "717361923500",
    appId: "1:717361923500:web:9e55a4dcb002e049abe609",
    measurementId: "G-JJ84BQSXJX"
};

export const ROLE_PERMISSIONS = {
    "Administrador": ["menu", "mapa", "ativos", "ativo-detalhes", "os", "os-detalhes", "planejamento", "preventiva", "inspecoes", "confiabilidade", "solicitacoes", "tecnico", "estoque", "financeiro", "mapa-consumo", "iot", "notificacoes", "continuidade", "fornecedores", "compras", "contratos", "executivo"],
    "Técnico de Manutenção": ["menu", "mapa", "ativos", "ativo-detalhes", "os", "os-detalhes", "planejamento", "preventiva", "inspecoes", "confiabilidade", "solicitacoes", "tecnico", "iot", "notificacoes", "compras"],
    "Almoxarifado / Suprimentos": ["menu", "mapa", "ativos", "ativo-detalhes", "os", "os-detalhes", "solicitacoes", "estoque", "mapa-consumo", "iot", "notificacoes", "confiabilidade", "fornecedores", "compras", "contratos"]
};

export const PUBLIC_REGISTRATION_ROLES = [
    "Técnico de Manutenção",
    "Almoxarifado / Suprimentos"
];

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export function revealProtectedPage() {
    if (window.NexusAccessGate) window.NexusAccessGate.release();
    else document.documentElement.classList.remove("nexus-auth-pending");
}

export function getAllowedPages(userData = {}) {
    const defaults = ROLE_PERMISSIONS[userData.role] || ["menu"];
    // O cargo sempre define o limite máximo; dados antigos/customizados nunca
    // podem conceder páginas acima da permissão oficial do cargo.
    const stored = Array.isArray(userData.allowedPages) ? userData.allowedPages : defaults;
    const allowed = stored.filter((page) => defaults.includes(page));

    // Mantém contas antigas compatíveis com os módulos adicionados depois.
    ["mapa", "mapa-consumo", "ativo-detalhes", "os-detalhes", "planejamento", "preventiva", "inspecoes", "confiabilidade", "solicitacoes", "tecnico", "iot", "notificacoes", "continuidade", "fornecedores", "compras", "contratos", "executivo"].forEach((page) => {
        if (defaults.includes(page) && !allowed.includes(page)) allowed.push(page);
    });
    if (userData.role === "Administrador" && !allowed.includes("financeiro")) {
        allowed.push("financeiro");
    }
    return allowed;
}

export function isAdmin(userData = {}) {
    return userData.role === "Administrador";
}

export function applyAllowedMenu(userData = {}) {
    const allowed = getAllowedPages(userData);
    document.querySelectorAll('[data-page]').forEach((link) => {
        const page = link.dataset.page;
        link.style.display = allowed.includes(page) ? '' : 'none';
    });
}

export async function writeAuditLog({ action, entity, entityId = "", description = "", metadata = {} }) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        await push(ref(db, "audit_logs"), {
            action,
            entity,
            entityId,
            description,
            metadata,
            createdByUid: user.uid,
            createdByEmail: user.email || "",
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.warn("Falha ao registrar auditoria.", error);
    }
}
