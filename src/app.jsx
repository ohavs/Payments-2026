// Main app shell — auth gate, theme, tabs, the + button and app-wide sheets.
import React, { useEffect, useMemo, useState } from 'react';
import { LoginScreen } from './auth.jsx';
import { FeedbackProvider, FullScreenLoader, useConfirm, useToast } from './feedback.jsx';
import { useAuthUser, useFirebaseSettings, usePayments } from './firebase-init.jsx';
import { DEFAULT_CATEGORIES, isSharedList, useLists, useSpaceSubs } from './lists.jsx';
import { notifPermission, registerFcmToken, scanForReminders } from './notifications.jsx';
import { QuickAddSheet } from './quick-add.jsx';
import { ExpensesScreen } from './screens/expenses.jsx';
import { SubscriptionsScreen } from './screens/subscriptions.jsx';
import { SettingsScreen } from './screens.jsx';
import { SharedSpaceSheet } from './spaces.jsx';
import { AddSheet, DetailSheet, EditCustomSheet } from './sheets.jsx';
import { NavIcon } from './ui/icons.jsx';
import { UpdateSheet } from './update-sheet.jsx';
import { haptic, setBaseBackHandler, setStatusBarTheme } from './lib/platform.js';
import { checkForUpdateQuietly } from './lib/updater.js';

// 'system' follows the phone; 'light' / 'dark' are explicit choices.
function useTheme(pref) {
  const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [systemDark, setSystemDark] = useState(() => !!query?.matches);
  useEffect(() => {
    if (!query) return;
    const onChange = (e) => setSystemDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const dark = pref === 'dark' || ((!pref || pref === 'system') && systemDark);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dir = 'rtl';
    root.lang = 'he';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0F0F11' : '#F6F6F3');
    setStatusBarTheme(dark);
  }, [dark]);
}

