// Notifications — permission, test, FCM token registration, reminder scan.
// Cloud Functions handle scheduled push (via FCM) when the app is closed;
// the on-load scanner here covers in-session reminders too.

const NOTIF_TIMING_DAYS = { week: 7, three: 3, day: 1, same: 0 };

function notifPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

async function ensureNotifPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

async function showLocalNotification(title, body, opts = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.ready;
    const payload = {
      body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
      lang: 'he', dir: 'rtl', tag: opts.tag, data: opts.data || {},
      ...opts,
    };
    if (reg) await reg.showNotification(title, payload);
    else new Notification(title, payload);
    return true;
  } catch (e) { console.error('notification failed', e); return false; }
}

// Fires reminders for upcoming payments matching settings on each app load.
// De-duplicates via localStorage so the same reminder doesn't fire repeatedly.
function scanForReminders(payments, settings) {
  if (!settings?.notif) return;
  if (notifPermission() !== 'granted') return;
  const timings = settings.notifTimings || [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const stamp = today.toISOString().slice(0, 10);
  const seen = JSON.parse(localStorage.getItem('notif-seen') || '{}');

  payments.forEach(p => {
    const due = new Date(p.nextDate); due.setHours(0, 0, 0, 0);
    const diff = Math.round((due - today) / 86400000);
    timings.forEach(timing => {
      if (diff === NOTIF_TIMING_DAYS[timing]) {
        const key = `${p.id}:${stamp}:${timing}`;
        if (seen[key]) return;
        const svc = window.resolveService ? window.resolveService(p) : null;
        const when = diff === 0 ? 'היום' : diff === 1 ? 'מחר' : `בעוד ${diff} ימים`;
        showLocalNotification(
          `תזכורת תשלום: ${svc?.name || 'תשלום'}`,
          `${when} · ${window.fmtMoney ? window.fmtMoney(p.price, p.currency) : p.price}`,
          { tag: key }
        );
        seen[key] = Date.now();
      }
    });
  });

  // Prune entries older than 30 days
  const cutoff = Date.now() - 30 * 86400000;
  Object.keys(seen).forEach(k => { if (seen[k] < cutoff) delete seen[k]; });
  localStorage.setItem('notif-seen', JSON.stringify(seen));
}

// ----------------- FCM (Web Push) -----------------
// Register the device for FCM, store the token under users/{uid}/settings/main.fcmToken.
// The Cloud Function reads this token to send scheduled push notifications.
async function registerFcmToken(uid) {
  if (!uid) return null;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
  if (!window.firebase?.messaging || !window.FCM_VAPID_KEY) return null;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (!reg) return null;
    const messaging = firebase.messaging();
    const token = await messaging.getToken({
      vapidKey: window.FCM_VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!token) return null;
    await fbDb.collection('users').doc(uid).collection('settings').doc('main')
      .set({ fcmToken: token, fcmTokenUpdatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    // Foreground messages: also show as notification (FCM doesn't auto-display when page is open)
    messaging.onMessage((payload) => {
      const n = payload.notification || {};
      showLocalNotification(n.title || 'תזכורת', n.body || '', { tag: 'fg-' + Date.now() });
    });
    return token;
  } catch (e) {
    console.error('FCM token registration failed', e);
    return null;
  }
}

Object.assign(window, { notifPermission, ensureNotifPermission, showLocalNotification, scanForReminders, registerFcmToken });
