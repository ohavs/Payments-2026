// The home screen widget (Android): the app tells it who is signed in and the
// spaces with their categories, and saves what the widget couldn't send
// offline. The widget itself writes to Firestore as the user (see
// android/.../widget/FirestoreRest.java).
import { registerPlugin } from '@capacitor/core';
import firebase from './firebase.js';
import { isNative } from './platform.js';

const WidgetBridge = registerPlugin('WidgetBridge');
const enabled = isNative && !import.meta.env.VITE_USE_EMULATORS;

// spaces: [{ id, name, shared, groups }]; palette: the app's colours (Settings > מראה)
export async function syncWidget({ spaces, activeSpaceId, currency, palette }) {
  const user = firebase.auth().currentUser;
  if (!enabled || !user) return;
  const { apiKey, projectId } = firebase.app().options;
  try {
    await WidgetBridge.sync({ uid: user.uid, refreshToken: user.refreshToken, apiKey, projectId, currency, palette, activeSpaceId, spaces });
  } catch (e) { console.error('widget sync', e); }
}

export async function clearWidget() {
  if (!enabled) return;
  try { await WidgetBridge.clear(); } catch (e) { /* no widget */ }
}

// [{ listId, item }] saved on the widget while offline; removed there now.
export async function takeWidgetPending() {
  if (!enabled) return [];
  try { return (await WidgetBridge.takePending()).items || []; } catch (e) { return []; }
}

export async function widgetStatus() {
  if (!enabled) return { count: 0, pinSupported: false };
  try { return await WidgetBridge.status(); } catch (e) { return { count: 0, pinSupported: false }; }
}

// Asks the launcher to place the widget (Android 8+). false when it can't.
export async function pinWidget() {
  if (!enabled) return false;
  try { return (await WidgetBridge.pin()).ok; } catch (e) { return false; }
}
