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

        if (firebaseConfig.apiKey === "AIzaSyD6gj_6e0WuGr6C_hJDkXBK7cI2EopWV1s") {
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