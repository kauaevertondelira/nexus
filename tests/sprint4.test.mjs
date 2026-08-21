import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const pages = ['iot', 'notificacoes', 'continuidade'];

for (const page of pages) {
    const html = read(`public/pages/${page}.html`);
    assert.ok(html.includes('nexus-auth-pending'), `${page}: bloqueio visual ausente.`);
    assert.ok(html.includes('../assets/js/auth-gate.js'), `${page}: auth-gate ausente.`);
    assert.ok(html.includes('../assets/css/sprint3.css'), `${page}: identidade visual ausente.`);
    assert.ok(html.includes(`../assets/js/${page}.js`), `${page}: módulo funcional ausente.`);
    assert.ok(html.includes('../assets/js/ui-enhancements.js'), `${page}: recursos globais ausentes.`);
}

const iot = read('public/assets/js/iot.js');
for (const marker of ['telemetry/latest', 'telemetry/history', 'iot_gateway/status', 'iot_device_config', 'iot_alerts', 'limitToLast(60)', 'severityBadge']) {
    assert.ok(iot.includes(marker), `Central IoT incompleta: ${marker}`);
}
assert.ok(!iot.includes('.publish('), 'O navegador não pode publicar em MQTT.');

const gateway = read('gateway/gateway.py');
for (const marker of ['nexus/telemetry/+', 'MAX_PAYLOAD_BYTES', 'FIREBASE_CREDENTIALS', 'commandChannel', 'prune_history', 'MQTT_TLS']) {
    assert.ok(gateway.includes(marker), `Gateway incompleto: ${marker}`);
}
assert.ok(!gateway.includes('nexus/command'), 'Gateway não pode assinar canal de comando.');
const simulator = read('gateway/simulator.py');
assert.ok(simulator.includes('client.publish(topic'), 'Simulador não publica telemetria.');
assert.ok(!simulator.includes('.subscribe('), 'Simulador não pode assinar comandos.');

const pythonCommand = process.env.NEXUS_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const pyCheck = spawnSync(pythonCommand, ['-m', 'py_compile', fileURLToPath(new URL('../gateway/gateway.py', import.meta.url)), fileURLToPath(new URL('../gateway/simulator.py', import.meta.url))], { encoding: 'utf8' });
assert.equal(pyCheck.status, 0, `Python inválido: ${pyCheck.stderr}`);

const notifications = read('public/assets/js/notificacoes.js');
for (const marker of ['VAPID_PUBLIC_KEY', 'Notification.requestPermission()', 'getToken(', 'notification_subscriptions', 'notification_preferences', 'deleteToken']) {
    assert.ok(notifications.includes(marker), `Notificações incompletas: ${marker}`);
}
const pushConfig = read('public/assets/js/push-config.js');
assert.match(pushConfig, /VAPID_PUBLIC_KEY\s*=\s*''/, 'Chave VAPID não deve ser inventada ou exposta.');

const continuity = read('public/assets/js/continuidade.js');
for (const marker of ['nexus-backup-v1', 'BACKUP_NODES', 'validateBackup', "value.data.users?.[context.user.uid]", "value.trim() !== 'RESTAURAR'", 'backup_jobs']) {
    assert.ok(continuity.includes(marker), `Continuidade incompleta: ${marker}`);
}

const functions = read('functions/index.js');
for (const marker of ['onValueCreated', '/iot_alerts/{alertId}', 'sendEachForMulticast', 'push_deliveries', 'preferenceAllows', 'notification_subscriptions']) {
    assert.ok(functions.includes(marker), `Função de push incompleta: ${marker}`);
}

const firebase = read('public/assets/js/firebase.js');
for (const page of pages) assert.ok(firebase.includes(`"${page}"`), `Permissão ausente: ${page}`);
const rules = JSON.parse(read('database.rules.json')).rules;
for (const node of ['telemetry', 'iot_gateway', 'iot_device_config', 'iot_alerts', 'notification_subscriptions', 'notification_preferences', 'backup_jobs', 'push_deliveries']) {
    assert.ok(rules[node], `Regra Firebase ausente: ${node}`);
}
assert.equal(rules.telemetry['.write'], false, 'Telemetria não pode aceitar escrita do navegador.');
assert.equal(rules.iot_gateway['.write'], false, 'Status do gateway não pode aceitar escrita do navegador.');

const serviceWorker = read('service-worker.js');
for (const marker of ['firebase-messaging-compat.js', 'onBackgroundMessage', './public/pages/iot.html']) assert.ok(serviceWorker.includes(marker), `Service Worker incompleto: ${marker}`);
assert.match(serviceWorker, /nexus-shell-v\d+/, 'Service Worker sem cache versionado.');
const login = read('public/assets/js/login.js');
for (const marker of ['iot.html', 'continuidade.html', 'authDurationMs', 'Promise.race']) assert.ok(login.includes(marker), `Login do Sprint 4 incompleto: ${marker}`);
const menu = read('public/assets/js/menu.js');
assert.ok(menu.includes("ref(db, 'iot_alerts')"), 'Visão Global não recebe alertas IoT.');

console.log('OK: Sprint 4 com IoT somente leitura, gateway PC, push, backup, permissões e segurança.');
