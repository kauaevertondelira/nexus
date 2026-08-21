import { auth, db, getAllowedPages, applyAllowedMenu, revealProtectedPage, ROLE_PERMISSIONS, writeAuditLog } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { onValue, ref, update } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { downloadFile, escapeHtml, formatCurrency, monthKey, nonNegative, periodStart } from './security-utils.js';

let assets = {};
let workOrders = {};
let auditLogs = {};
let users = {};
let currentUserUid = '';
let financeDataStarted = false;
let chartBar;
let chartDoughnut;

function showRestricted(data) {
    document.body.innerHTML = `<div style="min-height:100vh;background:#1d2b40;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;gap:16px;padding:32px;font-family:sans-serif"><div style="font-size:36px">🔒</div><h1>Acesso Restrito</h1><p>O cargo ${escapeHtml(data.role)} não possui acesso ao Financeiro.</p><a href="menu.html" style="padding:12px 24px;background:#3b82f6;border-radius:12px;color:white;text-decoration:none">Voltar ao Painel</a></div>`;
    revealProtectedPage();
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace('login.html?return=financeiro.html');
        return;
    }
    onValue(ref(db, `users/${user.uid}`), (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            showRestricted({ role: 'sem perfil autorizado' });
            return;
        }
        if (!getAllowedPages(data).includes('financeiro')) {
            showRestricted(data);
            return;
        }
        currentUserUid = user.uid;
        applyAllowedMenu(data);
        document.getElementById('user-name').textContent = data.name || user.email || 'Administrador';
        document.getElementById('user-role').textContent = data.role || '';
        if (data.photoURL) document.getElementById('user-photo').style.backgroundImage = `url(${data.photoURL})`;
        else document.getElementById('user-photo').innerHTML = '<i class="fas fa-user"></i>';
        startFinanceData();
        revealProtectedPage();
    }, () => showRestricted({ role: 'não verificado' }));
});

function filteredOrders() {
    const start = periodStart(document.getElementById('report-period').value);
    const asset = document.getElementById('report-asset').value;
    const area = document.getElementById('report-area').value;
    return Object.entries(workOrders).filter(([, order]) => {
        const inPeriod = nonNegative(order.createdAt) >= start;
        const matchesAsset = asset === 'all' || order.assetId === asset;
        const matchesArea = area === 'all' || assets[order.assetId]?.area === area;
        return inPeriod && matchesAsset && matchesArea;
    });
}

function orderCost(order) {
    return nonNegative(order.estimatedCost);
}

function downtimeCost(order) {
    return nonNegative(order.downtimeCost, nonNegative(order.downtimeHours) * 150);
}

function assetLabel(id, order = {}) {
    return assets[id]?.name || order.assetName || 'Sem ativo vinculado';
}

