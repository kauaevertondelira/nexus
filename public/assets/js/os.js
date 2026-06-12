import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
        import { getDatabase, ref, onValue, push, remove, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
        import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

        const firebaseConfig = {
            apiKey: "AIzaSyD6gj_6e0WuGr6C_hJDkXBK7cI2EopWV1s",
            authDomain: "nexus-iot-senai.firebaseapp.com",
            databaseURL: "https://nexus-iot-senai-default-rtdb.firebaseio.com",
            projectId: "nexus-iot-senai"
        };
        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        const auth = getAuth(app);
        const osRef = ref(db, 'work_orders');

        let currentUserInfo = { name: "Operador", uid: "null" };

        if (firebaseConfig.apiKey === "SUA_API_KEY") {
            currentUserInfo = { name: "Gestor Operacional", uid: "simulado" };
            document.getElementById('user-name').innerText = currentUserInfo.name;
            document.getElementById('user-role').innerText = "Engenharia & PCM";
            document.getElementById('user-photo').innerHTML = '<i class="fas fa-user-tie text-xl"></i>';
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

        // Renderizar Kanban Compacto
        onValue(osRef, (snapshot) => {
            const data = snapshot.val();
            const todoList = document.getElementById('todo-list');
            const doingList = document.getElementById('doing-list');
            const doneList = document.getElementById('done-list');
            
            todoList.innerHTML = ''; doingList.innerHTML = ''; doneList.innerHTML = '';
            let countTodo = 0; let countDoing = 0; let countDone = 0;

            if (data) {
                Object.entries(data).forEach(([id, os]) => {
                    let priorityBadge = '';
                    if(os.priority === 'low') priorityBadge = '<span class="px-2 py-0.5 bg-slate-200 text-slate-600 dark:bg-slate-600/30 dark:text-slate-400 rounded text-[9px] font-bold uppercase">Baixa</span>';
                    else if(os.priority === 'normal') priorityBadge = '<span class="px-2 py-0.5 bg-blue-100 text-brand dark:bg-brand/20 rounded text-[9px] font-bold uppercase">Normal</span>';
                    else if(os.priority === 'urgent') priorityBadge = '<span class="px-2 py-0.5 bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-500 rounded text-[9px] font-bold uppercase">Urgente</span>';
                    else priorityBadge = '<span class="px-2 py-0.5 bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-500 rounded text-[9px] font-bold uppercase animate-pulse">Crítica</span>';

                    let actionBtns = '';
                    if(os.status === 'todo') {
                        countTodo++;
                        actionBtns = `
                            <button onclick="updateOsStatus('${id}', 'doing')" class="text-brand hover:text-blue-400 text-[11px] font-bold transition"><i class="fas fa-play mr-1"></i> Iniciar</button>
                            <button onclick="deleteOs('${id}')" class="text-slate-400 hover:text-red-500 text-[11px] transition"><i class="fas fa-trash"></i></button>`;
                    } else if (os.status === 'doing') {
                        countDoing++;
                        actionBtns = `
                            <button onclick="updateOsStatus('${id}', 'todo')" class="text-slate-400 hover:text-slate-300 text-[11px] transition"><i class="fas fa-pause mr-1"></i> Pausar</button>
                            <button onclick="updateOsStatus('${id}', 'done')" class="text-green-500 hover:text-green-400 text-[11px] font-bold transition"><i class="fas fa-check mr-1"></i> Concluir</button>`;
                    } else {
                        countDone++;
                        actionBtns = `
                            <span class="text-green-500/50 text-[11px]"><i class="fas fa-check-double mr-1"></i> Finalizada</span>
                            <button onclick="deleteOs('${id}')" class="text-slate-400 hover:text-red-500 text-[11px] transition"><i class="fas fa-trash"></i></button>`;
                    }

                    // Cartão mais fino e compacto
                    const cardHtml = `
                        <div class="bg-white dark:bg-dark-800 p-3 rounded-xl border border-slate-200 dark:border-dark-700/50 shadow-sm transition-transform hover:-translate-y-1">
                            <div class="flex justify-between items-center mb-1.5">
                                <span class="text-[10px] font-mono text-slate-400">#OS-${id.substring(1, 6).toUpperCase()}</span>
                                ${priorityBadge}
                            </div>
                            <h4 class="text-sm font-bold text-slate-800 dark:text-white mb-2 leading-tight">${os.title}</h4>
                            
                            <div class="flex items-center justify-between mb-2">
                                <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate w-[55%]"><i class="fas fa-wrench mr-1"></i> ${os.type}</p>
                                <div class="text-[10px] text-slate-400 truncate w-[40%] text-right">
                                    <i class="fas fa-user-edit"></i> <span class="text-slate-500 dark:text-slate-300">${os.createdBy || 'Sistema'}</span>
                                </div>
                            </div>

                            <div class="flex justify-between items-center pt-2 mt-1 border-t border-slate-100 dark:border-dark-700/50">
                                ${actionBtns}
                            </div>
                        </div>
                    `;

                    if(os.status === 'todo') todoList.innerHTML += cardHtml;
                    else if(os.status === 'doing') doingList.innerHTML += cardHtml;
                    else doneList.innerHTML += cardHtml;
                });
            }
            
            if(countTodo === 0) todoList.innerHTML = '<div class="text-center text-slate-400 text-xs mt-6">Nenhuma O.S. pendente.</div>';
            if(countDoing === 0) doingList.innerHTML = '<div class="text-center text-slate-400 text-xs mt-6">Nenhuma O.S. em execução.</div>';
            if(countDone === 0) doneList.innerHTML = '<div class="text-center text-slate-400 text-xs mt-6">Nenhuma O.S. concluída.</div>';

            document.getElementById('kpi-todo').innerText = countTodo;
            document.getElementById('kpi-doing').innerText = countDoing;
            document.getElementById('kpi-done').innerText = countDone;
        });

        window.addOs = () => {
            Swal.fire({
                title: 'Nova Ordem de Serviço',
                html: `
                    <input id="swal-title" class="swal2-input" placeholder="Ex: Substituição de Rolamento">
                    <select id="swal-type" class="swal2-select">
                        <option value="Preventiva">Manutenção Preventiva</option>
                        <option value="Corretiva">Manutenção Corretiva</option>
                        <option value="Inspecao">Inspeção de Rotina</option>
                    </select>
                    <select id="swal-priority" class="swal2-select">
                        <option value="low">Baixa Prioridade</option>
                        <option value="normal" selected>Normal</option>
                        <option value="urgent">Urgente</option>
                        <option value="danger">Falha Crítica (Parada)</option>
                    </select>
                `,
                showCancelButton: true, cancelButtonText: 'Cancelar', confirmButtonText: 'Registar', ...getSwalTheme(),
                preConfirm: () => {
                    const title = document.getElementById('swal-title').value;
                    if(!title) { Swal.showValidationMessage('O título é obrigatório'); return false; }
                    return {
                        title: title,
                        type: document.getElementById('swal-type').value,
                        priority: document.getElementById('swal-priority').value,
                        status: 'todo',
                        createdAt: Date.now(),
                        createdBy: currentUserInfo.name 
                    }
                }
            }).then((res) => {
                if (res.isConfirmed) {
                    push(osRef, res.value);
                    Swal.fire({ title: 'Registada!', icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false, ...getSwalTheme() });
                }
            });
        };

        window.updateOsStatus = (id, newStatus) => { 
            update(ref(db, 'work_orders/' + id), { 
                status: newStatus,
                lastUpdatedBy: currentUserInfo.name
            }); 
        };

        window.deleteOs = (id) => {
            Swal.fire({ title: 'Eliminar O.S.?', text: "Este registo será apagado.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim', cancelButtonText: 'Cancelar', ...getSwalTheme() })
            .then((r) => { if(r.isConfirmed) remove(ref(db, 'work_orders/' + id)); });
        };

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