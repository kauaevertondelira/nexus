const { onValueCreated } = require('firebase-functions/v2/database');
const { logger } = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

function preferenceAllows(preferences = {}, severity = 'warning') {
  if (severity === 'critical') return preferences.iotCritical !== false;
  return preferences.iotWarning === true;
}

exports.sendIotAlertPush = onValueCreated('/iot_alerts/{alertId}', async (event) => {
  const alert = event.data.val();
  const alertId = event.params.alertId;
  if (!alert || alert.acknowledged || !['warning', 'critical'].includes(alert.severity)) return null;

  const database = getDatabase();
  const deliveryRef = database.ref(`push_deliveries/${alertId}`);
  const lock = await deliveryRef.transaction((current) => {
    if (current && current.status !== 'failed') return undefined;
    return { status: 'processing', startedAt: Date.now(), attempt: Number(current?.attempt || 0) + 1 };
  });
  if (!lock.committed) return null;

  try {
    const [subscriptionsSnapshot, preferencesSnapshot] = await Promise.all([
      database.ref('notification_subscriptions').get(),
      database.ref('notification_preferences').get(),
    ]);
    const subscriptions = subscriptionsSnapshot.val() || {};
    const preferences = preferencesSnapshot.val() || {};
    const targets = [];

    Object.entries(subscriptions).forEach(([uid, devices]) => {
      if (!preferenceAllows(preferences[uid] || {}, alert.severity)) return;
      Object.entries(devices || {}).forEach(([key, device]) => {
        if (device?.enabled !== false && typeof device?.token === 'string' && device.token.length > 20) {
          targets.push({ uid, key, token: device.token });
        }
      });
    });

    if (!targets.length) {
      await deliveryRef.set({ status: 'skipped', reason: 'no-targets', completedAt: Date.now() });
      return null;
    }

    let successCount = 0;
    let failureCount = 0;
    for (let offset = 0; offset < targets.length; offset += 500) {
      const batch = targets.slice(offset, offset + 500);
      const hostingOrigin = process.env.HOSTING_ORIGIN || 'https://nexus-iot-senai.web.app';
      const response = await getMessaging().sendEachForMulticast({
        tokens: batch.map((target) => target.token),
        data: {
          alertId,
          deviceId: String(alert.deviceId || ''),
          severity: String(alert.severity || 'warning'),
          title: String(alert.title || 'Alerta Nexus'),
          body: String(alert.message || 'Nova ocorrência de telemetria.'),
          tag: `nexus-iot-${alertId}`,
          url: '/public/pages/iot.html'
        },
        webpush: { headers: { Urgency: alert.severity === 'critical' ? 'high' : 'normal' }, fcmOptions: { link: `${hostingOrigin}/public/pages/iot.html` } },
      });
      successCount += response.successCount;
      failureCount += response.failureCount;
      const removals = {};
      response.responses.forEach((result, index) => {
        const code = result.error?.code || '';
        if (!result.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(code)) {
          const target = batch[index];
          removals[`notification_subscriptions/${target.uid}/${target.key}`] = null;
        }
      });
      if (Object.keys(removals).length) await database.ref().update(removals);
    }

    await deliveryRef.set({ status: 'completed', successCount, failureCount, completedAt: Date.now() });
    logger.info('Push IoT processado', { alertId, successCount, failureCount });
    return null;
  } catch (error) {
    await deliveryRef.set({ status: 'failed', message: String(error.message || error).slice(0, 180), completedAt: Date.now() });
    logger.error('Falha no push IoT', { alertId, error });
    throw error;
  }
});
