
// ==========================================
// GUARD DE ACESSO — bloqueia cargo sem permissão
// ==========================================
function checkPageAccess(pageId, userData) {
    const allowed = getAllowedPages(userData);
    if (!allowed.includes(pageId)) {
        document.body.style.overflow = "hidden";
        document.body.innerHTML = `
          <div style="min-height:100vh;background:#1d2b40;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;gap:16px;padding:32px;font-family:sans-serif">
            <div style="width:64px;height:64px;border-radius:16px;background:rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;font-size:28px">🔒</div>
            <h1 style="font-size:22px;font-weight:800;margin:0">Acesso Restrito</h1>
            <p style="color:#94a3b8;text-align:center;max-width:360px;margin:0">
              Seu cargo <strong style="color:white">${userData.role}</strong> não tem permissão para acessar esta página.
            </p>
            <a href="menu.html" style="margin-top:8px;padding:12px 24px;background:#3b82f6;border-radius:12px;font-weight:700;color:white;text-decoration:none">
              ← Voltar ao Painel
            </a>
          </div>`;
        revealProtectedPage();
        return false;
    }
    revealProtectedPage();
    return true;
}

import { auth, db, getAllowedPages, applyAllowedMenu, revealProtectedPage, writeAuditLog } from "./firebase.js";
import { ref, onValue, push, remove, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { escapeHtml, nonNegative } from "./security-utils.js";
        const osRef = ref(db, 'work_orders');
        const SLA_HOURS = Object.freeze({ danger: 4, urgent: 12, normal: 72, low: 168 });

        let currentUserInfo = { name: "Operador", uid: "null", role: "" };
        let workOrdersById = {};

        const isAdmin = () => currentUserInfo.role === 'Administrador';
        const isTechnician = () => currentUserInfo.role === 'Técnico de Manutenção';
        const canManageOrders = () => isAdmin() || isTechnician();

        function canOperateOrder(order = {}) {
            if (isAdmin()) return true;
            if (!isTechnician()) return false;
            return !order.assignedToUid || order.assignedToUid === currentUserInfo.uid || order.createdByUid === currentUserInfo.uid;
        }

        function elapsedMs(order = {}, now = Date.now()) {
            const accumulated = nonNegative(order.accumulatedMs);
            const timerStartedAt = Number(order.timerStartedAt);
            return timerStartedAt > 0 ? accumulated + Math.max(0, now - timerStartedAt) : accumulated;
        }

        function defaultDueAt(priority = 'normal', createdAt = Date.now()) {
            return createdAt + (SLA_HOURS[priority] || SLA_HOURS.normal) * 3600000;
        }

        function toDateTimeLocal(timestamp) {
            const date = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60000);
            return date.toISOString().slice(0, 16);
        }

        function slaView(order = {}) {
            const dueAt = nonNegative(order.dueAt, defaultDueAt(order.priority, nonNegative(order.createdAt, Date.now())));
            if (order.status === 'done') {
                const completedAt = nonNegative(order.completedAt, order.approvedAt);
                const onTime = !completedAt || completedAt <= dueAt;
                return { overdue: false, html: `<span class="text-[9px] font-bold ${onTime ? 'text-green-500' : 'text-amber-500'}"><i class="fas fa-flag-checkered mr-1"></i>${onTime ? 'SLA cumprido' : 'Concluída após SLA'}</span>` };
            }
            const remainingHours = Math.ceil((dueAt - Date.now()) / 3600000);
            if (remainingHours < 0) return { overdue: true, html: `<span class="text-[9px] font-bold text-red-500"><i class="fas fa-clock mr-1"></i>Atrasada ${Math.abs(remainingHours)}h</span>` };
            if (remainingHours <= 12) return { overdue: false, html: `<span class="text-[9px] font-bold text-amber-500"><i class="fas fa-hourglass-half mr-1"></i>Vence em ${remainingHours}h</span>` };
            return { overdue: false, html: `<span class="text-[9px] font-bold text-slate-400"><i class="fas fa-calendar-check mr-1"></i>SLA ${new Date(dueAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>` };
        }

        onAuthStateChanged(auth, (user) => {
                if (user) {
                    onValue(ref(db, 'users/' + user.uid), (snapshot) => {
                        const data = snapshot.val();
                        if(data) {
                            currentUserInfo = { name: data.name, uid: user.uid, role: data.role };
                            document.getElementById('user-name').innerText = data.name;
                            document.getElementById('user-role').innerText = data.role;
                            if (!checkPageAccess('os', data)) return;
                            applyAllowedMenu(data);
                            const newOrderButton = document.getElementById('new-os-button');
                            if (newOrderButton) newOrderButton.style.display = canManageOrders() ? '' : 'none';
                            renderOrders();
                            openRequestedOrder();
                            if(data.photoURL) {
                                document.getElementById('user-photo').style.backgroundImage = `url(${data.photoURL})`;
                                document.getElementById('user-photo').innerHTML = '';
                            } else {
                                document.getElementById('user-photo').innerHTML = '<i class="fas fa-user text-xl"></i>';
                            }
                        }
                    });
                } else {
                    const currentPage = window.location.pathname.split('/').pop() || 'os.html';
                    window.location.replace('login.html?return=' + encodeURIComponent(currentPage));
                }
        });

        const getSwalTheme = () => document.documentElement.classList.contains('dark') ? { background: '#223249', color: '#f8fafc', confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' } : { confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' };

        let assetsById = {};
        onValue(ref(db, 'assets'), (snapshot) => {
            assetsById = snapshot.val() || {};
            openRequestedOrder();
        });

        // Renderizar Kanban Compacto
        function renderOrders(data = workOrdersById) {
            workOrdersById = data || {};
            const todoList = document.getElementById('todo-list');
            const doingList = document.getElementById('doing-list');
            const doneList = document.getElementById('done-list');
            
            todoList.innerHTML = ''; doingList.innerHTML = ''; doneList.innerHTML = '';
            let countTodo = 0; let countDoing = 0; let countDone = 0; let countOverdue = 0;

            if (data) {
                Object.entries(data).forEach(([id, os]) => {
                    const safeTitle = escapeHtml(os.title || 'O.S. sem título');
                    const safeType = escapeHtml(os.type || 'Não informado');
                    const safeAuthor = escapeHtml(os.createdBy || 'Sistema');
                    const assetName = escapeHtml(assetsById[os.assetId]?.name || os.assetName || 'Sem ativo vinculado');
                    const sla = slaView(os);
                    if (sla.overdue) countOverdue++;
                    let priorityBadge = '';
                    if(os.priority === 'low') priorityBadge = '<span class="px-2 py-0.5 bg-slate-200 text-slate-600 dark:bg-slate-600/30 dark:text-slate-400 rounded text-[9px] font-bold uppercase">Baixa</span>';
                    else if(os.priority === 'normal') priorityBadge = '<span class="px-2 py-0.5 bg-blue-100 text-brand dark:bg-brand/20 rounded text-[9px] font-bold uppercase">Normal</span>';
                    else if(os.priority === 'urgent') priorityBadge = '<span class="px-2 py-0.5 bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-500 rounded text-[9px] font-bold uppercase">Urgente</span>';
                    else priorityBadge = '<span class="px-2 py-0.5 bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-500 rounded text-[9px] font-bold uppercase animate-pulse">Crítica</span>';

                    const canOperate = canOperateOrder(os);
                    const canDelete = isAdmin();
                    let actionBtns = '';
                    if(os.status === 'todo') {
                        countTodo++;
                        actionBtns = `${canOperate ? `
                            <button onclick="updateOsStatus('${id}', 'doing')" aria-label="Iniciar ordem ${safeTitle}" class="text-brand hover:text-blue-400 text-[11px] font-bold transition px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10"><i class="fas fa-play mr-1"></i> Iniciar</button>
                        ` : ''}${canDelete ? `<button onclick="deleteOs('${id}')" aria-label="Remover ordem ${safeTitle}" class="text-slate-400 hover:text-red-500 text-[11px] transition px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"><i class="fas fa-trash"></i></button>` : ''}`;
                    } else if (os.status === 'doing') {
                        countDoing++;
                        actionBtns = canOperate ? `
                            <button onclick="updateOsStatus('${id}', 'todo')" aria-label="Pausar ordem ${safeTitle}" class="text-slate-400 hover:text-slate-300 text-[11px] transition px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-dark-700"><i class="fas fa-pause mr-1"></i> Pausar</button>
                            <button onclick="completeOs('${id}')" aria-label="Concluir e aprovar ordem ${safeTitle}" class="text-green-500 hover:text-green-400 text-[11px] font-bold transition px-2 py-1 rounded-md hover:bg-green-50 dark:hover:bg-green-500/10"><i class="fas fa-check mr-1"></i> Concluir</button>` : '';
                    } else {
                        countDone++;
                        actionBtns = `
                            <span class="text-green-500/70 text-[11px]" title="Aprovada por ${escapeHtml(os.approvedBy || os.lastUpdatedBy || 'usuário autorizado')}"><i class="fas fa-user-check mr-1"></i> Aprovada</span>
                            ${canDelete ? `<button onclick="deleteOs('${id}')" aria-label="Remover ordem ${safeTitle}" class="text-slate-400 hover:text-red-500 text-[11px] transition px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"><i class="fas fa-trash"></i></button>` : ''}`;
                    }

                    // Cartão mais fino e compacto
                    const cardHtml = `
                        <div class="bg-white dark:bg-dark-800 p-3 rounded-xl border border-slate-200 dark:border-dark-700/50 shadow-sm transition-transform hover:-translate-y-1 focus-within:ring-2 focus-within:ring-brand/30">
                            <div class="flex justify-between items-center mb-1.5">
                                <span class="text-[10px] font-mono text-slate-400">#OS-${id.substring(1, 6).toUpperCase()}</span>
                                ${priorityBadge}
                            </div>
                            <h4 class="text-sm font-bold text-slate-800 dark:text-white mb-1 leading-tight">${safeTitle}</h4>
                            <p class="text-[10px] text-brand truncate mb-2"><i class="fas fa-industry mr-1"></i>${assetName}</p>
                            
                            <div class="flex items-center justify-between mb-2">
                                <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate w-[55%]"><i class="fas fa-wrench mr-1"></i> ${safeType}</p>
                                <div class="text-[10px] text-slate-400 truncate w-[40%] text-right">
                                    <i class="fas fa-user-edit"></i> <span class="text-slate-500 dark:text-slate-300">${safeAuthor}</span>
                                </div>
                            </div>

                            <div class="mb-2">${sla.html}</div>

                            <div class="flex justify-between items-center gap-2 pt-2 mt-1 border-t border-slate-100 dark:border-dark-700/50">
                                <a href="os-detalhes.html?id=${encodeURIComponent(id)}" class="text-slate-500 hover:text-brand text-[11px] font-bold transition px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-dark-700"><i class="fas fa-up-right-from-square mr-1"></i> O.S. 360°</a>
                                <div class="flex items-center gap-1">${actionBtns}</div>
                            </div>
                        </div>
                    `;

                    if(os.status === 'todo') todoList.innerHTML += cardHtml;
                    else if(os.status === 'doing') doingList.innerHTML += cardHtml;
                    else doneList.innerHTML += cardHtml;
                });
            }
            
            if(countTodo === 0) todoList.innerHTML = '<div class="nexus-empty-state"><i class="fas fa-inbox text-xl"></i><strong>Fila limpa</strong><span>Nenhuma O.S. pendente.</span></div>';
            if(countDoing === 0) doingList.innerHTML = '<div class="nexus-empty-state"><i class="fas fa-cogs text-xl"></i><strong>Sem execução</strong><span>Nenhuma O.S. em andamento.</span></div>';
            if(countDone === 0) doneList.innerHTML = '<div class="nexus-empty-state"><i class="fas fa-check-circle text-xl"></i><strong>Nada finalizado ainda</strong><span>As ordens concluídas aparecem aqui.</span></div>';

            document.getElementById('kpi-todo').innerText = countTodo;
            document.getElementById('kpi-doing').innerText = countDoing;
            document.getElementById('kpi-done').innerText = countDone;
            document.getElementById('kpi-overdue').innerText = countOverdue;
        }

        onValue(osRef, (snapshot) => renderOrders(snapshot.val() || {}));

        window.addOs = (defaults = {}) => {
            if (!canManageOrders()) return window.nexusToast?.('error', 'Seu perfil não pode criar O.S.');
            const suggestedTitle = defaults.machine ? `Inspeção da máquina ${defaults.machine}` : '';
            const assetOptions = Object.entries(assetsById)
                .map(([id, asset]) => `<option value="${escapeHtml(id)}">${escapeHtml(asset.name || id)}</option>`)
                .join('');
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
                    <select id="swal-asset" class="swal2-select">
                        <option value="">Sem ativo vinculado</option>
                        ${assetOptions}
                    </select>
                    <input id="swal-cost" type="number" min="0" step="0.01" class="swal2-input" placeholder="Custo estimado (R$)">
                    <input id="swal-downtime" type="number" min="0" step="0.1" class="swal2-input" placeholder="Horas de parada estimadas">
                    <label for="swal-due" class="block text-left text-xs opacity-70 w-[85%] mx-auto mt-2">Prazo do SLA</label>
                    <input id="swal-due" type="datetime-local" class="swal2-input">
                `,
                showCancelButton: true, cancelButtonText: 'Cancelar', confirmButtonText: 'Registar', ...getSwalTheme(),
                didOpen: () => {
                    if (suggestedTitle) document.getElementById('swal-title').value = suggestedTitle;
                    if (defaults.machine && assetsById[defaults.machine]) document.getElementById('swal-asset').value = defaults.machine;
                    const priority = document.getElementById('swal-priority');
                    const due = document.getElementById('swal-due');
                    due.value = toDateTimeLocal(defaultDueAt(priority.value));
                    priority.addEventListener('change', () => { due.value = toDateTimeLocal(defaultDueAt(priority.value)); });
                },
                preConfirm: () => {
                    const title = document.getElementById('swal-title').value.trim();
                    if(!title) { Swal.showValidationMessage('O título é obrigatório'); return false; }
                    const assetId = document.getElementById('swal-asset').value;
                    return {
                        title: title,
                        type: document.getElementById('swal-type').value,
                        priority: document.getElementById('swal-priority').value,
                        assetId,
                        assetName: assetsById[assetId]?.name || '',
                        estimatedCost: nonNegative(document.getElementById('swal-cost').value),
                        downtimeHours: nonNegative(document.getElementById('swal-downtime').value),
                        dueAt: new Date(document.getElementById('swal-due').value).getTime() || defaultDueAt(document.getElementById('swal-priority').value),
                        status: 'todo',
                        createdAt: Date.now(),
                        createdBy: currentUserInfo.name,
                        createdByUid: currentUserInfo.uid
                    }
                }
            }).then(async (res) => {
                if (res.isConfirmed) {
                    try {
                        const created = await push(osRef, res.value);
                        await writeAuditLog({ action: 'create', entity: 'work_order', entityId: created.key, description: `O.S. ${res.value.title} criada.`, metadata: { assetId: res.value.assetId } });
                        window.nexusToast?.('success', 'O.S. registada.');
                    } catch (error) {
                        window.nexusToast?.('error', 'Não foi possível registrar a O.S.');
                    }
                }
            });
        };

        let requestedOrderOpened = false;
        function openRequestedOrder() {
            if (requestedOrderOpened) return;
            const params = new URLSearchParams(window.location.search);
            if (params.get('acao') !== 'nova_os') return;

            const machine = (params.get('maquina') || '').trim().slice(0, 60);
            if (machine && !assetsById[machine]) return;
            requestedOrderOpened = true;
            window.setTimeout(() => window.addOs({ machine }), 0);
        }

        window.updateOsStatus = async (id, newStatus) => {
            if (newStatus === 'done') return window.completeOs(id);
            const order = workOrdersById[id];
            if (!order || !canOperateOrder(order)) return window.nexusToast?.('error', 'Seu perfil não pode alterar esta O.S.');
            const now = Date.now();
            const changes = {
                status: newStatus,
                updatedAt: now,
                lastUpdatedBy: currentUserInfo.name
            };
            if (newStatus === 'doing') {
                changes.assignedToUid = order.assignedToUid || currentUserInfo.uid;
                changes.assignedToName = order.assignedToName || currentUserInfo.name;
                changes.assignedAt = order.assignedAt || now;
                changes.timerStartedAt = order.timerStartedAt || now;
                changes.startedAt = order.startedAt || now;
            } else if (newStatus === 'todo') {
                const accumulatedMs = elapsedMs(order, now);
                changes.accumulatedMs = accumulatedMs;
                changes.actualHours = Number((accumulatedMs / 3600000).toFixed(2));
                changes.timerStartedAt = null;
                changes.pausedAt = now;
            }
            try {
                await update(ref(db, 'work_orders/' + id), changes);
                await writeAuditLog({ action: 'status', entity: 'work_order', entityId: id, description: `Status alterado para ${newStatus}.`, metadata: { status: newStatus } });
                window.nexusToast?.('success', 'Status da O.S. atualizado.');
            } catch (error) {
                window.nexusToast?.('error', 'Não foi possível atualizar o status.');
            }
        };

        window.completeOs = (id) => {
            onValue(ref(db, 'work_orders/' + id), (snapshot) => {
                const order = snapshot.val();
                if (!order) return window.nexusToast?.('error', 'O.S. não encontrada.');
                if (!canOperateOrder(order)) return window.nexusToast?.('error', 'Seu perfil não pode concluir esta O.S.');
                Swal.fire({
                    title: 'Concluir e aprovar O.S.?',
                    html: `<p class="text-sm opacity-80 mb-3">A confirmação ficará registrada com usuário, data e observação.</p><textarea id="completion-note" class="swal2-textarea" maxlength="300" placeholder="Serviço realizado, testes e observações finais"></textarea>`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Confirmar conclusão',
                    cancelButtonText: 'Cancelar',
                    ...getSwalTheme(),
                    preConfirm: () => {
                        const note = document.getElementById('completion-note').value.trim();
                        if (note.length < 5) { Swal.showValidationMessage('Informe uma observação final com pelo menos 5 caracteres.'); return false; }
                        return note;
                    }
                }).then(async (result) => {
                    if (!result.isConfirmed) return;
                    const approvedAt = Date.now();
                    const accumulatedMs = elapsedMs(order, approvedAt);
                    try {
                        await update(ref(db, 'work_orders/' + id), {
                            status: 'done',
                            completionNote: result.value,
                            completedAt: approvedAt,
                            approvedAt,
                            approvedBy: currentUserInfo.name,
                            approvedByUid: currentUserInfo.uid,
                            accumulatedMs,
                            actualHours: Number((accumulatedMs / 3600000).toFixed(2)),
                            timerStartedAt: null,
                            updatedAt: approvedAt,
                            lastUpdatedBy: currentUserInfo.name
                        });
                        await writeAuditLog({ action: 'approve', entity: 'work_order', entityId: id, description: `O.S. ${order.title || id} concluída e aprovada.`, metadata: { approvedAt, dueAt: order.dueAt || defaultDueAt(order.priority, order.createdAt) } });
                        window.nexusToast?.('success', 'O.S. concluída com aprovação registrada.');
                    } catch (error) {
                        window.nexusToast?.('error', 'Não foi possível concluir a O.S.');
                    }
                });
            }, { onlyOnce: true });
        };

        window.deleteOs = (id) => {
            if (!isAdmin()) return window.nexusToast?.('error', 'Somente o Administrador pode excluir O.S.');
            Swal.fire({ title: 'Excluir O.S.?', text: "Este registro será apagado.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim', cancelButtonText: 'Cancelar', ...getSwalTheme() })
            .then(async (r) => {
                if(r.isConfirmed) {
                    try {
                        await remove(ref(db, 'work_orders/' + id));
                        await writeAuditLog({ action: 'delete', entity: 'work_order', entityId: id, description: 'O.S. removida.' });
                        window.nexusToast?.('warning', 'O.S. removida.');
                    } catch (error) {
                        window.nexusToast?.('error', 'Não foi possível remover a O.S.');
                    }
                }
            });
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
