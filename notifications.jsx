// Notifications — permission, test, and on-load reminder scan.
// Note: without a backend (Cloud Functions / FCM) we can't schedule push
// notifications when the app is closed. The "test" button proves it works;
// the on-load scanner fires reminders for upcoming payments matching the
// user's notifTimings whenever the app opens.

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

Object.assign(window, { notifPermission, ensureNotifPermission, showLocalNotification, scanForReminders });
