import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const css = read('public/assets/css/sprint3.css');
const inspections = read('public/assets/js/inspecoes.js');
const workOrders = read('public/assets/js/os.js');
const databaseRules = JSON.parse(read('database.rules.json'));
const serviceWorker = read('service-worker.js');

const contentRule = css.match(/#maintenance-content\s*\{([^}]*)\}/)?.[1] || '';
assert.match(contentRule, /min-height:\s*0/, 'Conteúdo compartilhado sem limite flexível de altura.');
assert.match(contentRule, /overflow-y:\s*auto/, 'Conteúdo compartilhado sem rolagem vertical.');
assert.match(contentRule, /overflow-x:\s*hidden/, 'Conteúdo compartilhado permite vazamento horizontal.');

for (const marker of [
    "const routeRef = push(ref(db, 'inspection_routes'))",
    'await set(routeRef, routePayload)',
    'form.reportValidity()',
    'Selecione ao menos um equipamento.',
    'Verifique as regras publicadas do banco de dados.'
]) {
    assert.ok(inspections.includes(marker), `Salvamento de rota sem proteção: ${marker}`);
}

for (const page of ['confiabilidade', 'notificacoes', 'iot', 'contratos', 'executivo', 'continuidade']) {
    const html = read(`public/pages/${page}.html`);
    const script = read(`public/assets/js/${page}.js`);
    assert.ok(html.includes('../assets/css/sprint3.css'), `${page}: folha de layout compartilhada ausente.`);
    assert.ok(script.includes('mountMaintenanceShell({'), `${page}: estrutura compartilhada ausente.`);
}

assert.ok(serviceWorker.includes("const CACHE_NAME = 'nexus-shell-v10'"), 'Cache antigo pode manter as falhas no navegador.');

for (const marker of [
    'changes.timerStartedAt = order.timerStartedAt || now',
    'changes.accumulatedMs = accumulatedMs',
    'changes.assignedToUid = order.assignedToUid || currentUserInfo.uid',
    'if (!isAdmin()) return window.nexusToast',
    "newOrderButton.style.display = canManageOrders() ? '' : 'none'"
]) {
    assert.ok(workOrders.includes(marker), `Fluxo de O.S. sem proteção: ${marker}`);
}

const workOrderWriteRule = databaseRules.rules.work_orders.$id['.write'];
assert.ok(!workOrderWriteRule.includes("role').val() === 'Almoxarifado / Suprimentos'"), 'Suprimentos ainda pode alterar O.S. diretamente.');
assert.ok(workOrderWriteRule.includes('data.exists() && newData.exists()'), 'Exclusão de O.S. por técnico não está bloqueada.');

console.log('OK: rolagem, rotas, cronômetro e permissões de O.S. protegidos contra regressão.');
