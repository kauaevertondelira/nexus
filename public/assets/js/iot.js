import {
    db, ref, onValue, update, writeAuditLog, escapeHtml, entries, nonNegative,
    mountMaintenanceShell, startProtectedPage, formatDateTime, emptyState,
    openDialog, wireDialog, closeDialog, toast, setButtonBusy
} from './maintenance-core.js';
import { query, limitToLast } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

mountMaintenanceShell({
    pageId: 'iot',
    title: 'Central IoT',
    subtitle: 'Telemetria MQTT recebida pelo gateway do PC · somente leitura industrial',
    headerActions: '<span id="gateway-pill" class="s3-badge s3-badge--slate"><span class="s4-status-dot" data-state="offline"></span> Gateway aguardando</span>',
    content: `
        <div class="s3-page">
            <div class="s4-notice" data-tone="success"><i class="fas fa-shield-halved text-emerald-500 mt-1" aria-hidden="true"></i><div><strong>Canal exclusivamente de telemetria</strong><p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Esta tela não possui comandos de ligar, desligar ou alterar máquinas. O navegador apenas consulta dados validados pelo gateway.</p></div></div>
            <div class="s3-grid s3-grid--kpi mt-4">
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Dispositivos ativos</span><strong id="kpi-online" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-satellite-dish" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Em atenção</span><strong id="kpi-warning" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Alertas abertos</span><strong id="kpi-alerts" class="s3-kpi__value">0</strong></div><span class="s3-kpi__icon"><i class="fas fa-bell" aria-hidden="true"></i></span></article>
                <article class="s3-card s3-kpi"><div><span class="s3-kpi__label">Última mensagem</span><strong id="kpi-last" class="s3-kpi__value text-base">—</strong></div><span class="s3-kpi__icon"><i class="fas fa-clock" aria-hidden="true"></i></span></article>
            </div>
            <div class="s3-layout-aside">
                <section class="s3-card">
                    <div class="s3-card__head"><div><h3>Histórico do dispositivo</h3><p>Últimas 60 leituras recebidas pelo gateway.</p></div><select id="device-select" class="s3-input" aria-label="Selecionar dispositivo"><option value="">Aguardando dispositivos</option></select></div>
                    <div id="selected-metrics" class="s4-metric-grid p-4"></div>
                    <div class="s4-chart"><canvas id="telemetry-chart" aria-label="Gráfico de temperatura e vibração"></canvas><div id="chart-fallback" class="s3-empty" hidden></div></div>
                </section>
                <aside class="s3-card">
                    <div class="s3-card__head"><div><h3>Alertas IoT</h3><p>Ocorrências criadas pelo gateway.</p></div><a href="notificacoes.html" class="s3-btn s3-btn--sm"><i class="fas fa-bell" aria-hidden="true"></i>Push</a></div>
                    <div id="iot-alert-list" class="s3-card__body s3-list" aria-live="polite"></div>
                </aside>
            </div>
            <section class="s3-card mt-4">
                <div class="s3-card__head"><div><h3>Dispositivos monitorados</h3><p>Estado atual e vínculo com o parque de ativos.</p></div><span class="s3-badge s3-badge--blue">MQTT → Gateway → Firebase</span></div>
                <div class="overflow-x-auto"><table class="s3-table"><thead><tr><th>Dispositivo</th><th>Ativo</th><th>Estado</th><th>Temperatura</th><th>Vibração</th><th>Energia</th><th>Última leitura</th><th>Ação</th></tr></thead><tbody id="device-table"></tbody></table></div>
            </section>
        </div>
        <dialog id="device-dialog" class="s3-dialog" aria-labelledby="device-dialog-title">
            <form id="device-form">
                <div class="s3-dialog__head"><h2 id="device-dialog-title">Limites do dispositivo</h2><button type="button" class="s3-btn s3-btn--sm" data-dialog-close aria-label="Fechar"><i class="fas fa-xmark" aria-hidden="true"></i></button></div>
                <div class="s3-dialog__body s3-form-grid">
                    <input id="config-device-id" type="hidden">
                    <div class="s3-field s3-field--wide"><label for="config-label">Nome amigável</label><input id="config-label" maxlength="120" required></div>
                    <div class="s3-field s3-field--wide"><label for="config-asset">Ativo relacionado</label><select id="config-asset"><option value="">Sem vínculo</option></select></div>
                    <div class="s3-field"><label for="temp-warning">Temperatura de atenção (°C)</label><input id="temp-warning" type="number" min="1" max="499" step="0.1" required></div>
                    <div class="s3-field"><label for="temp-critical">Temperatura crítica (°C)</label><input id="temp-critical" type="number" min="2" max="500" step="0.1" required></div>
                    <div class="s3-field"><label for="vibration-warning">Vibração de atenção (mm/s)</label><input id="vibration-warning" type="number" min="0.1" max="99" step="0.1" required></div>
                    <div class="s3-field"><label for="vibration-critical">Vibração crítica (mm/s)</label><input id="vibration-critical" type="number" min="0.2" max="100" step="0.1" required></div>
                </div>
                <div class="s3-dialog__foot"><button type="button" class="s3-btn" data-dialog-close>Cancelar</button><button id="device-submit" type="submit" class="s3-btn s3-btn--primary"><i class="fas fa-floppy-disk" aria-hidden="true"></i>Salvar limites</button></div>
            </form>
        </dialog>`
});

