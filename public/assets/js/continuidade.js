import {
    db, ref, onValue, get, push, set, update, writeAuditLog, escapeHtml, entries,
    mountMaintenanceShell, startProtectedPage, formatDateTime, toast, setButtonBusy
} from './maintenance-core.js';
import { downloadFile } from './security-utils.js';

const BACKUP_NODES = Object.freeze([
    'users', 'assets', 'inventory', 'work_orders', 'maintenance_plans',
    'maintenance_requests', 'work_order_checklists', 'work_order_time_entries',
    'work_order_parts', 'work_order_comments', 'work_order_activity', 'audit_logs',
    'iot_device_config', 'asset_documents', 'inspection_routes', 'inspection_executions', 'inspection_results',
    'suppliers', 'purchase_requests', 'supplier_contracts', 'asset_warranties'
]);

mountMaintenanceShell({
    pageId: 'continuidade',
    title: 'Continuidade e Recuperação',
    subtitle: 'Saúde dos dados, backups verificáveis e restauração administrativa',
    content: `
        <div class="s3-page">
            <div class="s4-notice" data-tone="warning"><i class="fas fa-shield-halved mt-1 text-amber-500" aria-hidden="true"></i><div><strong>Área exclusiva do Administrador</strong><p class="mt-1 text-xs">A restauração exige arquivo válido, seleção explícita dos módulos e confirmação digitada. Faça o primeiro teste em um projeto Firebase separado.</p></div></div>
            <div class="s3-grid s3-grid--kpi mt-4">
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Módulos monitorados</span><strong id="kpi-modules" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-database" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Registros principais</span><strong id="kpi-records" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-list" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Último backup</span><strong id="kpi-backup" class="s3-kpi__value text-base">Nunca</strong></div><span class="s3-kpi__icon"><i class="fas fa-clock-rotate-left" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Integridade</span><strong id="kpi-health" class="s3-kpi__value text-base">Verificando</strong></div><span class="s3-kpi__icon"><i class="fas fa-heart-pulse" aria-hidden="true"></i></span></article>
            </div>
            <div class="s3-grid s3-grid--2">
                <section class="s3-card">
                    <div class="s3-card__head"><div><h3>Criar backup</h3><p>Exportação JSON dos dados selecionados.</p></div><span class="s3-badge s3-badge--blue">Nexus Backup v1</span></div>
                    <form id="backup-form" class="s3-card__body">
                        <fieldset><legend class="font-bold mb-3">Conteúdo do arquivo</legend><div id="backup-node-list" class="s3-grid s3-grid--2"></div></fieldset>
                        <div class="s3-actions mt-4"><button id="create-backup" type="submit" class="s3-btn s3-btn--primary"><i class="fas fa-download" aria-hidden="true"></i>Gerar e baixar backup</button><button id="select-all" type="button" class="s3-btn">Selecionar tudo</button></div>
                    </form>
                </section>
                <section class="s3-card">
                    <div class="s3-card__head"><div><h3>Restaurar backup</h3><p>O arquivo é validado localmente antes de qualquer alteração.</p></div></div>
                    <div class="s3-card__body space-y-4">
                        <label class="s4-dropzone" for="restore-file"><span><i class="fas fa-file-arrow-up text-3xl text-blue-500" aria-hidden="true"></i><strong class="block mt-3">Selecionar arquivo .json</strong><small class="block mt-1">Máximo de 5 MB · formato Nexus Backup v1</small></span><input id="restore-file" type="file" accept="application/json,.json" hidden></label>
                        <div id="restore-preview" hidden><div id="restore-summary" class="s4-code"></div><div class="s3-field mt-3"><label for="restore-confirmation">Digite RESTAURAR para confirmar</label><input id="restore-confirmation" autocomplete="off" placeholder="RESTAURAR"></div><div class="s3-actions mt-3"><button id="restore-backup" type="button" class="s3-btn s3-btn--danger"><i class="fas fa-rotate-left" aria-hidden="true"></i>Substituir módulos selecionados</button><button id="cancel-restore" type="button" class="s3-btn">Cancelar</button></div></div>
                    </div>
                </section>
            </div>
            <section class="s3-card mt-4">
                <div class="s3-card__head"><div><h3>Saúde dos módulos</h3><p>Contagem atual e disponibilidade de leitura.</p></div><button id="refresh-health" type="button" class="s3-btn s3-btn--sm"><i class="fas fa-rotate" aria-hidden="true"></i>Atualizar</button></div>
                <div id="health-list" class="s3-card__body" aria-live="polite"></div>
            </section>
            <section class="s3-card mt-4">
                <div class="s3-card__head"><div><h3>Histórico de backups</h3><p>Registro das exportações e restaurações executadas.</p></div></div>
                <div class="overflow-x-auto"><table class="s3-table"><thead><tr><th>Data</th><th>Ação</th><th>Responsável</th><th>Módulos</th><th>Resultado</th></tr></thead><tbody id="backup-history"></tbody></table></div>
            </section>
        </div>`
});

