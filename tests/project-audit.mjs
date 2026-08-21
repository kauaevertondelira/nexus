import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const pagesDir = path.join(root, 'public/pages');
const scriptsDir = path.join(root, 'public/assets/js');
const htmlFiles = [path.join(root, 'index.html'), ...fs.readdirSync(pagesDir).filter((file) => file.endsWith('.html')).map((file) => path.join(pagesDir, file))];
const jsFiles = fs.readdirSync(scriptsDir).filter((file) => file.endsWith('.js')).map((file) => path.join(scriptsDir, file));
const syntaxFiles = [...jsFiles, path.join(root, 'service-worker.js'), path.join(root, 'functions/index.js')];

for (const file of syntaxFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${path.relative(root, file)}: ${result.stderr.trim()}`);
}

for (const file of htmlFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const ids = [...source.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length) failures.push(`${path.relative(root, file)}: IDs duplicados: ${duplicates.join(', ')}`);
  for (const match of source.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    const reference = match[1];
    if (/^(?:https?:|#|data:|mailto:|tel:)/i.test(reference)) continue;
    const target = path.resolve(path.dirname(file), reference.split(/[?#]/)[0]);
    if (!fs.existsSync(target)) failures.push(`${path.relative(root, file)}: referência ausente ${reference}`);
  }
}

const loginHtml = fs.readFileSync(path.join(pagesDir, 'login.html'), 'utf8');
if (/<option value="Administrador">/.test(loginHtml)) failures.push('Cadastro público ainda oferece o cargo Administrador.');
const firebaseFiles = jsFiles.filter((file) => fs.readFileSync(file, 'utf8').includes('initializeApp('));
if (firebaseFiles.length !== 1 || path.basename(firebaseFiles[0]) !== 'firebase.js') failures.push('Firebase deve ser inicializado somente em firebase.js.');
const rules = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8'));
for (const node of ['users', 'assets', 'inventory', 'work_orders', 'maintenance_plans', 'maintenance_requests', 'work_order_checklists', 'work_order_time_entries', 'work_order_parts', 'work_order_comments', 'work_order_activity', 'asset_documents', 'inspection_routes', 'inspection_executions', 'inspection_results', 'suppliers', 'purchase_requests', 'supplier_contracts', 'asset_warranties', 'telemetry', 'iot_gateway', 'iot_device_config', 'iot_alerts', 'notification_subscriptions', 'notification_preferences', 'backup_jobs', 'push_deliveries', 'audit_logs']) if (!rules.rules[node]) failures.push(`Regras ausentes para ${node}.`);
if (!String(rules.rules.users['.read'] || '').includes('Administrador')) failures.push('Administrador não consegue listar usuários pelas regras.');
const mapHtml = fs.readFileSync(path.join(pagesDir, 'mapa.html'), 'utf8');
if (!mapHtml.includes('id="machine-layer"')) failures.push('Planta dinâmica sem machine-layer.');
const financeHtml = fs.readFileSync(path.join(pagesDir, 'financeiro.html'), 'utf8');
for (const id of ['report-period', 'report-asset', 'report-area', 'financial-report-excel', 'audit-history', 'user-management', 'user-admin-list']) if (!financeHtml.includes(`id="${id}"`)) failures.push(`Financeiro sem ${id}.`);
for (const name of ['menu.html', 'mapa.html', 'mapa-consumo.html', 'ativos.html', 'ativo-detalhes.html', 'os.html', 'estoque.html', 'financeiro.html', 'planejamento.html', 'preventiva.html', 'inspecoes.html', 'confiabilidade.html', 'solicitacoes.html', 'tecnico.html', 'os-detalhes.html', 'iot.html', 'notificacoes.html', 'continuidade.html', 'fornecedores.html', 'compras.html', 'contratos.html', 'executivo.html']) {
  const source = fs.readFileSync(path.join(pagesDir, name), 'utf8');
  if (!/<html[^>]+nexus-auth-pending/.test(source)) failures.push(`${name}: proteção visual inicial ausente.`);
  if (!source.includes('src="../assets/js/auth-gate.js"')) failures.push(`${name}: recuperação do controle de acesso ausente.`);
}
const financeJs = fs.readFileSync(path.join(scriptsDir, 'financeiro.js'), 'utf8');
for (const marker of ["startFinanceData()", "ref(db, 'users')", "data-save-role", "revealProtectedPage()"] ) if (!financeJs.includes(marker)) failures.push(`Financeiro sem fluxo administrativo: ${marker}`);

for (const name of ['menu.html', 'mapa.html', 'mapa-consumo.html', 'ativos.html', 'ativo-detalhes.html', 'os.html', 'estoque.html', 'financeiro.html', 'planejamento.html', 'preventiva.html', 'inspecoes.html', 'confiabilidade.html', 'solicitacoes.html', 'tecnico.html', 'os-detalhes.html', 'iot.html', 'notificacoes.html', 'continuidade.html', 'fornecedores.html', 'compras.html', 'contratos.html', 'executivo.html']) {
  const source = fs.readFileSync(path.join(pagesDir, name), 'utf8');
  if (!source.includes('src="../assets/js/ui-enhancements.js"')) failures.push(`${name}: componente compartilhado de Suporte ausente.`);
}
const enhancementsJs = fs.readFileSync(path.join(scriptsDir, 'ui-enhancements.js'), 'utf8');
for (const marker of ['addSupportMenu()', 'support-center-open', "new URL('./support-center.js'", 'Suporte e Acessibilidade']) {
  if (!enhancementsJs.includes(marker)) failures.push(`Integração compartilhada de Suporte incompleta: ${marker}`);
}
const supportJs = fs.readFileSync(path.join(scriptsDir, 'support-center.js'), 'utf8');
for (const marker of ['READ_ONLY_NOTICE', 'VLIBRAS_CONFIG', 'https://vlibras.gov.br/app/vlibras-plugin.js', 'loadTimeoutMs', 'data-support-tab', 'contextSummary()', 'dashboardSummary()', 'alertsSummary()', 'KNOWLEDGE_URL', 'answerFromKnowledge(text)', 'nexus-pwa-install']) {
  if (!supportJs.includes(marker)) failures.push(`Central de Suporte incompleta: ${marker}`);
}
for (const name of ['manifest.webmanifest', 'service-worker.js', 'offline.html', 'public/assets/js/pwa.js', 'public/assets/data/assistant-knowledge.json']) {
  if (!fs.existsSync(path.join(root, name))) failures.push(`Recurso PWA/base de conhecimento ausente: ${name}`);
}
const pwaJs = fs.readFileSync(path.join(scriptsDir, 'pwa.js'), 'utf8');
for (const marker of ['beforeinstallprompt', 'serviceWorker.register', 'Notification.requestPermission', 'showNotification', 'syncAlerts']) {
  if (!pwaJs.includes(marker)) failures.push(`Integração PWA incompleta: ${marker}`);
}
const loginJs = fs.readFileSync(path.join(scriptsDir, 'login.js'), 'utf8');
const uiJs = fs.readFileSync(path.join(scriptsDir, 'ui-enhancements.js'), 'utf8');
for (const marker of ["action: 'login'", "action: 'register'"]) if (!loginJs.includes(marker)) failures.push(`Auditoria de acesso incompleta: ${marker}`);
if (!uiJs.includes("action: 'logout'")) failures.push('Auditoria de logout ausente.');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`OK: ${htmlFiles.length} HTML, ${jsFiles.length} JavaScript, regras Firebase e fluxos principais.`);
