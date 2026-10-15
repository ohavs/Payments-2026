// Main app shell — auth gate, theme, tabs, the + button and app-wide sheets.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LoginScreen } from './auth.jsx';
import { FeedbackProvider, FullScreenLoader, useConfirm, useToast } from './feedback.jsx';
import { fmtMoney } from './data.jsx';
import { useExchangeRates } from './fx.jsx';
import { useAuthUser, useFirebaseSettings, usePayments } from './firebase-init.jsx';
import { DEFAULT_CATEGORIES, isSharedList, useLists, useSpaceSubs } from './lists.jsx';
import { notifPermission, registerFcmToken, scanForReminders } from './notifications.jsx';
import { QuickAddSheet } from './quick-add.jsx';
import { ExpensesScreen } from './screens/expenses.jsx';
import { SubscriptionsScreen } from './screens/subscriptions.jsx';
import { SummaryScreen } from './screens/summary.jsx';
import { SettingsScreen } from './screens.jsx';
import { SharedSpaceSheet } from './spaces.jsx';
import { AddSheet, DetailSheet, EditCustomSheet } from './sheets.jsx';
import { GmailScanSheet, SuggestionsCard, useDetectedSuggestions, useGmailInbox } from './suggestions.jsx';
import { listSuggestions, onDetectEvent, suggestionToItem, takeLaunchAction } from './lib/detect.js';
import { NavIcon } from './ui/icons.jsx';
import { UpdateSheet } from './update-sheet.jsx';
import { haptic, isNative, setBaseBackHandler, setStatusBarTheme } from './lib/platform.js';
import { ensureNativeNotifPermission, onReminderTap, syncReminders } from './lib/reminders.js';
import { bindForegroundPush, onPushTap, registerNativePush } from './lib/push.js';
import { App as CapApp } from '@capacitor/app';
import { checkForUpdateQuietly } from './lib/updater.js';
import { clearWidget, syncWidget, takeWidgetPending } from './lib/widget.js';
import { applyPalette } from './lib/palette.js';
import { validPalette } from './lib/app-icons.js';

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

  // Home screen widget: who is signed in, the spaces and their categories.
  // The label is what the app's space switcher shows ("אישי", or names).
  const widgetSpaces = useMemo(() => {
    const personal = lists.spaces.filter((l) => !isSharedList(l)).length;
    return JSON.stringify(lists.spaces.map((l) => ({
      id: l.id, name: l.name || '', shared: isSharedList(l), groups: l.groups?.length ? l.groups : DEFAULT_CATEGORIES,
      label: isSharedList(l) ? (l.name || 'משותף') : (personal > 1 ? (l.name || 'אישי') : 'אישי'),
    })));
  }, [lists.spaces]);
  useEffect(() => {
    if (!isNative) return;
    if (!user) { if (!authLoading) clearWidget(); return; }
    if (!lists.spaces.length) return;
    syncWidget({
      spaces: JSON.parse(widgetSpaces), activeSpaceId: lists.activeListId,
      currency: settings.defaultCurrency || '₪', palette: validPalette(settings.palette),
    });
  }, [user?.uid, authLoading, widgetSpaces, lists.activeListId, settings.defaultCurrency, settings.palette]);
  // Expenses the widget saved without a connection.
  const hasSpaces = lists.spaces.length > 0;
  useEffect(() => {
    if (!isNative || !user || !hasSpaces) return undefined;
    const flush = async () => {
      for (const { listId, item } of await takeWidgetPending()) {
        try { await lists.ops.addItem(listId, item); } catch (e) { console.error('widget expense', e); }
      }
    };
    flush();
    const h = CapApp.addListener('resume', flush);
    return () => { h.then((x) => x.remove()); };
  }, [user?.uid, hasSpaces]);

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

  const gmailInbox = useGmailInbox({ enabled: !!user && !user.isAnonymous, items: lists.items, subs: allSubs });
  const [tab, setTab] = useState('expenses');
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickCategory, setQuickCategory] = useState(null);
  const [detail, setDetail] = useState(null);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [editCustom, setEditCustom] = useState(null);
  const [update, setUpdate] = useState(null);       // latest release info, when newer
  const [updateOpen, setUpdateOpen] = useState(false);
  const [sharedOpen, setSharedOpen] = useState(false);
  const [quickPrefill, setQuickPrefill] = useState(null);
  const [gmailOpen, setGmailOpen] = useState(false);
  const fx = useExchangeRates();
  const detected = useDetectedSuggestions(isNative && !!user);

  useTheme(user ? settings.theme : 'system');
  // Palette: from the settings once loaded (another phone may have changed it).
  useEffect(() => {
    if (user && !settingsLoading && settings.palette) applyPalette(settings.palette);
  }, [user?.uid, settingsLoading, settings.palette]);

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

  // Reminders. Android: schedule the coming weeks on the phone, again on every
  // change and every return to the app. Web: scan on load and register for push.
  const reminderKey = `${(settings.notifTimings || []).join(',')}|${settings.notifTime}|${settings.notif}|` +
    allSubs.map((p) => `${p.id}:${p.nextDate}:${p.cycle}:${p.price}`).join(',');
  useEffect(() => {
    if (!user || paymentsLoading || settingsLoading) return;
    if (isNative) {
      // Reminders were on before the app could post notifications itself
      // (Android 13+): ask once, then schedule.
      const ask = settings.notif && !localStorage.getItem('notif-asked')
        ? (localStorage.setItem('notif-asked', '1'), ensureNativeNotifPermission().catch(() => {}))
        : Promise.resolve();
      ask.then(() => syncReminders(allSubs, settings));
    } else scanForReminders(allSubs, settings);
  }, [user?.uid, reminderKey, settingsLoading, paymentsLoading]);
  useEffect(() => {
    if (!isNative || !user || paymentsLoading || settingsLoading) return;
    const h = CapApp.addListener('resume', () => syncReminders(allSubs, settings));
    return () => { h.then((x) => x.remove()); };
  }, [user?.uid, reminderKey, settingsLoading, paymentsLoading]);
  useEffect(() => onReminderTap((extra) => { if (extra.tab) setTab(extra.tab); }), []);
  useEffect(() => onPushTap((data) => { if (data.tab) setTab(data.tab); }), []);
  // Android: register for server push (partner activity, budget, summary).
  useEffect(() => {
    if (!isNative || !user || settingsLoading) return;
    bindForegroundPush();
    registerNativePush(user.uid);
  }, [user?.uid, settingsLoading, settings.notif]);

  // Re-register FCM token on app load if notification permission is already granted
  // (handles new device, token expiry, etc.)
  useEffect(() => {
    if (isNative || !user || settingsLoading) return;
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
  const openQuickAdd = (category = null) => { haptic('press'); setQuickPrefill(null); setQuickCategory(category); setQuickOpen(true); };

  // Detected payments → expenses in the active space.
  const toItem = (s) => suggestionToItem(s, {
    categories, items: lists.items, currency: spaceSettings.defaultCurrency || '₪', rates: fx?.rates,
  });
  const addSuggestions = async (list) => {
    if (!list.length || !lists.activeListId) return;
    try {
      const added = [];
      for (const s of list) { const item = toItem(s); await lists.ops.addItem(lists.activeListId, item); added.push(item); }
      removeSuggestions(list.map((s) => s.id));
      haptic('success');
      toast(added.length === 1 ? `נוספה הוצאה · ${fmtMoney(added[0].amount)} · ${added[0].title}` : `נוספו ${added.length} הוצאות`, { type: 'success' });
    } catch (e) { toast('שגיאה בהוספה', { type: 'error' }); }
  };
  // Wallet / card suggestions live on the phone; Gmail ones from before the
  // background check in the Gmail inbox.
  const removeSuggestions = (ids) => {
    const gmail = ids.filter((id) => String(id).startsWith('gmail:'));
    const native = ids.filter((id) => !String(id).startsWith('gmail:'));
    // Gmail receipts from the background check sit in the native inbox too.
    if (gmail.length) { gmailInbox.remove(gmail); detected.remove(gmail); }
    if (native.length) detected.remove(native);
  };
  const allSuggestions = [...detected.suggestions.filter(gmailInbox.isRelevant), ...gmailInbox.suggestions]
    .sort((a, b) => (b.time || 0) - (a.time || 0));
  const editSuggestion = (s) => {
    haptic('tap'); setQuickCategory(null); setQuickPrefill({ ...toItem(s), suggestionId: s.id }); setQuickOpen(true);
  };
  // "הוסף" / tap on a detection notification opened the app.
  const detectActionRef = useRef(null);
  detectActionRef.current = async (a) => {
    if (!a) return;
    setTab('expenses');
    if (a.action !== 'add') { detected.refresh(); return; }
    const s = (await listSuggestions()).find((x) => x.id === a.id);
    if (s) addSuggestions([s]);
  };
  useEffect(() => {
    if (!isNative || !user || !lists.activeListId) return;
    takeLaunchAction().then((a) => detectActionRef.current(a)).catch(() => {});
  }, [user?.uid, !!lists.activeListId]);
  useEffect(() => onDetectEvent('action', (a) => detectActionRef.current(a)), []);
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
        // clip, not hidden: nothing (focus, scrollIntoView) can scroll the shell
        // and drag the tab bar or a sheet out of place.
        background: 'var(--bg)', overflow: 'clip',  // .app-bg: the palette's texture
        display: 'flex', flexDirection: 'column',
        // Android draws edge-to-edge: keep content clear of the status bar.
        paddingTop: 'env(safe-area-inset-top)',
      }} className="app-bg" data-screen-label={`tab: ${tab}`}>
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
              onOpenSummary={() => { haptic('tap'); setTab('summary'); }}
              suggestionsCard={(
                <SuggestionsCard suggestions={allSuggestions} categories={categories} items={lists.items}
                  onAdd={addSuggestions} onDismiss={(l) => removeSuggestions(l.map((s) => s.id))} onEdit={editSuggestion}
                  style={{ marginTop: 14 }} />
              )}
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
          {tab === 'summary' && (
            <SummaryScreen
              lists={lists}
              categories={categories}
              payments={subs}
              settings={spaceSettings}
              setSettings={setSpaceSettings}
              onOpenSubs={() => { haptic('tap'); setTab('subs'); }}
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
              onOpenGmail={() => setGmailOpen(true)}
              gmailAuto={gmailInbox.auto}
              onGmailAuto={gmailInbox.setAuto}
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
          prefill={quickPrefill}
          recentTitles={recentTitles}
          canSave={!!lists.activeListId}
          list={activeShared ? lists.activeList : null}
          onAdd={(item) => { addExpense(item); if (quickPrefill?.suggestionId) removeSuggestions([quickPrefill.suggestionId]); }}
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
        <GmailScanSheet open={gmailOpen} onClose={() => setGmailOpen(false)}
          categories={categories} items={lists.items} subs={allSubs}
          currency={spaceSettings.defaultCurrency || '₪'} rates={fx?.rates}
          onAddExpense={(item) => lists.ops.addItem(lists.activeListId, item).then(() => toast(`נוספה הוצאה · ${fmtMoney(item.amount)} · ${item.title}`, { type: 'success' })).catch(() => toast('שגיאה בהוספה', { type: 'error' }))}
          onAddSubscription={addPayment} onScanned={gmailInbox.enableAuto} />
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

// Bottom bar: הוצאות · מנויים · (+) · סיכום · הגדרות, with + in the middle.
// Inactive icons go grey; the active one pops in colour with a dot under it.
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
      {item('summary', 'סיכום')}
      {item('settings', 'הגדרות')}
    </nav>
  );
}

export { App };