let context;
let selectedBackup;
let backupJobs = {};
let health = {};

const NODE_LABELS = {
    users: 'Perfis de usuários', assets: 'Ativos', inventory: 'Estoque MRO', work_orders: 'Ordens de serviço',
    maintenance_plans: 'Planos preventivos', maintenance_requests: 'Solicitações', work_order_checklists: 'Checklists',
    work_order_time_entries: 'Apontamentos', work_order_parts: 'Materiais de O.S.', work_order_comments: 'Comentários',
    work_order_activity: 'Histórico de O.S.', audit_logs: 'Auditoria', iot_device_config: 'Configuração IoT',
    asset_documents: 'Documentos dos ativos', inspection_routes: 'Rotas de inspeção', inspection_executions: 'Execuções de inspeção', inspection_results: 'Resultados de inspeção',
    suppliers: 'Fornecedores', purchase_requests: 'Requisições de compra', supplier_contracts: 'Contratos', asset_warranties: 'Garantias de ativos'
};

function countRecords(value) {
    return value && typeof value === 'object' ? Object.keys(value).length : 0;
}

function selectedNodes() {
    return Array.from(document.querySelectorAll('[data-backup-node]:checked')).map((input) => input.value);
}

function renderNodeSelection() {
    const defaults = new Set(['users', 'assets', 'inventory', 'work_orders', 'maintenance_plans', 'maintenance_requests', 'audit_logs', 'iot_device_config']);
    document.getElementById('backup-node-list').innerHTML = BACKUP_NODES.map((node) => `<label class="s3-list-item flex items-start gap-3"><input type="checkbox" data-backup-node value="${node}" ${defaults.has(node) ? 'checked' : ''}><span><strong>${escapeHtml(NODE_LABELS[node])}</strong><small class="block mt-1 text-slate-500">Nó: ${node}</small></span></label>`).join('');
}

function renderHealth() {
    const modules = Object.keys(health);
    const total = Object.values(health).reduce((sum, item) => sum + Number(item.count || 0), 0);
    const failed = Object.values(health).filter((item) => item.ok === false).length;
    document.getElementById('kpi-modules').textContent = modules.length;
    document.getElementById('kpi-records').textContent = total.toLocaleString('pt-BR');
    document.getElementById('kpi-health').textContent = failed ? `${failed} falha${failed === 1 ? '' : 's'}` : 'Saudável';
    document.getElementById('health-list').innerHTML = modules.map((node) => {
        const item = health[node];
        return `<div class="s4-health-row"><strong>${escapeHtml(NODE_LABELS[node] || node)}</strong><span>${Number(item.count || 0).toLocaleString('pt-BR')} registros</span><span>${item.ok ? '<span class="s3-badge s3-badge--green">Leitura OK</span>' : '<span class="s3-badge s3-badge--red">Falha</span>'}</span><small class="text-slate-500">${formatDateTime(item.checkedAt)}</small></div>`;
    }).join('') || '<div class="s3-empty">Aguardando verificação.</div>';
}

