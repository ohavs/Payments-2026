// Payment reminders scheduled on the phone itself (Android). Every charge date
// is known in advance, so the app schedules the next weeks of reminders
// locally: they arrive with the app closed and without a network. The web
// keeps the on-load scan and FCM push in notifications.jsx.
import { LocalNotifications } from '@capacitor/local-notifications';
import { fmtMoney, resolveService } from '../data.jsx';
import { occurrencesBetween } from './recurrence.js';
import { isNative } from './platform.js';

export const REMINDER_CHANNEL = 'payment-reminders';
const TIMING_DAYS = { week: 7, three: 3, day: 1, same: 0 };
const HORIZON_DAYS = 60;
// Android caps an app at 500 pending alarms; the soonest 64 are plenty since
// they are rescheduled on every launch and every change.
const MAX_PENDING = 64;

function whenLabel(days) {
  if (days === 0) return 'היום';
  if (days === 1) return 'מחר';
  return `בעוד ${days} ימים`;
}

// Stable 31-bit id per reminder, so rescheduling replaces rather than stacks.
function reminderId(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return (h & 0x7fffffff) || 1;
}

// Pure: which reminders to schedule from `now`, soonest first.
export function planReminders(subs, settings, now = new Date()) {
  if (!settings?.notif) return [];
  const timings = (settings.notifTimings || []).filter((t) => t in TIMING_DAYS);
  if (!timings.length) return [];
  const [hh, mm] = String(settings.notifTime || '09:00').split(':').map(Number);
  const from = new Date(now); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setDate(to.getDate() + HORIZON_DAYS + 7);
  const out = [];
  subs.forEach((p) => {
    const name = resolveService(p)?.name || 'תשלום';
    occurrencesBetween(p, from, to).forEach((due) => {
      timings.forEach((t) => {
        const days = TIMING_DAYS[t];
        const at = new Date(due); at.setDate(at.getDate() - days); at.setHours(hh || 0, mm || 0, 0, 0);
        if (at <= now) return;
        if (at - from > HORIZON_DAYS * 86400000) return;
        const dueISO = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
        out.push({
          id: reminderId(`${p.id}:${dueISO}:${t}`),
          at,
          title: `תזכורת תשלום: ${name}`,
          body: `${whenLabel(days)} · ${fmtMoney(p.price, p.currency)}`,
          subId: p.id,
        });
      });
    });
  });
  out.sort((a, b) => a.at - b.at);
  return out.slice(0, MAX_PENDING);
}

let channelReady = null;
function ensureChannel() {
  if (!channelReady) {
    channelReady = LocalNotifications.createChannel({
      id: REMINDER_CHANNEL, name: 'תזכורות תשלום', description: 'לפני כל חיוב של מנוי',
      importance: 4, visibility: 1, vibration: true,
    }).catch(() => {});
  }
  return channelReady;
}

export async function nativeNotifPermission() {
  const { display } = await LocalNotifications.checkPermissions();
  return display === 'prompt-with-rationale' ? 'prompt' : display;
}

export async function ensureNativeNotifPermission() {
  const current = await nativeNotifPermission();
  if (current !== 'prompt') return current;
  const { display } = await LocalNotifications.requestPermissions();
  return display;
}

// Replace whatever is pending with the current plan. Serialised so quick
// successive changes don't interleave cancel/schedule calls.
let queue = Promise.resolve();
export function syncReminders(subs, settings) {
  if (!isNative) return Promise.resolve();
  queue = queue.then(async () => {
    try {
      await ensureChannel();
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      }
      if ((await nativeNotifPermission()) !== 'granted') return;
      const plan = planReminders(subs, settings);
      if (!plan.length) return;
      await LocalNotifications.schedule({
        notifications: plan.map((r) => ({
          id: r.id, title: r.title, body: r.body,
          schedule: { at: r.at, allowWhileIdle: true },
          channelId: REMINDER_CHANNEL, smallIcon: 'ic_stat_notify', iconColor: '#22A45D',
          extra: { tab: 'subs', subId: r.subId },
        })),
      });
    } catch (e) { console.error('reminder sync failed', e); }
  });
  return queue;
}

export async function sendNativeTestNotification() {
  await ensureChannel();
  await LocalNotifications.schedule({
    notifications: [{
      id: 1, title: 'בדיקת התראות', body: 'מצוין! התזכורות יגיעו גם כשהאפליקציה סגורה.',
      schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
      channelId: REMINDER_CHANNEL, smallIcon: 'ic_stat_notify', iconColor: '#22A45D',
    }],
  });
}

// Tapping a reminder opens the subscriptions tab.
export function onReminderTap(fn) {
  if (!isNative) return () => {};
  const h = LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    fn(e.notification?.extra || {});
  });
  return () => { h.then((x) => x.remove()); };
}