wireDialog('device-dialog');

let context;
let latest = {};
let alerts = {};
let configs = {};
let assets = {};
let gateway = {};
let selectedId = '';
let historyUnsubscribe;
let historyDeviceId = '';
let chart;

const severityMeta = {
    normal: { label: 'Normal', className: 's3-badge--green' },
    warning: { label: 'Atenção', className: 's3-badge--amber' },
    critical: { label: 'Crítico', className: 's3-badge--red' },
    offline: { label: 'Sem sinal', className: 's3-badge--slate' }
};

function safeDeviceId(value) {
    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

function readingAge(reading) {
    return Date.now() - nonNegative(reading?.receivedAt);
}

function effectiveSeverity(reading) {
    if (!reading?.receivedAt || readingAge(reading) > 60000) return 'offline';
    return severityMeta[reading.severity] ? reading.severity : 'normal';
}

function severityBadge(reading) {
    const key = effectiveSeverity(reading);
    const meta = severityMeta[key];
    return `<span class="s3-badge ${meta.className}"><span class="s4-status-dot" data-state="${key}"></span>${meta.label}</span>`;
}

function number(value, suffix, digits = 1) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${parsed.toLocaleString('pt-BR', { maximumFractionDigits: digits })}${suffix}` : '—';
}

function deviceLabel(id, reading = latest[id]) {
    return configs[id]?.label || reading?.deviceName || id;
}

function renderGateway() {
    const online = gateway.status === 'online' && Date.now() - nonNegative(gateway.heartbeatAt) < 45000;
    const pill = document.getElementById('gateway-pill');
    pill.className = `s3-badge ${online ? 's3-badge--green' : 's3-badge--slate'}`;
    pill.innerHTML = `<span class="s4-status-dot" data-state="${online ? 'online' : 'offline'}"></span>${online ? 'Gateway online' : 'Gateway offline'}`;
}

function renderKpis() {
    const values = entries(latest).map(([, reading]) => reading);
    const active = values.filter((reading) => readingAge(reading) <= 60000);
    document.getElementById('kpi-online').textContent = active.length;
    document.getElementById('kpi-warning').textContent = active.filter((reading) => ['warning', 'critical'].includes(effectiveSeverity(reading))).length;
    document.getElementById('kpi-alerts').textContent = entries(alerts).filter(([, alert]) => !alert.acknowledged).length;
    const last = Math.max(0, ...values.map((reading) => nonNegative(reading.receivedAt)));
    document.getElementById('kpi-last').textContent = last ? formatDateTime(last) : '—';
}

function renderDeviceOptions() {
    const ids = entries(latest).map(([id]) => id).sort();
    if (!ids.length) {
        selectedId = '';
        document.getElementById('device-select').innerHTML = '<option value="">Aguardando dispositivos</option>';
        renderSelected();
        return;
    }
    if (!ids.includes(selectedId)) selectedId = ids[0];
    document.getElementById('device-select').innerHTML = ids.map((id) => `<option value="${escapeHtml(id)}" ${id === selectedId ? 'selected' : ''}>${escapeHtml(deviceLabel(id))}</option>`).join('');
    subscribeHistory(selectedId);
    renderSelected();
}

function renderSelected() {
    const reading = latest[selectedId];
    const region = document.getElementById('selected-metrics');
    if (!reading) {
        region.innerHTML = '<div class="s3-empty">Selecione um dispositivo com telemetria.</div>';
        return;
    }
    region.innerHTML = [
        ['Temperatura', number(reading.temperature, ' °C')],
        ['Vibração', number(reading.vibration, ' mm/s', 2)],
        ['Energia', number(reading.energyKwh, ' kWh', 2)],
        ['Rotação', number(reading.rpm, ' rpm', 0)]
    ].map(([label, value]) => `<div class="s4-metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function renderDevices() {
    const rows = entries(latest).sort((a, b) => nonNegative(b[1].receivedAt) - nonNegative(a[1].receivedAt));
    const canConfigure = ['Administrador', 'Técnico de Manutenção'].includes(context?.profile?.role);
    document.getElementById('device-table').innerHTML = rows.map(([id, reading]) => {
        const assetId = configs[id]?.assetId || reading.assetId || '';
        const assetName = assets[assetId]?.name || reading.assetName || 'Não vinculado';
        return `<tr><td><strong>${escapeHtml(deviceLabel(id, reading))}</strong><small>${escapeHtml(id)}</small></td><td>${escapeHtml(assetName)}</td><td>${severityBadge(reading)}</td><td>${number(reading.temperature, ' °C')}</td><td>${number(reading.vibration, ' mm/s', 2)}</td><td>${number(reading.energyKwh, ' kWh', 2)}</td><td>${formatDateTime(reading.receivedAt)}</td><td>${canConfigure ? `<button class="s3-btn s3-btn--sm" type="button" data-configure="${escapeHtml(id)}"><i class="fas fa-sliders" aria-hidden="true"></i>Limites</button>` : '<span class="text-xs text-slate-400">Consulta</span>'}</td></tr>`;
    }).join('') || '<tr><td colspan="8"><div class="s3-empty"><div><i class="fas fa-tower-broadcast" aria-hidden="true"></i><strong>Sem telemetria</strong><p>Inicie o gateway e o simulador na pasta gateway.</p></div></div></td></tr>';
}

