// Cloud Function: scheduled daily payment reminders via FCM.
//
// Runs every hour (Asia/Jerusalem). For each user whose notifTime matches the
// current hour, scans their payments and pushes a reminder for any due in
// {7, 3, 1, 0} days (based on their notifTimings setting).
//
// Schema read:
//   users/{uid}/settings/main  → { notif, notifTimings[], notifTime, fcmToken }
//   users/{uid}/payments/*     → { serviceId|customService, price, currency, nextDate }
//
// Free-tier costs (single user, hourly cron): ~720 invocations/month — well
// under the 2M free Cloud Functions tier.

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { logger } = require('firebase-functions');

initializeApp();
const db = getFirestore();
const fcm = getMessaging();

const TIMING_DAYS = { week: 7, three: 3, day: 1, same: 0 };

// Minimal service-name lookup. The client stores serviceId (catalog) or
// customService (inline). For catalog IDs we keep a short Hebrew label here so
// notifications are readable; anything missing falls back to the raw id.
const SERVICE_NAMES = {
  netflix: 'Netflix', spotify: 'Spotify', ytpremium: 'YouTube Premium',
  disney: 'Disney+', applemusic: 'Apple Music', appletv: 'Apple TV+', icloud: 'iCloud+',
  partner: 'פרטנר', cellcom: 'סלקום', pelephone: 'פלאפון', hotmobile: 'הוט מובייל', golan: 'גולן טלקום',
  bezeq: 'בזק', hot: 'הוט', yes: 'YES', cellcomtv: 'סלקום TV',
  chatgpt: 'ChatGPT Plus', claude: 'Claude', figma: 'Figma', adobe: 'Adobe CC',
  github: 'GitHub Pro', notion: 'Notion', linear: 'Linear',
  ins_car: 'ביטוח רכב', ins_home: 'ביטוח דירה', ins_health: 'ביטוח בריאות', ins_life: 'ביטוח חיים',
  electric: 'חשמל', water: 'מים', arnona: 'ארנונה', gas: 'גז', vaad: 'ועד בית',
  holmes: 'Holmes Place', goactive: 'Go Active', sport: 'חוגי ספורט',
  nyt: 'NY Times', parking: 'חניה', haaretz: 'הארץ דיגיטל', rav: 'רב-קו',
};

function serviceName(payment) {
  return payment.customService?.name || SERVICE_NAMES[payment.serviceId] || payment.serviceId || 'תשלום';
}

function fmtMoney(amount, cur) {
  const n = Number(amount || 0);
  const s = n.toLocaleString('he-IL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `${cur || '₪'}${s}`;
}

function whenLabel(diff) {
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff > 1) return `בעוד ${diff} ימים`;
  return '';
}

exports.paymentReminders = onSchedule(
  {
    schedule: '0 * * * *', // top of every hour
    timeZone: 'Asia/Jerusalem',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async () => {
    // Current hour in Asia/Jerusalem, as "HH"
    const now = new Date();
    const hourStr = now.toLocaleString('en-GB', {
      hour: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem',
    }).slice(0, 2);

    // "Today" anchored to Jerusalem
    const jerToday = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    jerToday.setHours(0, 0, 0, 0);

    const usersSnap = await db.collection('users').listDocuments();
    logger.info(`Reminder tick — hour=${hourStr}, users=${usersSnap.length}`);

    let sent = 0;
    for (const userRef of usersSnap) {
      try {
        const settingsSnap = await userRef.collection('settings').doc('main').get();
        const settings = settingsSnap.data() || {};
        if (!settings.notif) continue;
        if (!settings.fcmToken) continue;
        const timings = settings.notifTimings || [];
        if (!timings.length) continue;
        // Match user's notifTime hour to the current tick
        const userHour = (settings.notifTime || '09:00').split(':')[0].padStart(2, '0');
        if (userHour !== hourStr) continue;

        const paymentsSnap = await userRef.collection('payments').get();
        const reminders = [];
        paymentsSnap.forEach((pDoc) => {
          const p = pDoc.data();
          if (!p.nextDate) return;
          const due = new Date(p.nextDate); due.setHours(0, 0, 0, 0);
          const diff = Math.round((due - jerToday) / 86400000);
          for (const timing of timings) {
            if (diff === TIMING_DAYS[timing]) {
              reminders.push({ p, diff, timing });
              break;
            }
          }
        });

        for (const { p, diff } of reminders) {
          const title = `תזכורת תשלום: ${serviceName(p)}`;
          const body = `${whenLabel(diff)} · ${fmtMoney(p.price, p.currency)}`;
          try {
            await fcm.send({
              token: settings.fcmToken,
              notification: { title, body },
              webpush: {
                fcmOptions: { link: '/payments.html' },
                notification: { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', dir: 'rtl', lang: 'he' },
              },
              data: { paymentId: p.id || '', diff: String(diff) },
            });
            sent++;
          } catch (err) {
            logger.warn(`FCM send failed uid=${userRef.id} code=${err.code}`);
            if (
              err.code === 'messaging/registration-token-not-registered' ||
              err.code === 'messaging/invalid-registration-token'
            ) {
              await userRef.collection('settings').doc('main').update({
                fcmToken: FieldValue.delete(),
              });
            }
          }
        }
      } catch (err) {
        logger.error(`User ${userRef.id} failed`, err);
      }
    }
    logger.info(`Reminder tick complete — sent=${sent}`);
  }
);
