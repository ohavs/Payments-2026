// Push from the server (FCM): a partner's expense in a shared space, the
// monthly summary, budget alerts. Each device registers under
// users/{uid}/devices/{deviceId}; Cloud Functions send to every device.
// Payment reminders don't come from here on Android: they're scheduled on the
// phone (reminders.js), so `localReminders: true` keeps the server from
// sending duplicates.
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { LocalNotifications } from '@capacitor/local-notifications';
import firebase from './firebase.js';
import { isNative } from './platform.js';

export const PUSH_CHANNELS = [
  { id: 'shared-activity', name: 'פעילות במרחב המשותף', description: 'כשמישהו מוסיף הוצאה למרחב משותף' },
  { id: 'budget', name: 'תקציב', description: 'כשמתקרבים לתקרה החודשית או עוברים אותה' },
  { id: 'monthly-summary', name: 'סיכום חודשי', description: 'בתחילת כל חודש' },
];

export function deviceId() {
  try {
    let id = localStorage.getItem('device-id');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem('device-id', id);
    }
    return id;
  } catch (e) { return 'unknown'; }
}

export function saveDevice(uid, token, platform) {
  if (!uid || !token) return Promise.resolve();
  return firebase.firestore().collection('users').doc(uid).collection('devices').doc(deviceId()).set({
    token, platform, localReminders: platform === 'android',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

let channelsReady = null;
function ensureChannels() {
  if (!channelsReady) {
    channelsReady = Promise.all(PUSH_CHANNELS.map((c) =>
      FirebaseMessaging.createChannel({ ...c, importance: 4, visibility: 1, vibration: true }).catch(() => {})));
  }
  return channelsReady;
}

// Android: once notifications are allowed, register this phone for push.
export async function registerNativePush(uid) {
  if (!isNative || !uid) return null;
  try {
    const { receive } = await FirebaseMessaging.checkPermissions();
    if (receive !== 'granted') return null;
    await ensureChannels();
    const { token } = await FirebaseMessaging.getToken();
    await saveDevice(uid, token, 'android');
    return token;
  } catch (e) { console.error('push registration failed', e); return null; }
}

// While the app is open Android doesn't show FCM notifications itself;
// show them as local ones so a partner's expense still pops up.
let foregroundBound = false;
export function bindForegroundPush() {
  if (!isNative || foregroundBound) return;
  foregroundBound = true;
  FirebaseMessaging.addListener('notificationReceived', ({ notification }) => {
    if (!notification?.title) return;
    LocalNotifications.schedule({
      notifications: [{
        id: Math.floor(Math.random() * 1e9), title: notification.title, body: notification.body || '',
        channelId: notification.data?.channel || 'shared-activity', smallIcon: 'ic_stat_notify', iconColor: '#22A45D',
        extra: notification.data || {},
      }],
    }).catch(() => {});
  });
  FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
    const uid = firebase.auth().currentUser?.uid;
    if (uid) saveDevice(uid, token, 'android').catch(() => {});
  });
}

// Tapping a push opens the tab it points at.
export function onPushTap(fn) {
  if (!isNative) return () => {};
  const h = FirebaseMessaging.addListener('notificationActionPerformed', (e) => fn(e.notification?.data || {}));
  return () => { h.then((x) => x.remove()); };
}