function AppInner() {
  const { user, loading: authLoading, signInGoogle, signInAnonymous, signOut } = useAuthUser();
  const toast = useToast();
  const confirm = useConfirm();

  // Firestore data, scoped to the signed-in user.
  const [payments, paymentOps, { loading: paymentsLoading }] = usePayments(user?.uid);
  const [settings, setSettings, { loading: settingsLoading }] = useFirebaseSettings(user?.uid, user?.displayName);
  const lists = useLists(user?.uid, user);
  const categories = lists.activeList?.groups?.length ? lists.activeList.groups : DEFAULT_CATEGORIES;

  // The active space drives the whole app. A shared space has its own
  // subscriptions (lists/{id}/subs) and its own budget (list.budget); the
  // personal space uses users/{uid}/payments and the user's settings.
  const activeShared = isSharedList(lists.activeList);
  const sharedIds = useMemo(() => lists.spaces.filter(isSharedList).map((l) => l.id), [lists.spaces]);
  const spaceSubs = useSpaceSubs(sharedIds);
  const subs = activeShared ? (spaceSubs.byList[lists.activeListId] || []) : payments;
  const subsLoading = activeShared ? !spaceSubs.loaded[lists.activeListId] : paymentsLoading;
  const subOps = activeShared ? spaceSubs.opsFor(lists.activeListId) : paymentOps;
  const allSubs = useMemo(
    () => [...payments, ...sharedIds.flatMap((id) => spaceSubs.byList[id] || [])],
    [payments, sharedIds, spaceSubs.byList]
  );
  const spaceSettings = activeShared
    ? { ...settings, monthlyCap: 0, monthlyIncome: 0, includeSubsInBudget: true, categoryCaps: {}, ...(lists.activeList.budget || {}) }
    : settings;
  const setSpaceSettings = activeShared
    ? (next) => lists.ops.setBudget(lists.activeListId, {
        monthlyCap: Number(next.monthlyCap) || 0,
        monthlyIncome: Number(next.monthlyIncome) || 0,
        includeSubsInBudget: next.includeSubsInBudget !== false,
        categoryCaps: next.categoryCaps || {},
      })
    : setSettings;

  const [tab, setTab] = useState('expenses');
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickCategory, setQuickCategory] = useState(null);
  const [detail, setDetail] = useState(null);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [editCustom, setEditCustom] = useState(null);
  const [update, setUpdate] = useState(null);       // latest release info, when newer
  const [updateOpen, setUpdateOpen] = useState(false);
  const [sharedOpen, setSharedOpen] = useState(false);

  useTheme(user ? settings.theme : 'system');

  // Android back with no sheet open: other tab → expenses tab → exit app.
  useEffect(() => {
    setBaseBackHandler(() => {
      if (tab !== 'expenses') { setTab('expenses'); return true; }
      return false;
    });
  }, [tab]);

  // Quietly look for a newer APK on launch (Android, at most every 6 hours).
  useEffect(() => {
    if (!user) return;
    checkForUpdateQuietly().then((r) => { if (r?.available) setUpdate(r); });
  }, [user?.uid]);

  // On payments/settings change, scan for upcoming reminders
  useEffect(() => {
    if (!user || paymentsLoading || settingsLoading) return;
    scanForReminders(allSubs, settings);
  }, [user?.uid, allSubs.length, settings?.notif, settingsLoading, paymentsLoading]);

  // Re-register FCM token on app load if notification permission is already granted
  // (handles new device, token expiry, etc.)
  useEffect(() => {
    if (!user || settingsLoading) return;
    if (notifPermission() === 'granted') registerFcmToken(user.uid);
  }, [user?.uid, settingsLoading]);

  // Titles used recently — one-tap fill in quick add.
  const recentTitles = useMemo(() => {
    const seen = [];
    lists.items.forEach((it) => {
      const t = (it.title || '').trim();
      if (t && !seen.includes(t)) seen.push(t);
    });
    return seen.slice(0, 8);
  }, [lists.items]);

  // Handlers — write through to Firestore + toast feedback
  const savePayment = async (p) => {
    try { await subOps.update(p); toast('השינויים נשמרו', { type: 'success' }); }
    catch (e) { toast('שגיאה בשמירה', { type: 'error' }); }
  };
  const deletePayment = async (id) => {
    try { await subOps.remove(id); setDetail(null); toast('התשלום נמחק', { type: 'success' }); }
    catch (e) { toast('שגיאה במחיקה', { type: 'error' }); }
  };
  const addPayment = async (p) => {
    try { await subOps.add(p); toast(activeShared ? `המנוי נוסף ל${lists.activeList?.name || 'מרחב המשותף'}` : 'המנוי נוסף', { type: 'success' }); }
    catch (e) { toast('שגיאה בהוספה', { type: 'error' }); }
  };
  const addExpense = async (item) => {
    try {
      await lists.ops.addItem(lists.activeListId, item);
      haptic('success');
    } catch (e) { toast('שגיאה בהוספה', { type: 'error' }); }
  };
  const openQuickAdd = (category = null) => { haptic('press'); setQuickCategory(category); setQuickOpen(true); };
  const handleSignOut = async () => {
    const ok = await confirm({
      title: 'התנתקות',
      message: 'הנתונים נשמרים בענן וייטענו מחדש בכניסה הבאה',
      confirmLabel: 'התנתק',
    });
    if (!ok) return;
    try { await signOut(); toast('התנתקת', { type: 'info' }); }
    catch (e) { toast('שגיאה בהתנתקות', { type: 'error' }); }
  };

  if (authLoading) return <FullScreenLoader />;
  if (!user) return <LoginScreen onSignInGoogle={signInGoogle} onSignInAnonymous={signInAnonymous} />;

  return (
    <div style={{
      width: '100%', minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)',
      display: 'flex', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 480, height: '100vh', position: 'relative',
        background: 'var(--bg)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        // Android draws edge-to-edge: keep content clear of the status bar.
        paddingTop: 'env(safe-area-inset-top)',
      }} data-screen-label={`tab: ${tab}`}>
        <main key={tab} className="screen-in hide-scroll" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        }}>
          {tab === 'expenses' && (
            <ExpensesScreen
              lists={lists}
              categories={categories}
              payments={subs}
              settings={spaceSettings}
              setSettings={setSpaceSettings}
              onQuickAdd={openQuickAdd}
              onCreateShared={() => setSharedOpen(true)}
            />
          )}
          {tab === 'subs' && (
            <SubscriptionsScreen
              payments={subs}
              loading={subsLoading}
              lists={lists}
              onCreateShared={() => setSharedOpen(true)}
              settings={settings}
              onOpenPayment={(p) => setDetail(p)}
              onOpenAdd={() => setAddSubOpen(true)}
            />
          )}
          {tab === 'settings' && (
            <SettingsScreen
              user={user}
              settings={settings}
              setSettings={setSettings}
              lists={lists}
              categories={categories}
              payments={payments}
              onSignOut={handleSignOut}
              onOpenUpdates={() => setUpdateOpen(true)}
            />
          )}
        </main>

        {update && !updateOpen && (
          <button onClick={() => setUpdateOpen(true)} className="rise" style={{
            position: 'absolute', top: 'calc(10px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)',
            zIndex: 60, border: 'none', cursor: 'pointer', borderRadius: 999, padding: '10px 18px',
            background: 'var(--ink)', color: 'var(--bg)', fontFamily: 'inherit', fontWeight: 800, fontSize: 13.5,
            boxShadow: 'var(--shadow-float)', whiteSpace: 'nowrap',
          }}>
            גרסה {update.latest.versionName} זמינה · עדכן
          </button>
        )}

        <TabBar tab={tab} setTab={setTab} onAdd={() => openQuickAdd()} addOpen={quickOpen} />

        <QuickAddSheet
          open={quickOpen}
          onClose={() => setQuickOpen(false)}
          categories={categories}
          defaultCategory={quickCategory}
          recentTitles={recentTitles}
          canSave={!!lists.activeListId}
          list={activeShared ? lists.activeList : null}
          onAdd={addExpense}
          onAddSubscription={() => { setQuickOpen(false); setTimeout(() => setAddSubOpen(true), 260); }}
        />
        <DetailSheet
          payment={detail}
          open={!!detail}
          onClose={() => setDetail(null)}
          onSave={savePayment}
          onDelete={deletePayment}
          onEditCustom={(p) => { setDetail(null); setEditCustom(p); }}
        />
        <AddSheet
          open={addSubOpen}
          onClose={() => setAddSubOpen(false)}
          onAdd={addPayment}
        />
        <EditCustomSheet
          payment={editCustom}
          open={!!editCustom}
          onClose={() => setEditCustom(null)}
          onSave={(p) => { savePayment(p); setEditCustom(null); }}
        />
        <UpdateSheet open={updateOpen} onClose={() => setUpdateOpen(false)} initial={update} />
        <SharedSpaceSheet open={sharedOpen} onClose={() => setSharedOpen(false)} lists={lists} />
      </div>
    </div>
  );
}

