import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const assets = read('public/assets/js/ativos.js');
const orders = read('public/assets/js/os.js');
const inventory = read('public/assets/js/estoque.js');
const consumption = read('public/assets/js/mapa-consumo.js');
const finance = read('public/assets/js/financeiro.js');
const menu = read('public/assets/js/menu.js');
const rules = JSON.parse(read('database.rules.json'));

for (const marker of ['calculateAssetRisk', 'showAssetQr', 'new window.QRCode', 'data-asset-id']) {
    assert.ok(assets.includes(marker), `Ativos: recurso ausente (${marker}).`);
}
for (const marker of ['SLA_HOURS', 'defaultDueAt', 'kpi-overdue', 'completeOs', 'approvedByUid', "action: 'approve'"]) {
    assert.ok(orders.includes(marker), `O.S.: recurso ausente (${marker}).`);
}
for (const marker of ['monthlyUse', 'coverageDays', 'kpi-forecast', 'delta: amount']) {
    assert.ok(inventory.includes(marker), `Estoque: recurso ausente (${marker}).`);
}
for (const marker of ['renderEfficiencyInsights', 'kpi-energy-alerts', 'kpi-energy-potential', 'percentAbove >= 25']) {
    assert.ok(consumption.includes(marker), `Consumo: recurso ausente (${marker}).`);
}
assert.ok(finance.includes("approve: { icon: 'fa-user-check'"), 'Financeiro: aprovação não aparece na auditoria.');
for (const marker of ['systemNotifications.orders', 'inventory-forecast:', 'SLA vencido']) {
    assert.ok(menu.includes(marker), `Visão Global: alerta inteligente ausente (${marker}).`);
}
assert.ok(rules.rules.inventory.$id.monthlyUse, 'Regras: validação de consumo médio ausente.');
assert.ok(rules.rules.work_orders.$id.dueAt, 'Regras: validação de SLA ausente.');
assert.ok(rules.rules.work_orders.$id.completionNote, 'Regras: validação da aprovação ausente.');

const knowledge = JSON.parse(read('public/assets/data/assistant-knowledge.json'));
for (const id of ['sla', 'predictive-rules', 'inventory-forecast', 'energy-efficiency']) {
    assert.ok(knowledge.entries.some((entry) => entry.id === id), `Assistente: conhecimento ausente (${id}).`);
}

console.log('OK: risco preventivo, QR, SLA, aprovação, previsão de estoque e eficiência energética.');