function renderAlerts() {
    const canAcknowledge = ['Administrador', 'Técnico de Manutenção'].includes(context?.profile?.role);
    const openAlerts = entries(alerts).filter(([, alert]) => !alert.acknowledged).sort((a, b) => nonNegative(b[1].createdAt) - nonNegative(a[1].createdAt)).slice(0, 10);
    document.getElementById('iot-alert-list').innerHTML = openAlerts.map(([id, alert]) => `<article class="s3-list-item"><div class="s3-list-item__top"><h4>${escapeHtml(alert.title || 'Alerta de telemetria')}</h4><span class="s3-badge ${alert.severity === 'critical' ? 's3-badge--red' : 's3-badge--amber'}">${alert.severity === 'critical' ? 'Crítico' : 'Atenção'}</span></div><p>${escapeHtml(alert.message || '')}</p><div class="s3-meta"><span>${formatDateTime(alert.createdAt)}</span><span>${escapeHtml(deviceLabel(alert.deviceId, {}))}</span></div>${canAcknowledge ? `<div class="s3-actions mt-3"><button type="button" class="s3-btn s3-btn--sm" data-ack="${escapeHtml(id)}"><i class="fas fa-check" aria-hidden="true"></i>Reconhecer</button></div>` : ''}</article>`).join('') || emptyState('fa-circle-check', 'Nenhum alerta aberto', 'A telemetria está dentro dos limites configurados.');
}

function renderAll() {
    renderGateway();
    renderKpis();
    renderDeviceOptions();
    renderDevices();
    renderAlerts();
}

