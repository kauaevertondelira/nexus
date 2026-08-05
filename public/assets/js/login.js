import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

// ==========================================
// MAPEAMENTO DE PERMISSÕES POR CARGO
// ==========================================
const ROLE_PERMISSIONS = {
    "Administrador": {
        pages: ["menu", "ativos", "os", "estoque", "financeiro", "mapa-consumo"],
        label: "Acesso total ao sistema",
        color: "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-300",
        icon: "fas fa-crown"
    },
    "Técnico de Manutenção": {
        pages: ["menu", "ativos", "os"],
        label: "Visão Global · Parque de Ativos · Ordens de Serviço",
        color: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300",
        icon: "fas fa-wrench"
    },
    "Almoxarifado / Suprimentos": {
        pages: ["menu", "ativos", "os", "estoque", "mapa-consumo"],
        label: "Tudo, exceto Financeiro",
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
    ? { background: '#1e293b', color: '#f8fafc', confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' }
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
    const perm = ROLE_PERMISSIONS[this.value];
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

    if (firebaseConfig.apiKey === "SUA_API_KEY") {
        Swal.fire({ title: 'Modo de Teste', text: 'Firebase não configurado. Redirecionando para teste visual...', icon: 'info', timer: 2000, showConfirmButton: false, ...getSwalTheme() })
            .then(() => { window.location.href = 'menu.html'; });
        return;
    }

    try {
        Swal.fire({ title: 'A autenticar...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() }, ...getSwalTheme() });
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = 'menu.html';
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Acesso Negado', text: 'Verifique as suas credenciais.', ...getSwalTheme() });
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
    const perm = ROLE_PERMISSIONS[role];

    if (!perm) {
        Swal.fire({ icon: 'warning', title: 'Cargo inválido', text: 'Selecione um cargo válido.', ...getSwalTheme() });
        return;
    }

    if (firebaseConfig.apiKey === "SUA_API_KEY") {
        Swal.fire({ title: 'Perfil Simulado!', text: `Cargo: ${role} | Acesso: ${perm.label}`, icon: 'success', timer: 2500, showConfirmButton: false, ...getSwalTheme() })
            .then(() => { window.location.href = 'menu.html'; });
        return;
    }

    try {
        Swal.fire({ title: 'A criar perfil...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() }, ...getSwalTheme() });
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Salva no Firebase com as páginas permitidas para este cargo
        await set(ref(db, 'users/' + user.uid), {
            name: name,
            role: role,
            allowedPages: perm.pages,   // <-- controle de acesso por cargo
            photoURL: base64Photo,
            email: email,
            createdAt: Date.now()
        });

        Swal.fire({ icon: 'success', title: 'Conta Criada!', text: `Bem-vindo ao Nexus, ${name}!`, timer: 1500, showConfirmButton: false, ...getSwalTheme() })
            .then(() => { window.location.href = 'menu.html'; });
    } catch (error) {
        let errorMsg = "Erro ao criar conta.";
        if (error.code === 'auth/email-already-in-use') errorMsg = "Este e-mail já está em uso.";
        Swal.fire({ icon: 'error', title: 'Erro', text: errorMsg, ...getSwalTheme() });
    }
});