async function refreshHealth() {
    const button = document.getElementById('refresh-health');
    setButtonBusy(button, true, 'Verificando...');
    const result = {};
    await Promise.all(BACKUP_NODES.map(async (node) => {
        try {
            const snapshot = await get(ref(db, node));
            result[node] = { ok: true, count: countRecords(snapshot.val()), checkedAt: Date.now() };
        } catch (error) {
            console.warn(`Falha ao verificar ${node}.`, error);
            result[node] = { ok: false, count: 0, checkedAt: Date.now() };
        }
    }));
    health = result;
    renderHealth();
    setButtonBusy(button, false);
}

function renderJobs() {
    const rows = entries(backupJobs).sort((a, b) => Number(b[1].createdAt || 0) - Number(a[1].createdAt || 0)).slice(0, 30);
    const latestExport = rows.find(([, job]) => job.action === 'export' && job.status === 'success');
    document.getElementById('kpi-backup').textContent = latestExport ? formatDateTime(latestExport[1].createdAt) : 'Nunca';
    document.getElementById('backup-history').innerHTML = rows.map(([, job]) => `<tr><td>${formatDateTime(job.createdAt)}</td><td>${job.action === 'restore' ? 'Restauração' : 'Exportação'}</td><td>${escapeHtml(job.userName || 'Administrador')}</td><td>${Array.isArray(job.nodes) ? job.nodes.length : 0}</td><td><span class="s3-badge ${job.status === 'success' ? 's3-badge--green' : 's3-badge--red'}">${job.status === 'success' ? 'Concluído' : 'Falhou'}</span></td></tr>`).join('') || '<tr><td colspan="5"><div class="s3-empty">Nenhum backup registrado.</div></td></tr>';
}

async function recordJob(action, nodes, status, metadata = {}) {
    await push(ref(db, 'backup_jobs'), {
        action, nodes, status, metadata,
        createdAt: Date.now(),
        userUid: context.user.uid,
        userName: context.profile.name || context.user.email || 'Administrador'
    });
}

document.getElementById('select-all').addEventListener('click', () => {
    const inputs = Array.from(document.querySelectorAll('[data-backup-node]'));
    const shouldSelect = inputs.some((input) => !input.checked);
    inputs.forEach((input) => { input.checked = shouldSelect; });
});

document.getElementById('backup-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const nodes = selectedNodes();
    if (!nodes.length) return toast('warning', 'Selecione pelo menos um módulo.');
    const button = document.getElementById('create-backup');
    setButtonBusy(button, true, 'Gerando...');
    try {
        const data = {};
        for (const node of nodes) {
            const snapshot = await get(ref(db, node));
            data[node] = snapshot.val() ?? null;
        }
        const exportedAt = Date.now();
        const backup = {
            format: 'nexus-backup-v1',
            exportedAt,
            project: 'nexus-iot-senai',
            generatedByUid: context.user.uid,
            nodes,
            counts: Object.fromEntries(nodes.map((node) => [node, countRecords(data[node])])),
            data
        };
        const date = new Date(exportedAt).toISOString().replace(/[:.]/g, '-');
        downloadFile(JSON.stringify(backup, null, 2), `nexus-backup-${date}.json`, 'application/json;charset=utf-8');
        await recordJob('export', nodes, 'success', { counts: backup.counts, bytes: JSON.stringify(backup).length });
        await writeAuditLog({ action: 'export', entity: 'backup', description: `Backup exportado com ${nodes.length} módulos.`, metadata: { nodes } });
        toast('success', 'Backup gerado e baixado. Guarde o arquivo em local protegido.');
    } catch (error) {
        console.error(error);
        await recordJob('export', nodes, 'failed', { message: String(error.message || error).slice(0, 180) }).catch(() => {});
        toast('error', 'Não foi possível gerar o backup.');
    } finally {
        setButtonBusy(button, false);
    }
});