function App() {
  return (
    <FeedbackProvider>
      <AppInner />
    </FeedbackProvider>
  );
}

// Bottom bar: הוצאות · מנויים · (+) · הגדרות. Inactive icons go grey; the
// active one pops in colour with a dot under its label.
function TabBar({ tab, setTab, onAdd, addOpen }) {
  const item = (id, label) => {
    const on = tab === id;
    return (
      <button key={id} onClick={() => { if (!on) { haptic('tap'); setTab(id); } }} aria-label={label}
        aria-current={on ? 'page' : undefined} style={{
          flex: 1, border: 'none', background: 'transparent', padding: '10px 0 0', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontFamily: 'inherit',
        }}>
        <span key={on ? 'on' : 'off'} className={on ? 'pop' : undefined} style={{ display: 'flex' }}>
          <NavIcon name={id} active={on} size={28} />
        </span>
        <span style={{ fontSize: 12.5, fontWeight: on ? 800 : 600, color: on ? 'var(--ink)' : 'var(--ink-dim)' }}>{label}</span>
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: 'var(--ink)',
          transform: on ? 'scale(1)' : 'scale(0)', transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)',
        }} />
      </button>
    );
  };
  return (
    <nav aria-label="ניווט ראשי" style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 50,
      background: 'var(--surface-1)', borderRadius: '28px 28px 0 0',
      boxShadow: '0 -8px 30px rgba(20,20,20,.08)',
      display: 'flex', alignItems: 'flex-start', padding: '0 8px',
      height: 'calc(78px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {item('expenses', 'הוצאות')}
      {item('subs', 'מנויים')}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <button onClick={onAdd} aria-label="הוספת הוצאה" className="btn-primary" style={{
          width: 64, height: 64, marginTop: -24, borderRadius: '50%', borderWidth: 3, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ display: 'flex', transform: addOpen ? 'rotate(45deg)' : 'none', transition: 'transform .45s cubic-bezier(.34,1.56,.64,1)' }}>
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
              <path d="M12 4.5v15M4.5 12h15" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      </div>
      {item('settings', 'הגדרות')}
    </nav>
  );
}

export { App };
