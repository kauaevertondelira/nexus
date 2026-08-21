import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const pages = ['ativo-detalhes', 'inspecoes', 'confiabilidade'];

for (const page of pages) {
    const html = read(`public/pages/${page}.html`);
    assert.ok(html.includes('nexus-auth-pending'), `${page}: bloqueio visual ausente.`);
    assert.ok(html.includes('../assets/js/auth-gate.js'), `${page}: auth-gate ausente.`);
    assert.ok(html.includes('../assets/css/sprint3.css'), `${page}: identidade visual ausente.`);
    assert.ok(html.includes(`../assets/js/${page}.js`), `${page}: módulo funcional ausente.`);
    assert.ok(html.includes('../assets/js/ui-enhancements.js'), `${page}: recursos compartilhados ausentes.`);
}

const asset = read('public/assets/js/ativo-detalhes.js');
for (const marker of ['asset_documents', 'inspection_results', 'telemetry/history', 'criticality', 'maintenanceStrategy', 'targetAvailability', 'health()', 'stats()']) assert.ok(asset.includes(marker), `Ativo 360° incompleto: ${marker}`);
assert.ok(asset.includes('os.html?acao=nova_os&maquina='), 'Ativo 360° não inicia O.S. com o equipamento preenchido.');
const assets = read('public/assets/js/ativos.js');
assert.ok(assets.includes('ativo-detalhes.html?id='), 'Parque de Ativos não abre o Ativo 360°.');
assert.ok(assets.includes("new URL('ativo-detalhes.html'"), 'QR Code não aponta para o Ativo 360°.');

const inspections = read('public/assets/js/inspecoes.js');
for (const marker of ['inspection_routes', 'inspection_executions', 'inspection_results', 'maintenance_requests', 'data-result-status', 'nextDueAt', "source: 'inspection'"]) assert.ok(inspections.includes(marker), `Inspeções incompletas: ${marker}`);

const reliability = read('public/assets/js/confiabilidade.js');
for (const marker of ['mtbf', 'mttr', 'availability', 'failure-pareto', 'preventive-progress', 'inspection-progress', 'sla-progress', 'reliability-export']) assert.ok(reliability.includes(marker), `Confiabilidade incompleta: ${marker}`);

const firebase = read('public/assets/js/firebase.js');
for (const page of ['ativo-detalhes', 'inspecoes', 'confiabilidade']) assert.ok(firebase.includes(`"${page}"`), `Permissão ausente: ${page}`);
const rules = JSON.parse(read('database.rules.json')).rules;
for (const node of ['asset_documents', 'inspection_routes', 'inspection_executions', 'inspection_results']) assert.ok(rules[node], `Regra Firebase ausente: ${node}`);

const serviceWorker = read('service-worker.js');
assert.match(serviceWorker, /nexus-shell-v\d+/, 'Cache do Sprint 5 não foi versionado.');
for (const page of pages) assert.ok(serviceWorker.includes(`./public/pages/${page}.html`), `Cache ausente: ${page}`);
const knowledge = JSON.parse(read('public/assets/data/assistant-knowledge.json'));
for (const id of ['asset-360', 'digital-inspections', 'reliability-center']) assert.ok(knowledge.entries.some((entry) => entry.id === id), `Assistente sem conhecimento: ${id}`);

console.log('OK: Sprint 5 com Ativo 360°, inspeções digitais, confiabilidade, regras e integrações.');
