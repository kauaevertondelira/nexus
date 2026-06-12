// ==========================================
// 1. IMPORTS (Sempre no topo absoluto!)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ==========================================
// 2. CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE
// ==========================================
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
// 3. FUNCIONALIDADE DO MODO ESCURO (THEME)
// ==========================================
function toggleTheme() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
    } else {
        html.classList.add('dark');
    }
}

// Atribui o clique ao botão de tema via JavaScript (Boa prática para Módulos)
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);


// ==========================================
// 4. RESTANTE DO SEU CÓDIGO (CONFIGS E FORMS)
// ==========================================
const getSwalTheme = () => document.documentElement.classList.contains('dark') ? { background: '#1e293b', color: '#f8fafc', confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' } : { confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' };

// Alternância entre forms
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

// Foto para Base64
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

// Login Submit
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

// Register Submit
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const name = document.getElementById('reg-name').value;
    const role = document.getElementById('reg-role').value;

    if (firebaseConfig.apiKey === "SUA_API_KEY") {
        Swal.fire({ title: 'Perfil Simulado!', text: 'Firebase não configurado. Redirecionando para teste...', icon: 'success', timer: 2000, showConfirmButton: false, ...getSwalTheme() })
            .then(() => { window.location.href = 'menu.html'; });
        return;
    }

    try {
        Swal.fire({ title: 'A criar perfil...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() }, ...getSwalTheme() });
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await set(ref(db, 'users/' + user.uid), { name: name, role: role, photoURL: base64Photo, email: email, createdAt: Date.now() });

        Swal.fire({ icon: 'success', title: 'Conta Criada!', text: 'Bem-vindo ao Nexus.', timer: 1500, showConfirmButton: false, ...getSwalTheme() })
            .then(() => { window.location.href = 'menu.html'; });
    } catch (error) {
        let errorMsg = "Erro ao criar conta.";
        if (error.code === 'auth/email-already-in-use') errorMsg = "Este e-mail já está em uso.";
        Swal.fire({ icon: 'error', title: 'Erro', text: errorMsg, ...getSwalTheme() });
    }
});