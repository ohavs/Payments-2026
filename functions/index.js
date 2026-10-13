// Cloud Functions: push notifications from the server.
//
//   paymentReminders   hourly   reminders for web devices (Android schedules its own)
//   onSpaceItemCreated trigger  a partner's expense in a shared space; budget alerts
//   monthlySummary     1st 9:00 "בספטמבר הוצאת ₪4,210, 12% פחות מאוגוסט"
//
// Devices register under users/{uid}/devices/{deviceId} = { token, platform,
// localReminders }. users/{uid}/settings/main.fcmToken is the older single web
// token and is still honoured.
//
// nextDate is the recurrence anchor and is never rolled forward in storage;
// recurrence.mjs (an identical copy of src/lib/recurrence.js) projects it.

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { logger } = require('firebase-functions');
const lib = require('./lib');

initializeApp();
const db = getFirestore();
const fcm = getMessaging();

const TIMING_DAYS = { week: 7, three: 3, day: 1, same: 0 };
const TZ = 'Asia/Jerusalem';
// Firestore lives in eur3; its triggers run next to it. Schedules stay where
// paymentReminders always was.
const TRIGGER_REGION = 'europe-west1';
const SCHEDULE_REGION = 'us-central1';

const settingsRef = (uid) => db.collection('users').doc(uid).collection('settings').doc('main');
async function settingsOf(uid) {
  return (await settingsRef(uid).get()).data() || {};
}

// Jerusalem's calendar date, as numbers and as a local-midnight Date.
function jerusalemToday(now = new Date()) {
  const [y, m, d] = now.toLocaleDateString('en-CA', { timeZone: TZ }).split('-').map(Number);
  return { y, m: m - 1, d, date: new Date(y, m - 1, d) };
}

async function targetsFor(uid, { webOnly = false } = {}) {
  const out = [];
  const devices = await db.collection('users').doc(uid).collection('devices').get();
  devices.forEach((doc) => {
    const v = doc.data();
    if (!v.token || (webOnly && v.localReminders)) return;
    if (!out.some((t) => t.token === v.token)) out.push({ token: v.token, ref: doc.ref });
  });
  const legacy = (await settingsOf(uid)).fcmToken;
  if (legacy && !out.some((t) => t.token === legacy)) out.push({ token: legacy, legacy: true });
  return out;
}

async function sendToUser(uid, { title, body, channel, data = {} }, opts) {
  const targets = await targetsFor(uid, opts);
  const payload = Object.fromEntries(Object.entries({ ...data, channel }).map(([k, v]) => [k, String(v)]));
  let sent = 0;
  for (const t of targets) {
    try {
      await fcm.send({
        token: t.token,
        notification: { title, body },
        android: { notification: { channelId: channel, icon: 'ic_stat_notify', color: '#22A45D' } },
        webpush: {
          fcmOptions: { link: '/' },
          notification: { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', dir: 'rtl', lang: 'he' },
        },
        data: payload,
      });
      sent++;
    } catch (err) {
      if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token') {
        if (t.ref) await t.ref.delete();
        else await settingsRef(uid).update({ fcmToken: FieldValue.delete() });
      } else {
        logger.warn(`FCM send failed uid=${uid} code=${err.code}`);
      }
    }
  }
  return sent;
}

// Subscriptions the user sees: their own plus every shared space they're in.
async function subscriptionsOf(uid) {
  const own = await db.collection('users').doc(uid).collection('payments').get();
  const out = own.docs.map((d) => ({ id: d.id, ...d.data() }));
  const spaces = await db.collection('lists').where('members', 'array-contains', uid).get();
  for (const space of spaces.docs) {
    const v = space.data();
    if (v.kind !== 'shared' && (v.members || []).length < 2) continue;
    const subs = await space.ref.collection('subs').get();
    subs.forEach((d) => out.push({ id: d.id, ...d.data() }));
  }
  return out;
}

exports.paymentReminders = onSchedule(
  { schedule: '0 * * * *', timeZone: TZ, region: SCHEDULE_REGION, memory: '256MiB', timeoutSeconds: 120 },
  async () => {
    const now = new Date();
    const hour = now.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }).slice(0, 2);
    const today = jerusalemToday(now).date;
    const { daysUntilNext } = await import('./recurrence.mjs');
    const users = await db.collection('users').listDocuments();
    let sent = 0;
    for (const userRef of users) {
      try {
        const s = await settingsOf(userRef.id);
        if (!s.notif || !(s.notifTimings || []).length) continue;
        if ((s.notifTime || '09:00').split(':')[0].padStart(2, '0') !== hour) continue;
        if (!(await targetsFor(userRef.id, { webOnly: true })).length) continue;
        for (const p of await subscriptionsOf(userRef.id)) {
          const diff = daysUntilNext(p, today);
          if (diff === null || !s.notifTimings.some((t) => TIMING_DAYS[t] === diff)) continue;
          sent += await sendToUser(userRef.id, {
            title: `תזכורת תשלום: ${lib.serviceName(p)}`,
            body: `${lib.whenLabel(diff)} · ${lib.fmtMoney(p.price, p.currency)}`,
            channel: 'payment-reminders',
            data: { tab: 'subs', paymentId: p.id },
          }, { webOnly: true });
        }
      } catch (err) {
        logger.error(`reminders failed uid=${userRef.id}`, err);
      }
    }
    logger.info(`reminders hour=${hour} users=${users.length} sent=${sent}`);
  }
);

