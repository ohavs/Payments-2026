// Firebase wiring — uses the auto-config served by Firebase Hosting at
// /__/firebase/init.js (no manual apiKey needed when deployed via Hosting).
//
// Schema:
//   users/{uid}/settings/main        — single settings document
//   users/{uid}/payments/{paymentId} — one document per tracked payment
//
// Anonymous auth: each browser gets its own uid, persisted in localStorage by Firebase.
// To upgrade to email/google login later, swap signInAnonymously for a real provider.

(function () {
  if (!window.firebase) {
    console.error('Firebase SDK not loaded');
    return;
  }
  // firebase.initializeApp is called automatically by /__/firebase/init.js on Hosting.
  // For local dev outside Hosting, you'd need to call initializeApp manually with config.
  if (firebase.apps.length === 0) {
    console.warn('Firebase not initialized — make sure /__/firebase/init.js loaded (only works under Firebase Hosting).');
    return;
  }
})();

const fbAuth = window.firebase ? firebase.auth() : null;
const fbDb = window.firebase ? firebase.firestore() : null;

// Promise that resolves to the signed-in user. Triggers anonymous sign-in if needed.
const fbUserReady = new Promise((resolve) => {
  if (!fbAuth) { resolve(null); return; }
  fbAuth.onAuthStateChanged((u) => {
    if (u) resolve(u);
    else fbAuth.signInAnonymously().catch((e) => {
      console.error('Anonymous sign-in failed', e);
      resolve(null);
    });
  });
});

// React hook: subscribe to /users/{uid}/payments. Returns [payments, { add, update, remove }].
function usePayments() {
  const [payments, setPayments] = React.useState([]);
  const [uid, setUid] = React.useState(null);

  React.useEffect(() => {
    let unsub = null;
    fbUserReady.then((u) => {
      if (!u) return;
      setUid(u.uid);
      unsub = fbDb.collection('users').doc(u.uid).collection('payments')
        .onSnapshot((snap) => {
          const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setPayments(rows);
        }, (err) => console.error('payments subscribe error', err));
    });
    return () => { if (unsub) unsub(); };
  }, []);

  const ops = React.useMemo(() => {
    if (!uid) return { add: () => {}, update: () => {}, remove: () => {} };
    const col = fbDb.collection('users').doc(uid).collection('payments');
    return {
      add: (p) => {
        const { id, ...data } = p;
        const ref = id ? col.doc(id) : col.doc();
        return ref.set({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      },
      update: (p) => {
        const { id, ...data } = p;
        return col.doc(id).set(data, { merge: true });
      },
      remove: (id) => col.doc(id).delete(),
    };
  }, [uid]);

  return [payments, ops, uid];
}

// React hook: subscribe to /users/{uid}/settings/main. Returns [settings, setSettings].
const DEFAULT_SETTINGS = {
  userName: '',
  notif: true,
  notifTimings: ['three', 'day'],
  notifTime: '09:00',
  monthlySummary: true,
  theme: 'light',
  language: 'he',
  defaultCurrency: '₪',
};

function useFirebaseSettings() {
  const [settings, setSettingsState] = React.useState(DEFAULT_SETTINGS);
  const [uid, setUid] = React.useState(null);

  React.useEffect(() => {
    let unsub = null;
    fbUserReady.then((u) => {
      if (!u) return;
      setUid(u.uid);
      const ref = fbDb.collection('users').doc(u.uid).collection('settings').doc('main');
      unsub = ref.onSnapshot((snap) => {
        if (snap.exists) setSettingsState({ ...DEFAULT_SETTINGS, ...snap.data() });
        else ref.set(DEFAULT_SETTINGS);
      }, (err) => console.error('settings subscribe error', err));
    });
    return () => { if (unsub) unsub(); };
  }, []);

  const setSettings = React.useCallback((next) => {
    setSettingsState(next);
    if (uid) {
      fbDb.collection('users').doc(uid).collection('settings').doc('main')
        .set(next, { merge: true }).catch(e => console.error('settings save', e));
    }
  }, [uid]);

  return [settings, setSettings];
}

Object.assign(window, { fbAuth, fbDb, fbUserReady, usePayments, useFirebaseSettings });
