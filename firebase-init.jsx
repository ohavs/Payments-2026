// Firebase wiring — Auth (Google + anonymous fallback) + Firestore hooks.
//
// Schema:
//   users/{uid}/settings/main        — single settings document
//   users/{uid}/payments/{paymentId} — one document per tracked payment

const fbAuth = window.firebase ? firebase.auth() : null;
const fbDb = window.firebase ? firebase.firestore() : null;

// Enable persistence (offline cache + PWA reliability). Failures are non-fatal
// (multi-tab still works; we just don't get the persistent cache).
if (fbDb) {
  fbDb.enablePersistence({ synchronizeTabs: true }).catch(() => {});
}

// React hook: returns the current auth state.
//   { user, loading, signInGoogle, signInAnonymous, signOut }
function useAuthUser() {
  const [user, setUser] = React.useState(() => fbAuth?.currentUser || null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!fbAuth) { setLoading(false); return; }
    const unsub = fbAuth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInGoogle = React.useCallback(async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return fbAuth.signInWithPopup(provider);
  }, []);

  const signInAnonymous = React.useCallback(() => fbAuth.signInAnonymously(), []);

  const signOut = React.useCallback(() => fbAuth.signOut(), []);

  return { user, loading, signInGoogle, signInAnonymous, signOut };
}

// React hook: subscribe to /users/{uid}/payments.
//   [payments, { add, update, remove }, { loading }]
function usePayments(uid) {
  const [payments, setPayments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!uid) { setPayments([]); setLoading(false); return; }
    setLoading(true);
    const unsub = fbDb.collection('users').doc(uid).collection('payments')
      .onSnapshot((snap) => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPayments(rows);
        setLoading(false);
      }, (err) => { console.error('payments subscribe error', err); setLoading(false); });
    return () => unsub();
  }, [uid]);

  const ops = React.useMemo(() => {
    if (!uid) return { add: async () => {}, update: async () => {}, remove: async () => {} };
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

  return [payments, ops, { loading }];
}

const DEFAULT_SETTINGS = {
  userName: '',
  notif: true,
  notifTimings: ['three', 'day'],
  notifTime: '09:00',
  monthlySummary: true,
  theme: 'light',
  language: 'he',
  defaultCurrency: '₪',
  // Budget tool: monthly income + a spending ceiling for tracked expenses.
  // includeSubsInBudget counts recurring payments' monthly equivalent as
  // committed spend, so the ceiling reflects true monthly outflow.
  monthlyIncome: 0,
  monthlyCap: 0,
  includeSubsInBudget: true,
  categoryCaps: {},
};

function useFirebaseSettings(uid, fallbackName) {
  const [settings, setSettingsState] = React.useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    const ref = fbDb.collection('users').doc(uid).collection('settings').doc('main');
    const unsub = ref.onSnapshot((snap) => {
      if (snap.exists) {
        setSettingsState({ ...DEFAULT_SETTINGS, ...snap.data() });
      } else {
        const seed = { ...DEFAULT_SETTINGS, userName: fallbackName || '' };
        ref.set(seed).catch(e => console.error('settings seed', e));
        setSettingsState(seed);
      }
      setLoading(false);
    }, (err) => { console.error('settings subscribe error', err); setLoading(false); });
    return () => unsub();
  }, [uid, fallbackName]);

  const setSettings = React.useCallback((next) => {
    setSettingsState(next);
    if (uid) {
      fbDb.collection('users').doc(uid).collection('settings').doc('main')
        .set(next, { merge: true }).catch(e => console.error('settings save', e));
    }
  }, [uid]);

  return [settings, setSettings, { loading }];
}

Object.assign(window, { fbAuth, fbDb, useAuthUser, usePayments, useFirebaseSettings });