function updateAssetFilter() {
    const select = document.getElementById('report-asset');
    const selected = select.value;
    select.innerHTML = '<option value="all">Todos os ativos</option>' + Object.entries(assets)
        .map(([id, asset]) => `<option value="${escapeHtml(id)}">${escapeHtml(asset.name || id)}</option>`)
        .join('');
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

function lastSixMonths() {
    const months = [];
    const now = new Date();
    for (let offset = 5; offset >= 0; offset--) {
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        months.push({ key: monthKey(date.getTime()), label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') });
    }
    return months;
}

function renderFinancial() {
    const orders = filteredOrders();
    const maintenance = orders.reduce((sum, [, order]) => sum + orderCost(order), 0);
    const downtime = orders.reduce((sum, [, order]) => sum + downtimeCost(order), 0);
    const done = orders.filter(([, order]) => order.status === 'done').length;
    document.getElementById('kpi-maintenance').textContent = formatCurrency(maintenance);
    document.getElementById('kpi-downtime').textContent = formatCurrency(downtime);
    document.getElementById('kpi-os-done').textContent = String(done);

    const urgent = orders.filter(([, order]) => ['urgent', 'danger'].includes(order.priority)).length;
    chartDoughnut.data.datasets[0].data = [urgent, Math.max(0, orders.length - urgent)];
    chartDoughnut.update();

    const months = lastSixMonths();
    chartBar.data.labels = months.map((month) => month.label);
    chartBar.data.datasets[0].data = months.map((month) => orders.reduce((sum, [, order]) => monthKey(order.createdAt) === month.key ? sum + downtimeCost(order) : sum, 0));
    chartBar.data.datasets[1].data = months.map((month) => orders.reduce((sum, [, order]) => monthKey(order.createdAt) === month.key ? sum + orderCost(order) : sum, 0));
    chartBar.update();

    const grouped = {};
    orders.forEach(([, order]) => {
        const key = order.assetId || 'unlinked';
        grouped[key] ||= { name: assetLabel(key, order), count: 0, cost: 0 };
        grouped[key].count++;
        grouped[key].cost += orderCost(order);
    });
    const rows = Object.entries(grouped).sort((a, b) => b[1].cost - a[1].cost);
    document.getElementById('cost-table').innerHTML = rows.length ? rows.map(([id, item]) => `<tr class="table-row-hover text-slate-700 dark:text-slate-300"><td class="py-3 font-medium">${escapeHtml(item.name)}<span class="text-xs text-slate-500 block">${escapeHtml(id === 'unlinked' ? 'Sem vínculo' : id.slice(-10))}</span></td><td class="py-3 text-center">${item.count}</td><td class="py-3 text-right font-bold">${formatCurrency(item.cost)}</td></tr>`).join('') : '<tr><td colspan="3" class="py-6 text-center text-slate-400">Nenhuma O.S. encontrada neste filtro.</td></tr>';
}

function renderAudit() {
    const events = Object.entries(auditLogs).sort((a, b) => nonNegative(b[1].createdAt) - nonNegative(a[1].createdAt)).slice(0, 40);
    const container = document.getElementById('audit-history');
    if (!events.length) {
        container.innerHTML = '<div class="nexus-empty-state"><i class="fas fa-clock-rotate-left"></i><strong>Nenhuma alteração registrada</strong><span>Novas mudanças aparecerão aqui.</span></div>';
        return;
    }
    container.innerHTML = events.map(([, event]) => {
        const date = event.createdAt ? new Date(event.createdAt).toLocaleString('pt-BR') : 'Processando data';
        const actionView = {
            login: { icon: 'fa-right-to-bracket', color: 'text-blue-500 bg-blue-500/10', label: 'Login' },
            logout: { icon: 'fa-right-from-bracket', color: 'text-slate-500 bg-slate-500/10', label: 'Logout' },
            register: { icon: 'fa-user-plus', color: 'text-emerald-500 bg-emerald-500/10', label: 'Cadastro' },
            role: { icon: 'fa-user-shield', color: 'text-purple-500 bg-purple-500/10', label: 'Permissão' },
            approve: { icon: 'fa-user-check', color: 'text-green-500 bg-green-500/10', label: 'Aprovação' }
        }[event.action] || { icon: 'fa-pen-to-square', color: 'text-green-500 bg-green-500/10', label: event.entity || 'Alteração' };
        return `<div class="flex items-start gap-3 rounded-xl border border-slate-100 dark:border-dark-700 p-3"><div class="h-8 w-8 rounded-lg ${actionView.color} flex items-center justify-center shrink-0"><i class="fas ${actionView.icon}"></i></div><div class="min-w-0 flex-1"><p class="text-xs font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(event.description || event.action || 'Alteração')}</p><p class="text-[10px] text-slate-400 mt-1">${escapeHtml(event.createdByEmail || 'Usuário')} · ${escapeHtml(date)}</p></div><span class="text-[10px] uppercase text-slate-400">${escapeHtml(actionView.label)}</span></div>`;
    }).join('');
}

function renderUsers() {
    const container = document.getElementById('user-admin-list');
    const entries = Object.entries(users).sort(([, a], [, b]) => (a.name || a.email || '').localeCompare(b.name || b.email || '', 'pt-BR'));
    if (!entries.length) {
        container.innerHTML = '<div class="nexus-empty-state"><i class="fas fa-users"></i><strong>Nenhum usuário encontrado</strong><span>As contas cadastradas aparecerão aqui.</span></div>';
        return;
    }

    container.innerHTML = entries.map(([uid, profile]) => {
        const isCurrent = uid === currentUserUid;
        const options = Object.keys(ROLE_PERMISSIONS).map((role) => `<option value="${escapeHtml(role)}" ${profile.role === role ? 'selected' : ''}>${escapeHtml(role)}</option>`).join('');
        return `<div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px_130px] gap-3 items-center rounded-xl border border-slate-100 dark:border-dark-700 p-4" data-user-row="${escapeHtml(uid)}">
            <div class="min-w-0 flex items-center gap-3">
                <div class="h-10 w-10 shrink-0 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center"><i class="fas fa-user"></i></div>
                <div class="min-w-0"><p class="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">${escapeHtml(profile.name || 'Usuário sem nome')}</p><p class="text-xs text-slate-400 truncate">${escapeHtml(profile.email || uid)}</p></div>
            </div>
            <select data-role-select aria-label="Cargo de ${escapeHtml(profile.name || profile.email || 'usuário')}" ${isCurrent ? 'disabled' : ''} class="w-full bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-xl px-3 py-2.5 text-xs disabled:opacity-60">${options}</select>
            <button type="button" data-save-role ${isCurrent ? 'disabled' : ''} class="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition disabled:bg-slate-400 disabled:cursor-not-allowed">${isCurrent ? 'Conta atual' : 'Autorizar'}</button>
        </div>`;
    }).join('');
}

document.getElementById('user-admin-list').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-save-role]');
    if (!button || button.disabled) return;
    const row = button.closest('[data-user-row]');
    const uid = row?.dataset.userRow;
    const role = row?.querySelector('[data-role-select]')?.value;
    const profile = users[uid];
    if (!uid || !profile || !ROLE_PERMISSIONS[role]) return;
    if (profile.role === role) {
        window.nexusToast?.('info', 'Esse usuário já possui este cargo.');
        return;
    }

    const result = await Swal.fire({
        title: 'Alterar autorização?',
        text: `${profile.name || profile.email || 'Usuário'} passará de ${profile.role || 'sem cargo'} para ${role}.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Confirmar alteração',
        cancelButtonText: 'Cancelar',
        background: document.documentElement.classList.contains('dark') ? '#223249' : '#ffffff',
        color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
        confirmButtonColor: '#7c3aed'
    });
    if (!result.isConfirmed) return;

    button.disabled = true;
    try {
        await update(ref(db, `users/${uid}`), {
            role,
            allowedPages: ROLE_PERMISSIONS[role],
            updatedAt: Date.now(),
            updatedByUid: currentUserUid
        });
        await writeAuditLog({ action: 'role', entity: 'user', entityId: uid, description: `${profile.name || profile.email || 'Usuário'} recebeu o cargo ${role}.`, metadata: { previousRole: profile.role || '', role } });
        window.nexusToast?.('success', role === 'Administrador' ? 'Novo administrador autorizado.' : 'Cargo atualizado.');
    } catch (error) {
        button.disabled = false;
        window.nexusToast?.('error', 'Não foi possível alterar o cargo. Verifique as regras do Firebase.');
    }
});

const dark = document.documentElement.classList.contains('dark');
const textColor = dark ? '#94a3b8' : '#64748b';
chartBar = new Chart(document.getElementById('costChart').getContext('2d'), {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Downtime', data: [], backgroundColor: '#ef4444', borderRadius: 4 }, { label: 'Manutenção', data: [], backgroundColor: '#3b82f6', borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor } } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: (value) => `R$ ${value}` } } } }
});
chartDoughnut = new Chart(document.getElementById('distributionChart').getContext('2d'), {
    type: 'doughnut',
    data: { labels: ['Urgente / Crítica', 'Normal'], datasets: [{ data: [0, 0], backgroundColor: ['#ef4444', '#3b82f6'], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: textColor } } } }
});

function startFinanceData() {
    if (financeDataStarted) return;
    financeDataStarted = true;

    onValue(ref(db, 'assets'), (snapshot) => {
        assets = snapshot.val() || {};
        updateAssetFilter();
        renderFinancial();
    }, () => window.nexusToast?.('error', 'Falha ao carregar ativos.'));
    onValue(ref(db, 'work_orders'), (snapshot) => {
        workOrders = snapshot.val() || {};
        renderFinancial();
    }, () => window.nexusToast?.('error', 'Falha ao carregar O.S.'));
    onValue(ref(db, 'audit_logs'), (snapshot) => {
        auditLogs = snapshot.val() || {};
        renderAudit();
    }, () => document.getElementById('audit-history').innerHTML = '<p class="text-red-500">Não foi possível carregar o histórico.</p>');
    onValue(ref(db, 'users'), (snapshot) => {
        users = snapshot.val() || {};
        renderUsers();
    }, () => document.getElementById('user-admin-list').innerHTML = '<p class="text-red-500">Não foi possível carregar os usuários. Publique as regras atualizadas do Firebase.</p>');
}

document.getElementById('report-period').addEventListener('change', renderFinancial);
document.getElementById('report-asset').addEventListener('change', renderFinancial);
document.getElementById('report-area').addEventListener('change', renderFinancial);

function reportRows() {
    return [...document.querySelectorAll('#cost-table tr')].map((row) => [...row.querySelectorAll('td')].map((cell) => cell.innerText.trim())).filter((cells) => cells.length === 3);
}

function reportHtml() {
    const rows = reportRows().map((cells) => `<tr><td>${escapeHtml(cells[0])}</td><td>${escapeHtml(cells[1])}</td><td>${escapeHtml(cells[2])}</td></tr>`).join('');
    const generated = new Date().toLocaleString('pt-BR');
    const barImage = chartBar.toBase64Image();
    const doughnutImage = chartDoughnut.toBase64Image();
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Financeiro Nexus</title><style>body{font-family:Arial,sans-serif;color:#1e293b;padding:28px}h1{margin-bottom:4px}.meta{color:#64748b;font-size:12px}.kpis{display:flex;gap:12px;margin:24px 0}.kpi{flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:14px}.kpi span{display:block;color:#64748b;font-size:11px}.kpi strong{font-size:20px}.charts{display:grid;grid-template-columns:2fr 1fr;gap:16px}.charts img{width:100%;max-height:260px;object-fit:contain}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left}th:nth-child(2),td:nth-child(2){text-align:center}th:last-child,td:last-child{text-align:right}@media print{body{padding:0}}</style></head><body><h1>Nexus Industrial — Relatório Financeiro</h1><p class="meta">Gerado em ${escapeHtml(generated)} · Período: ${escapeHtml(document.getElementById('report-period').selectedOptions[0].textContent)} · Ativo: ${escapeHtml(document.getElementById('report-asset').selectedOptions[0].textContent)} · Setor: ${escapeHtml(document.getElementById('report-area').selectedOptions[0].textContent)}</p><section class="kpis"><div class="kpi"><span>Manutenção</span><strong>${escapeHtml(document.getElementById('kpi-maintenance').innerText)}</strong></div><div class="kpi"><span>Downtime</span><strong>${escapeHtml(document.getElementById('kpi-downtime').innerText)}</strong></div><div class="kpi"><span>O.S. concluídas</span><strong>${escapeHtml(document.getElementById('kpi-os-done').innerText)}</strong></div></section><section class="charts"><img src="${barImage}" alt="Custos por mês"><img src="${doughnutImage}" alt="Distribuição de O.S."></section><table><thead><tr><th>Equipamento</th><th>O.S.</th><th>Custo</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Sem dados</td></tr>'}</tbody></table><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`;
}

document.getElementById('monthly-report-pdf').addEventListener('click', () => {
    const popup = window.open('', '_blank', 'width=1100,height=800');
    if (!popup) {
        window.nexusToast?.('warning', 'Permita pop-ups para gerar o PDF.');
        return;
    }
    popup.document.write(reportHtml());
    popup.document.close();
});

document.getElementById('financial-report-excel').addEventListener('click', () => {
    const rows = reportRows().map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
    const workbook = `\uFEFF<html><head><meta charset="utf-8"></head><body><table><thead><tr><th>Equipamento</th><th>Ordens</th><th>Custo</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    downloadFile(workbook, 'Relatorio_Financeiro_Nexus.xls', 'application/vnd.ms-excel;charset=utf-8');
    window.nexusToast?.('success', 'Relatório Excel exportado.');
});

document.getElementById('theme-toggle')?.addEventListener('click', () => document.documentElement.classList.toggle('dark'));
renderFinancial();
renderAudit();
