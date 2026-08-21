import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const pages = ['fornecedores', 'compras', 'contratos', 'executivo'];

for (const page of pages) {
    const html = read(`public/pages/${page}.html`);
    assert.ok(html.includes('nexus-auth-pending'), `${page}: bloqueio visual ausente.`);
    assert.ok(html.includes('../assets/js/auth-gate.js'), `${page}: auth-gate ausente.`);
    assert.ok(html.includes('../assets/css/sprint3.css'), `${page}: identidade visual ausente.`);
    assert.ok(html.includes(`../assets/js/${page}.js`), `${page}: módulo funcional ausente.`);
    assert.ok(html.includes('../assets/js/ui-enhancements.js'), `${page}: recursos compartilhados ausentes.`);
}

const suppliers = read('public/assets/js/fornecedores.js');
for (const marker of ['suppliers', 'leadTimeDays', 'rating', 'writeAuditLog', 'supplier-filter']) assert.ok(suppliers.includes(marker), `Fornecedores incompleto: ${marker}`);
assert.ok(suppliers.includes('entityId = node.key'), 'Fornecedor novo não preserva o ID na auditoria.');

const purchases = read('public/assets/js/compras.js');
for (const marker of ['purchase_requests', 'submitted', 'approved', 'ordered', 'received', 'inventory/', 'receivedAt', 'purchase-export']) assert.ok(purchases.includes(marker), `Compras incompleto: ${marker}`);
assert.ok(purchases.includes('update(ref(db),'), 'Recebimento não usa atualização multipath para compra e estoque.');
assert.ok(purchases.includes('increment(nonNegative(item.qty))'), 'Recebimento não protege o saldo contra atualizações concorrentes.');

const contracts = read('public/assets/js/contratos.js');
for (const marker of ['supplier_contracts', 'asset_warranties', 'renewalNoticeDays', 'coverageType', 'contract-expiring']) assert.ok(contracts.includes(marker), `Contratos incompleto: ${marker}`);
assert.ok((contracts.match(/entityId = node\.key/g) || []).length >= 2, 'Contrato ou garantia nova não preserva o ID na auditoria.');

const executive = read('public/assets/js/executivo.js');
for (const marker of ['executive-availability', 'executive-maintenance-cost', 'executive-purchases', 'executive-stock-value', 'executive-cost-chart', 'executive-area-table', 'executive-export']) assert.ok(executive.includes(marker), `Painel Executivo incompleto: ${marker}`);

const firebase = read('public/assets/js/firebase.js');
for (const page of pages) assert.ok(firebase.includes(`"${page}"`), `Permissão ausente: ${page}`);
assert.match(firebase, /"Técnico de Manutenção"[^\n]+"compras"/, 'Técnico não consegue solicitar compras.');
assert.match(firebase, /"Almoxarifado \/ Suprimentos"[^\n]+"fornecedores"[^\n]+"compras"[^\n]+"contratos"/, 'Suprimentos sem acesso aos módulos do Sprint 6.');

const rules = JSON.parse(read('database.rules.json')).rules;
for (const node of ['suppliers', 'purchase_requests', 'supplier_contracts', 'asset_warranties']) assert.ok(rules[node], `Regra Firebase ausente: ${node}`);
assert.ok(String(rules.purchase_requests.$requestId['.write']).includes("data.child('status').val() === 'approved'"), 'Regra não protege transição aprovada → pedido.');
assert.ok(String(rules.supplier_contracts.$contractId['.write']).includes('Administrador'), 'Contratos não estão restritos ao Administrador.');

const asset360 = read('public/assets/js/ativo-detalhes.js');
assert.ok(asset360.includes("ref(db, 'asset_warranties')"), 'Ativo 360° não consulta garantias.');
assert.ok(asset360.includes('asset-warranties'), 'Ativo 360° não exibe garantias.');
const continuity = read('public/assets/js/continuidade.js');
for (const node of ['suppliers', 'purchase_requests', 'supplier_contracts', 'asset_warranties']) assert.ok(continuity.includes(`'${node}'`), `Backup sem ${node}.`);

const serviceWorker = read('service-worker.js');
assert.match(serviceWorker, /nexus-shell-v(?:[1-9]\d*)/, 'Cache visual do Sprint 6 não foi versionado.');
for (const page of pages) assert.ok(serviceWorker.includes(`./public/pages/${page}.html`), `Cache ausente: ${page}`);
const knowledge = JSON.parse(read('public/assets/data/assistant-knowledge.json'));
for (const id of ['suppliers', 'mro-purchases', 'contracts-warranties', 'executive-dashboard']) assert.ok(knowledge.entries.some((entry) => entry.id === id), `Assistente sem conhecimento: ${id}`);

const menuHtml = read('public/pages/menu.html');
for (const id of ['dashboard-operations', 'dash-os-progress', 'dashboard-assets-list', 'dashboard-shortcuts']) assert.ok(menuHtml.includes(`id="${id}"`), `Visão Global sem complemento: ${id}`);
const menuJs = read('public/assets/js/menu.js');
for (const marker of ['renderDashboardAssets', 'renderOrderSummary', 'chartTheme()', 'window.Chart']) assert.ok(menuJs.includes(marker), `Visão Global sem comportamento: ${marker}`);
const theme = read('public/assets/css/theme-polish.css');
for (const marker of ['--nexus-light-bg: #e9eef4', '--nexus-light-surface: #f7f9fc', '.dashboard-shortcut', '.dashboard-mini-metric']) assert.ok(theme.includes(marker), `Modo claro sem suavização: ${marker}`);
assert.ok(!read('index.html').match(/Aceder|Aceda/), 'Landing page ainda contém português de Portugal.');
assert.ok(!menuHtml.match(/Aceder|Aceda|Stock Crítico|A carregar/), 'Visão Global ainda contém termos fora do português do Brasil.');

console.log('OK: Sprint 6 com fornecedores, compras, contratos, garantias, painel executivo e integrações.');
