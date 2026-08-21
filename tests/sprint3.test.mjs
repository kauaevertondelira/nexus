import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const pages = ['planejamento', 'preventiva', 'solicitacoes', 'tecnico', 'os-detalhes'];

for (const page of pages) {
    const html = read(`public/pages/${page}.html`);
    assert.ok(html.includes('nexus-auth-pending'), `${page}: bloqueio visual ausente.`);
    assert.ok(html.includes('../assets/js/auth-gate.js'), `${page}: auth-gate ausente.`);
    assert.ok(html.includes('../assets/css/sprint3.css'), `${page}: visual do Sprint 3 ausente.`);
    assert.ok(html.includes(`../assets/js/${page}.js`), `${page}: módulo funcional ausente.`);
    assert.ok(html.includes('../assets/js/ui-enhancements.js'), `${page}: recursos compartilhados ausentes.`);
}

const core = read('public/assets/js/maintenance-core.js');
for (const marker of ['mountMaintenanceShell', 'startProtectedPage', 'getAllowedPages(profile)', 'revealProtectedPage()', 'MAINTENANCE_LINKS']) {
    assert.ok(core.includes(marker), `Núcleo do Sprint 3 incompleto: ${marker}`);
}

const planning = read('public/assets/js/planejamento.js');
for (const marker of ['week-calendar', 'scheduledStart', 'assignedToUid', "action: 'schedule'"]) assert.ok(planning.includes(marker), `Planejamento incompleto: ${marker}`);
const preventive = read('public/assets/js/preventiva.js');
for (const marker of ['maintenance_plans', 'frequencyDays', 'checklistTemplate', 'lastGeneratedFor', 'planCycleDueAt']) assert.ok(preventive.includes(marker), `Preventiva incompleta: ${marker}`);
const requests = read('public/assets/js/solicitacoes.js');
for (const marker of ['maintenance_requests', 'convertToOrder', 'convertedWorkOrderId', 'decisionReason']) assert.ok(requests.includes(marker), `Solicitações incompletas: ${marker}`);
const technician = read('public/assets/js/tecnico.js');
for (const marker of ['elapsedMs', 'timerStartedAt', 'accumulatedMs', 'claimOrder', 'pauseOrder']) assert.ok(technician.includes(marker), `Espaço do Técnico incompleto: ${marker}`);
const detail = read('public/assets/js/os-detalhes.js');
for (const marker of ['work_order_checklists', 'work_order_time_entries', 'work_order_parts', 'work_order_comments', 'work_order_activity', 'completionNote']) assert.ok(detail.includes(marker), `O.S. 360° incompleta: ${marker}`);

const firebase = read('public/assets/js/firebase.js');
for (const page of ['os-detalhes', 'planejamento', 'preventiva', 'solicitacoes', 'tecnico']) assert.ok(firebase.includes(`"${page}"`), `Permissão ausente: ${page}`);

const rules = JSON.parse(read('database.rules.json')).rules;
for (const node of ['maintenance_plans', 'maintenance_requests', 'work_order_checklists', 'work_order_time_entries', 'work_order_parts', 'work_order_comments', 'work_order_activity']) assert.ok(rules[node], `Regra Firebase ausente: ${node}`);

const os = read('public/assets/js/os.js');
assert.ok(os.includes('os-detalhes.html?id='), 'Kanban não abre a O.S. 360°.');
const serviceWorker = read('service-worker.js');
assert.match(serviceWorker, /nexus-shell-v\d+/, 'Cache da aplicação não foi versionado.');

console.log('OK: cinco telas do Sprint 3, fluxos, permissões, regras e integrações verificados.');