function renderChart(readings) {
    const canvas = document.getElementById('telemetry-chart');
    const fallback = document.getElementById('chart-fallback');
    const values = entries(readings).map(([, reading]) => reading).sort((a, b) => nonNegative(a.receivedAt) - nonNegative(b.receivedAt));
    if (!values.length || !window.Chart) {
        canvas.hidden = true;
        fallback.hidden = false;
        fallback.innerHTML = emptyState('fa-chart-line', 'Histórico aguardando dados', 'As leituras aparecerão aqui quando o gateway publicar mensagens.');
        return;
    }
    canvas.hidden = false;
    fallback.hidden = true;
    const style = getComputedStyle(document.documentElement);
    chart?.destroy();
    chart = new window.Chart(canvas, {
        type: 'line',
        data: {
            labels: values.map((reading) => new Date(nonNegative(reading.receivedAt)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })),
            datasets: [
                { label: 'Temperatura °C', data: values.map((reading) => Number(reading.temperature) || 0), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.08)', yAxisID: 'y', tension: .25 },
                { label: 'Vibração mm/s', data: values.map((reading) => Number(reading.vibration) || 0), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.08)', yAxisID: 'y1', tension: .25 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { intersect: false, mode: 'index' }, plugins: { legend: { labels: { color: style.getPropertyValue('--s3-muted') } } }, scales: { x: { ticks: { color: style.getPropertyValue('--s3-muted'), maxTicksLimit: 8 }, grid: { color: 'rgba(148,163,184,.12)' } }, y: { position: 'left', ticks: { color: '#f59e0b' }, grid: { color: 'rgba(148,163,184,.12)' } }, y1: { position: 'right', ticks: { color: '#3b82f6' }, grid: { display: false } } } }
    });
}

function subscribeHistory(id) {
    if (id && id === historyDeviceId && historyUnsubscribe) return;
    historyUnsubscribe?.();
    historyDeviceId = id;
    if (!id) return renderChart({});
    historyUnsubscribe = onValue(query(ref(db, `telemetry/history/${id}`), limitToLast(60)), (snapshot) => renderChart(snapshot.val() || {}), () => renderChart({}));
}

function openConfiguration(id) {
    const safeId = safeDeviceId(id);
    const reading = latest[safeId] || {};
    const config = configs[safeId] || {};
    document.getElementById('config-device-id').value = safeId;
    document.getElementById('config-label').value = config.label || reading.deviceName || safeId;
    document.getElementById('config-asset').innerHTML = '<option value="">Sem vínculo</option>' + entries(assets).map(([assetId, asset]) => `<option value="${escapeHtml(assetId)}" ${assetId === (config.assetId || reading.assetId) ? 'selected' : ''}>${escapeHtml(asset.name || assetId)}</option>`).join('');
    document.getElementById('temp-warning').value = nonNegative(config.tempWarning, 70);
    document.getElementById('temp-critical').value = nonNegative(config.tempCritical, 85);
    document.getElementById('vibration-warning').value = nonNegative(config.vibrationWarning, 4.5);
    document.getElementById('vibration-critical').value = nonNegative(config.vibrationCritical, 7.1);
    openDialog('device-dialog');
}

document.getElementById('device-select').addEventListener('change', (event) => {
    selectedId = safeDeviceId(event.target.value);
    subscribeHistory(selectedId);
    renderSelected();
});

document.addEventListener('click', async (event) => {
    const configure = event.target.closest('[data-configure]');
    if (configure) return openConfiguration(configure.dataset.configure);
    const acknowledge = event.target.closest('[data-ack]');
    if (acknowledge && ['Administrador', 'Técnico de Manutenção'].includes(context?.profile?.role)) {
        try {
            await update(ref(db, `iot_alerts/${acknowledge.dataset.ack}`), { acknowledged: true, acknowledgedAt: Date.now(), acknowledgedByUid: context.user.uid, acknowledgedBy: context.profile.name || '' });
            await writeAuditLog({ action: 'acknowledge', entity: 'iot_alert', entityId: acknowledge.dataset.ack, description: 'Alerta IoT reconhecido.' });
            toast('success', 'Alerta reconhecido.');
        } catch (error) {
            console.error(error);
            toast('error', 'Não foi possível reconhecer o alerta.');
        }
    }
});

document.getElementById('device-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!['Administrador', 'Técnico de Manutenção'].includes(context?.profile?.role)) return;
    const button = document.getElementById('device-submit');
    const id = safeDeviceId(document.getElementById('config-device-id').value);
    const tempWarning = Number(document.getElementById('temp-warning').value);
    const tempCritical = Number(document.getElementById('temp-critical').value);
    const vibrationWarning = Number(document.getElementById('vibration-warning').value);
    const vibrationCritical = Number(document.getElementById('vibration-critical').value);
    if (!id || tempWarning >= tempCritical || vibrationWarning >= vibrationCritical) return toast('error', 'O limite crítico deve ser maior que o limite de atenção.');
    setButtonBusy(button, true, 'Salvando...');
    try {
        await update(ref(db, `iot_device_config/${id}`), {
            label: document.getElementById('config-label').value.trim(),
            assetId: document.getElementById('config-asset').value,
            tempWarning, tempCritical, vibrationWarning, vibrationCritical,
            active: true,
            updatedAt: Date.now(),
            updatedByUid: context.user.uid
        });
        await writeAuditLog({ action: 'configure', entity: 'iot_device', entityId: id, description: `Limites de telemetria do dispositivo ${id} atualizados.` });
        closeDialog('device-dialog');
        toast('success', 'Limites atualizados. O gateway aplicará a configuração nas próximas leituras.');
    } catch (error) {
        console.error(error);
        toast('error', 'Não foi possível salvar os limites.');
    } finally {
        setButtonBusy(button, false);
    }
});

startProtectedPage('iot', (pageContext) => {
    context = pageContext;
    onValue(ref(db, 'telemetry/latest'), (snapshot) => { latest = snapshot.val() || {}; renderAll(); });
    onValue(ref(db, 'iot_alerts'), (snapshot) => { alerts = snapshot.val() || {}; renderAll(); });
    onValue(ref(db, 'iot_device_config'), (snapshot) => { configs = snapshot.val() || {}; renderAll(); });
    onValue(ref(db, 'iot_gateway/status'), (snapshot) => { gateway = snapshot.val() || {}; renderGateway(); });
    onValue(ref(db, 'assets'), (snapshot) => { assets = snapshot.val() || {}; renderAll(); });
    window.setInterval(() => { renderGateway(); renderKpis(); renderDevices(); }, 15000);
});