// A new expense: tell the other members of a shared space, then check the
// space's monthly cap (80% and 100%, once each per month).
exports.onSpaceItemCreated = onDocumentCreated(
  { document: 'lists/{listId}/items/{itemId}', region: TRIGGER_REGION, memory: '256MiB' },
  async (event) => {
    const item = event.data?.data();
    if (!item) return;
    const listRef = db.collection('lists').doc(event.params.listId);
    const list = (await listRef.get()).data();
    if (!list) return;
    const members = list.members || [];
    const shared = list.kind === 'shared' || members.length > 1;

    if (shared) {
      const actor = item.addedBy;
      const actorName = (list.memberInfo?.[actor]?.name || '').split(' ')[0] || 'מישהו';
      const msg = lib.expenseMessage(item, actorName, list.name);
      for (const uid of members) {
        if (uid === actor || (await settingsOf(uid)).sharedNotif === false) continue;
        await sendToUser(uid, { ...msg, channel: 'shared-activity', data: { tab: 'expenses', listId: listRef.id } });
      }
    }

    // Budget: only expenses dated this month move this month's total.
    const today = jerusalemToday();
    const month = lib.monthRange(today.y, today.m);
    if (!String(item.date || '').startsWith(month.key)) return;
    let cap = 0;
    let subs = [];
    if (shared) {
      const b = list.budget || {};
      cap = Number(b.monthlyCap) || 0;
      if (cap > 0 && b.includeSubsInBudget !== false) subs = (await listRef.collection('subs').get()).docs.map((d) => d.data());
    } else {
      const s = await settingsOf(list.ownerUid);
      cap = Number(s.monthlyCap) || 0;
      if (cap > 0 && s.includeSubsInBudget !== false) {
        subs = (await db.collection('users').doc(list.ownerUid).collection('payments').get()).docs.map((d) => d.data());
      }
    }
    if (!(cap > 0)) return;
    const items = await listRef.collection('items').where('date', '>=', month.from).where('date', '<=', month.to).get();
    const used = lib.sumAmounts(items.docs.map((d) => d.data())) + lib.subsMonthly(subs);
    const field = `budgetAlerts.m${month.key.replace('-', '')}`;
    const threshold = await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(listRef)).data() || {};
      const t = lib.budgetThreshold(used, cap, fresh.budgetAlerts?.[`m${month.key.replace('-', '')}`] || 0);
      if (t) tx.update(listRef, { [field]: t });
      return t;
    });
    if (!threshold) return;
    const msg = lib.budgetMessage(threshold, used, cap, shared ? list.name : '');
    for (const uid of members) {
      if ((await settingsOf(uid)).budgetAlerts === false) continue;
      await sendToUser(uid, { ...msg, channel: 'budget', data: { tab: 'summary' } });
    }
  }
);

// 1st of the month: last month's total in the personal space vs the month before.
exports.monthlySummary = onSchedule(
  { schedule: '0 9 1 * *', timeZone: TZ, region: SCHEDULE_REGION, memory: '256MiB', timeoutSeconds: 300 },
  async () => {
    const today = jerusalemToday();
    const last = new Date(today.y, today.m - 1, 1);
    const before = new Date(today.y, today.m - 2, 1);
    const a = lib.monthRange(last.getFullYear(), last.getMonth());
    const b = lib.monthRange(before.getFullYear(), before.getMonth());
    const users = await db.collection('users').listDocuments();
    let sent = 0;
    for (const userRef of users) {
      try {
        const uid = userRef.id;
        const s = await settingsOf(uid);
        if (s.monthlySummary === false) continue;
        const owned = await db.collection('lists').where('ownerUid', '==', uid).get();
        const personal = owned.docs.find((d) => (d.data().kind || 'personal') !== 'shared');
        if (!personal) continue;
        const sumIn = async (r) => lib.sumAmounts((await personal.ref.collection('items')
          .where('date', '>=', r.from).where('date', '<=', r.to).get()).docs.map((d) => d.data()));
        const subs = s.includeSubsInBudget !== false
          ? lib.subsMonthly((await userRef.collection('payments').get()).docs.map((d) => d.data())) : 0;
        const spent = await sumIn(a);
        if (spent <= 0) continue;
        const prevSpent = await sumIn(b);
        const msg = lib.summaryMessage(last.getMonth(), spent + subs, prevSpent > 0 ? prevSpent + subs : 0);
        sent += await sendToUser(uid, { ...msg, channel: 'monthly-summary', data: { tab: 'summary' } });
      } catch (err) {
        logger.error(`summary failed uid=${userRef.id}`, err);
      }
    }
    logger.info(`monthly summary ${a.key} sent=${sent}`);
  }
);
