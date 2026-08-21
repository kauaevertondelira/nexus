import { auth, db, PUBLIC_REGISTRATION_ROLES, ROLE_PERMISSIONS as PAGE_PERMISSIONS, writeAuditLog } from "./firebase.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, deleteUser } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const VALID_RETURN_PAGES = new Set([
    'menu.html',
    'mapa.html',
    'mapa-consumo.html',
    'ativos.html',
    'ativo-detalhes.html',
    'os.html',
    'os-detalhes.html',
    'planejamento.html',
    'preventiva.html',
    'solicitacoes.html',
    'tecnico.html',
    'inspecoes.html',
    'confiabilidade.html',
    'fornecedores.html',
    'compras.html',
    'contratos.html',
    'executivo.html',
    'estoque.html',
    'financeiro.html',
    'iot.html',
    'notificacoes.html',
    'continuidade.html'
]);

function getReturnPage() {
    const requested = new URLSearchParams(window.location.search).get('return');
    if (!requested) return 'menu.html';
    try {
        const parsed = new URL(requested, window.location.href);
        const file = parsed.pathname.split('/').pop();
        if (parsed.origin !== window.location.origin || !VALID_RETURN_PAGES.has(file)) return 'menu.html';
        return file + parsed.search;
    } catch (error) {
        return 'menu.html';
    }
}

// ==========================================
// MAPEAMENTO DE PERMISSÕES POR CARGO
// ==========================================
const ROLE_DETAILS = {
    "Administrador": {
        label: "Acesso total ao sistema",
        color: "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-300",
        icon: "fas fa-crown"
    },
    "Técnico de Manutenção": {
        label: "Manutenção, planejamento, O.S., ativos, telemetria e requisições de compra",
        color: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300",
        icon: "fas fa-wrench"
    },
    "Almoxarifado / Suprimentos": {
        label: "Estoque, fornecedores, compras, garantias, ativos, consumo e telemetria",
        color: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300",
        icon: "fas fa-boxes"
    }
};

// ==========================================
// MODO ESCURO
// ==========================================
function toggleTheme() {
    const html = document.documentElement;
    html.classList.toggle('dark');
}
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

const getSwalTheme = () => document.documentElement.classList.contains('dark')
    ? { background: '#223249', color: '#f8fafc', confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' }
    : { confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' };

// ==========================================
// ALTERNÂNCIA ENTRE FORMS
// ==========================================
document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
});

// ==========================================
// HINT DE PERMISSÕES AO ESCOLHER CARGO
// ==========================================
document.getElementById('reg-role').addEventListener('change', function () {
    const hint = document.getElementById('role-permissions-hint');
    const perm = ROLE_DETAILS[this.value];
    if (perm) {
        hint.className = `mt-2 p-3 rounded-xl text-xs border ${perm.color}`;
        hint.innerHTML = `<i class="${perm.icon} mr-1.5"></i><strong>${this.value}:</strong> ${perm.label}`;
        hint.classList.remove('hidden');
    } else {
        hint.classList.add('hidden');
    }
});

// ==========================================
// FOTO PARA BASE64
// ==========================================
let base64Photo = '';
document.getElementById('reg-photo').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        if (!file.type.startsWith('image/') || file.size > 1024 * 1024) {
            e.target.value = '';
            base64Photo = '';
            Swal.fire({ icon: 'warning', title: 'Imagem inválida', text: 'Escolha uma imagem de até 1 MB.', ...getSwalTheme() });
            return;
        }
        const reader = new FileReader();
        reader.onload = function (event) {
            base64Photo = event.target.result;
            document.getElementById('photo-preview').innerHTML = `<img src="${base64Photo}" class="w-full h-full object-cover rounded-full">`;
        };
        reader.readAsDataURL(file);
    }
});

// ==========================================
// LOGIN SUBMIT
// ==========================================
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const button = document.getElementById('login-submit');
    const startedAt = performance.now();
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
        Swal.fire({ title: 'A autenticar...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() }, ...getSwalTheme() });
        await setPersistence(auth, browserLocalPersistence).catch(() => {});
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const authDurationMs = Math.round(performance.now() - startedAt);
        await Promise.race([writeAuditLog({
            action: 'login',
            entity: 'session',
            entityId: credential.user.uid,
            description: 'Login realizado com sucesso.',
            metadata: { method: 'email_password', destination: getReturnPage(), authDurationMs }
        }), new Promise((resolve) => window.setTimeout(resolve, 700))]);
        window.location.href = getReturnPage();
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Acesso Negado', text: 'Verifique as suas credenciais.', ...getSwalTheme() });
    } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
    }
});

// ==========================================
// REGISTER SUBMIT — Salva cargo e permissões
// ==========================================
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const name = document.getElementById('reg-name').value;
    const role = document.getElementById('reg-role').value;
    const perm = ROLE_DETAILS[role];

    if (!perm || !PUBLIC_REGISTRATION_ROLES.includes(role)) {
        Swal.fire({ icon: 'warning', title: 'Cargo inválido', text: 'Selecione um cargo válido.', ...getSwalTheme() });
        return;
    }

    if (password.length < 8) {
        Swal.fire({ icon: 'warning', title: 'Senha muito curta', text: 'Use pelo menos 8 caracteres.', ...getSwalTheme() });
        return;
    }

    try {
        Swal.fire({ title: 'A criar perfil...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() }, ...getSwalTheme() });
        await setPersistence(auth, browserLocalPersistence).catch(() => {});
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Salva no Firebase com as páginas permitidas para este cargo
        try {
            await set(ref(db, 'users/' + user.uid), {
                name: name.trim(),
                role: role,
                allowedPages: PAGE_PERMISSIONS[role],
                photoURL: base64Photo,
                email: email,
                createdAt: Date.now()
            });
        } catch (profileError) {
            await deleteUser(user).catch(() => {});
            throw profileError;
        }

        await writeAuditLog({
            action: 'register',
            entity: 'session',
            entityId: user.uid,
            description: 'Nova conta criada.',
            metadata: { role }
        });

        Swal.fire({ icon: 'success', title: 'Conta Criada!', text: `Bem-vindo ao Nexus, ${name}!`, timer: 1500, showConfirmButton: false, ...getSwalTheme() })
            .then(() => { window.location.href = getReturnPage(); });
    } catch (error) {
        let errorMsg = "Erro ao criar conta.";
        if (error.code === 'auth/email-already-in-use') errorMsg = "Este e-mail já está em uso.";
        Swal.fire({ icon: 'error', title: 'Erro', text: errorMsg, ...getSwalTheme() });
    }
});