function validateBackup(value) {
    if (!value || value.format !== 'nexus-backup-v1' || !Array.isArray(value.nodes) || !value.data || typeof value.data !== 'object') throw new Error('Formato de backup não reconhecido.');
    const nodes = value.nodes.filter((node) => BACKUP_NODES.includes(node) && Object.prototype.hasOwnProperty.call(value.data, node));
    if (!nodes.length) throw new Error('O arquivo não contém módulos restauráveis.');
    if (nodes.includes('users')) {
        const selfProfile = value.data.users?.[context.user.uid];
        if (!selfProfile || selfProfile.role !== 'Administrador') throw new Error('O backup não preserva sua conta como Administrador.');
    }
    return { ...value, nodes };
}

document.getElementById('restore-file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('error', 'O arquivo excede o limite de 5 MB.');
    try {
        selectedBackup = validateBackup(JSON.parse(await file.text()));
        document.getElementById('restore-summary').textContent = [
            `Arquivo: ${file.name}`,
            `Exportado em: ${formatDateTime(selectedBackup.exportedAt)}`,
            `Projeto: ${selectedBackup.project || 'não informado'}`,
            '',
            ...selectedBackup.nodes.map((node) => `${NODE_LABELS[node]}: ${countRecords(selectedBackup.data[node])} registros`)
        ].join('\n');
        document.getElementById('restore-preview').hidden = false;
        document.getElementById('restore-confirmation').value = '';
        toast('success', 'Arquivo validado. Confira o resumo antes de restaurar.');
    } catch (error) {
        selectedBackup = undefined;
        document.getElementById('restore-preview').hidden = true;
        toast('error', error.message || 'Arquivo inválido.');
    }
});

document.getElementById('cancel-restore').addEventListener('click', () => {
    selectedBackup = undefined;
    document.getElementById('restore-preview').hidden = true;
    document.getElementById('restore-file').value = '';
});

document.getElementById('restore-backup').addEventListener('click', async () => {
    if (!selectedBackup) return;
    if (document.getElementById('restore-confirmation').value.trim() !== 'RESTAURAR') return toast('warning', 'Digite RESTAURAR exatamente como mostrado.');
    if (!window.confirm(`Substituir ${selectedBackup.nodes.length} módulos pelos dados do backup?`)) return;
    const button = document.getElementById('restore-backup');
    setButtonBusy(button, true, 'Restaurando...');
    try {
        const updates = {};
        selectedBackup.nodes.forEach((node) => { updates[node] = selectedBackup.data[node] ?? null; });
        await update(ref(db), updates);
        await recordJob('restore', selectedBackup.nodes, 'success', { sourceExportedAt: selectedBackup.exportedAt });
        await writeAuditLog({ action: 'restore', entity: 'backup', description: `Backup restaurado em ${selectedBackup.nodes.length} módulos.`, metadata: { nodes: selectedBackup.nodes, sourceExportedAt: selectedBackup.exportedAt } });
        toast('success', 'Restauração concluída. Os módulos foram atualizados em uma única operação.');
        selectedBackup = undefined;
        document.getElementById('restore-preview').hidden = true;
        document.getElementById('restore-file').value = '';
        await refreshHealth();
    } catch (error) {
        console.error(error);
        await recordJob('restore', selectedBackup.nodes, 'failed', { message: String(error.message || error).slice(0, 180) }).catch(() => {});
        toast('error', 'A restauração foi recusada. Nenhuma operação parcial deve ser considerada válida.');
    } finally {
        setButtonBusy(button, false);
    }
});

document.getElementById('refresh-health').addEventListener('click', refreshHealth);

startProtectedPage('continuidade', (pageContext) => {
    context = pageContext;
    renderNodeSelection();
    onValue(ref(db, 'backup_jobs'), (snapshot) => { backupJobs = snapshot.val() || {}; renderJobs(); });
    refreshHealth();
});
