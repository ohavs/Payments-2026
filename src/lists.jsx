// Spaces: where expenses (and, for shared spaces, subscriptions) live.
// A space is a top-level Firestore doc under /lists so it can be shared across
// accounts. Every user has a personal space; a shared space is a household
// that two people run together (rent, groceries, the shared Netflix).
//
// Schema:
//   lists/{id}            → { name, kind('personal'|'shared'), ownerUid, members[],
//                             memberInfo{uid: {name, email, photo}}, groups[](=categories),
//                             invitedEmails[], budget{monthlyCap, monthlyIncome,
//                             includeSubsInBudget, categoryCaps} (shared only), createdAt }
//   lists/{id}/items/{id} → { title, group(=category), amount, note, date(YYYY-MM-DD),
//                             source, paidBy(uid|'joint'), addedBy, createdAt }
//   lists/{id}/subs/{id}  → a subscription, same shape as users/{uid}/payments,
//                             plus paidBy (shared spaces only)
//
// Personal subscriptions stay under users/{uid}/payments.
//
// Sharing: invite another Google account by its email (invitedEmails) — the
// invitee sees the invitation in-app and accepts it themselves. The list id also
// works as an unguessable invite code. Both are enforced in firestore.rules.
import React from 'react';
import firebase from './lib/firebase.js';
import { Chip, Icon, IconButton, Sheet } from './components.jsx';
import { fmtMoney, parseISODate } from './data.jsx';
import { Spinner, useConfirm, useToast } from './feedback.jsx';
import { fbAuth, fbDb } from './firebase-init.jsx';
import { CategoryBadge } from './ui/icons.jsx';
import { SectionHeader } from './payment-card.jsx';

const DEFAULT_CATEGORIES = ['קניות', 'ביטוחים', 'אוכל בחוץ', 'שונות'];
const SHARED_CATEGORIES = ['קניות', 'בית', 'חשבונות', 'אוכל בחוץ', 'רכב', 'שונות'];

// A space is shared once it was opened as one or someone else joined it.
function isSharedList(l) {
  return !!l && (l.kind === 'shared' || (l.members || []).length > 1);
}
const ACTIVE_KEY = 'space.active';
const MONTH_NAMES_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const DAY_NAMES_HE = ['א','ב','ג','ד','ה','ו','ש'];

function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function localISO(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function todayISO() { return localISO(new Date()); }
function fmtDateHe(d) { return `${d.getDate()} ב${MONTH_NAMES_HE[d.getMonth()]}`; }
function fmtDateHeFull(d) { return `${d.getDate()} ב${MONTH_NAMES_HE[d.getMonth()]} ${d.getFullYear()}`; }

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  if (typeof ts.toDate === 'function') return ts.toDate();
  return null;
}
// The date an expense is filed under: its explicit date, else its createdAt.
function expenseDate(it) {
  if (it.date) return parseISODate(it.date);
  return tsToDate(it.createdAt) || new Date();
}

// localStorage-backed boolean, scoped per device.
function useStickyState(key, initial) {
  const [val, setVal] = React.useState(() => {
    try { const v = localStorage.getItem(key); return v == null ? initial : v === '1'; }
    catch { return initial; }
  });
  const set = React.useCallback((next) => {
    setVal(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      try { localStorage.setItem(key, resolved ? '1' : '0'); } catch {}
      return resolved;
    });
  }, [key]);
  return [val, set];
}

// ---------- Data hook ----------
function useLists(uid, user) {
  const [lists, setLists] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [activeListId, setActiveListId] = React.useState(null);
  const [items, setItems] = React.useState([]);
  const [invites, setInvites] = React.useState([]);
  const seededRef = React.useRef(false);
  const cleanedRef = React.useRef(false);
  const [serverLoaded, setServerLoaded] = React.useState(false);
  const myEmail = (user?.email || '').trim().toLowerCase();

  React.useEffect(() => {
    if (!uid) { setLists([]); setLoading(false); return; }
    setLoading(true);
    const unsub = fbDb.collection('lists')
      .where('members', 'array-contains', uid)
      // Metadata changes too, so we learn when the server (not just the local
      // cache) has answered. A new device's empty cache must never look like
      // "this user has no personal space" — that created duplicates.
      .onSnapshot({ includeMetadataChanges: true }, (snap) => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        setLists(rows);
        setLoading(false);
        if (!snap.metadata.fromCache) setServerLoaded(true);
      }, (err) => { console.error('lists subscribe error', err); setLoading(false); });
    return () => unsub();
  }, [uid]);

  // Trackers someone invited this Google account to. Readable thanks to the
  // invitedEmails rule, so an invitation shows up without any server code.
  React.useEffect(() => {
    if (!uid || !myEmail) { setInvites([]); return; }
    const unsub = fbDb.collection('lists')
      .where('invitedEmails', 'array-contains', myEmail)
      .onSnapshot((snap) => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(l => !(l.members || []).includes(uid));
        setInvites(rows);
      }, (err) => console.error('invites subscribe error', err));
    return () => unsub();
  }, [uid, myEmail]);

  // Every user has a personal space. Created on first sign-in, and also for
  // someone whose only tracker became shared.
  React.useEffect(() => {
    if (!uid || loading || !serverLoaded || seededRef.current) return;
    if (!lists.some(l => !isSharedList(l) && l.ownerUid === uid)) {
      seededRef.current = true;
      fbDb.collection('lists').add({
        name: 'ההוצאות שלי',
        kind: 'personal',
        ownerUid: uid,
        members: [uid],
        memberInfo: { [uid]: memberInfoOf(user) },
        groups: DEFAULT_CATEGORIES.slice(),
        invitedEmails: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch((e) => { console.error('seed tracker', e); seededRef.current = false; });
    }
  }, [uid, loading, serverLoaded, lists]);

  // Personal spaces created twice by that bug (same default name, only me in
  // them): merge them into the oldest one. Expenses and subscriptions move
  // over with their ids, categories are combined, the extra space is deleted.
  React.useEffect(() => {
    if (!uid || !serverLoaded || cleanedRef.current) return;
    cleanedRef.current = true;
    const created = (l) => l.createdAt?.seconds ?? Number.MAX_SAFE_INTEGER;
    const mine = lists
      .filter(l => l.name === 'ההוצאות שלי' && l.ownerUid === uid && !isSharedList(l))
      .sort((a, b) => created(a) - created(b));
    if (mine.length < 2) return;
    const [keep, ...dupes] = mine;
    (async () => {
      const col = fbDb.collection('lists');
      for (const l of dupes) {
        try {
          for (const sub of ['items', 'subs']) {
            const snap = await col.doc(l.id).collection(sub).get();
            // A batch holds up to 500 writes: copy + delete per document.
            for (let i = 0; i < snap.docs.length; i += 200) {
              const batch = fbDb.batch();
              snap.docs.slice(i, i + 200).forEach((d) => {
                batch.set(col.doc(keep.id).collection(sub).doc(d.id), d.data());
                batch.delete(d.ref);
              });
              await batch.commit();
            }
          }
          const groups = [...new Set([...(keep.groups || DEFAULT_CATEGORIES), ...(l.groups || [])])];
          await col.doc(keep.id).set({ groups }, { merge: true });
          await col.doc(l.id).delete();
        } catch (e) { console.error('merge duplicate space', e); }
      }
    })();
  }, [uid, serverLoaded, lists]);

  // A space just created or joined is selected before the snapshot that brings
  // it in arrives; hold that choice instead of falling back to another space.
  const pendingRef = React.useRef(null);
  const selectSpace = React.useCallback((id) => { pendingRef.current = id; setActiveListId(id); }, []);

  // Reopen the space used last; otherwise the personal one.
  React.useEffect(() => {
    if (activeListId && lists.some(l => l.id === activeListId)) {
      if (pendingRef.current === activeListId) pendingRef.current = null;
      return;
    }
    if (activeListId && pendingRef.current === activeListId) return;
    if (!lists.length) { if (activeListId) setActiveListId(null); return; }
    let saved = null;
    try { saved = localStorage.getItem(ACTIVE_KEY); } catch {}
    const pick = lists.find(l => l.id === saved)
      || lists.find(l => !isSharedList(l) && l.ownerUid === uid)
      || lists[0];
    setActiveListId(pick.id);
  }, [lists, activeListId]);

  React.useEffect(() => {
    if (!activeListId) return;
    try { localStorage.setItem(ACTIVE_KEY, activeListId); } catch {}
  }, [activeListId]);

  React.useEffect(() => {
    if (!activeListId) { setItems([]); return; }
    return listenWithRetry(fbDb.collection('lists').doc(activeListId).collection('items'), (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (expenseDate(b) - expenseDate(a)) || ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setItems(rows);
    }, 'expense items');
  }, [activeListId]);

  const activeList = React.useMemo(
    () => lists.find(l => l.id === activeListId) || null,
    [lists, activeListId]
  );
  // Personal spaces first (oldest first), then shared ones.
  const spaces = React.useMemo(
    () => [...lists.filter(l => !isSharedList(l)), ...lists.filter(isSharedList)],
    [lists]
  );

  const ops = React.useMemo(() => {
    const col = () => fbDb.collection('lists');
    const meInfo = () => memberInfoOf(user);
    const cleanAmount = (a) => (a === '' || a == null) ? 0 : Number(a);
    return {
      createList: async (name, kind = 'personal') => {
        const ref = await col().add({
          name: name || (kind === 'shared' ? 'הבית שלנו' : 'מרחב חדש'), kind, ownerUid: uid, members: [uid],
          memberInfo: { [uid]: meInfo() },
          groups: (kind === 'shared' ? SHARED_CATEGORIES : DEFAULT_CATEGORIES).slice(), invitedEmails: [],
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        selectSpace(ref.id);
        return ref.id;
      },
      renameList: (id, name) => col().doc(id).set({ name }, { merge: true }),
      setGroups: (id, groups) => col().doc(id).set({ groups }, { merge: true }),
      setBudget: (id, budget) => col().doc(id).set({ budget }, { merge: true }),
      deleteList: async (id) => {
        const [itemsSnap, subsSnap] = await Promise.all([
          col().doc(id).collection('items').get(),
          col().doc(id).collection('subs').get(),
        ]);
        const batch = fbDb.batch();
        itemsSnap.docs.forEach(d => batch.delete(d.ref));
        subsSnap.docs.forEach(d => batch.delete(d.ref));
        batch.delete(col().doc(id));
        await batch.commit();
      },
      addItem: (id, item) => col().doc(id).collection('items').add({
        title: (item.title || '').trim(),
        group: item.group || '',
        amount: cleanAmount(item.amount),
        note: (item.note || '').trim(),
        date: item.date || todayISO(),
        // Where the expense came from: 'manual', or 'wallet' / 'card' / 'sms' /
        // 'gmail' when it was detected automatically.
        source: item.source || 'manual',
        // Who paid: a member's uid, or 'joint' for a shared account.
        paidBy: item.paidBy || uid,
        addedBy: uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }),
      updateItem: (id, item) => {
        const { id: itemId, ...rest } = item;
        const data = { ...rest };
        if ('amount' in data) data.amount = cleanAmount(data.amount);
        if ('title' in data) data.title = (data.title || '').trim();
        if ('note' in data) data.note = (data.note || '').trim();
        return col().doc(id).collection('items').doc(itemId).set(data, { merge: true });
      },
      removeItem: (id, itemId) => col().doc(id).collection('items').doc(itemId).delete(),
      // Invite another Google account by email. They see the invitation the
      // next time they open the app and can accept it themselves.
      inviteEmail: async (id, email) => {
        const e = (email || '').trim().toLowerCase();
        if (!e) return { ok: false, reason: 'empty' };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, reason: 'invalid' };
        if (e === (user?.email || '').trim().toLowerCase()) return { ok: false, reason: 'self' };
        try {
          await col().doc(id).update({ invitedEmails: firebase.firestore.FieldValue.arrayUnion(e) });
          return { ok: true, email: e };
        } catch (err) { console.error('invite error', err); return { ok: false, reason: 'failed' }; }
      },
      revokeInvite: (id, email) => col().doc(id).update({
        invitedEmails: firebase.firestore.FieldValue.arrayRemove((email || '').trim().toLowerCase()),
      }),
      acceptInvite: async (id) => {
        const e = (user?.email || '').trim().toLowerCase();
        await col().doc(id).update({
          members: firebase.firestore.FieldValue.arrayUnion(uid),
          [`memberInfo.${uid}`]: meInfo(),
          invitedEmails: firebase.firestore.FieldValue.arrayRemove(e),
        });
        selectSpace(id);
      },
      declineInvite: (id) => col().doc(id).update({
        invitedEmails: firebase.firestore.FieldValue.arrayRemove((user?.email || '').trim().toLowerCase()),
      }),
      joinByCode: async (code) => {
        const clean = (code || '').trim();
        if (!clean) return { ok: false, reason: 'empty' };
        try {
          await col().doc(clean).update({
            members: firebase.firestore.FieldValue.arrayUnion(uid),
            [`memberInfo.${uid}`]: meInfo(),
          });
          selectSpace(clean);
          return { ok: true };
        } catch (e) { console.error('join error', e); return { ok: false, reason: 'invalid' }; }
      },
      leaveList: async (id) => {
        await col().doc(id).update({
          members: firebase.firestore.FieldValue.arrayRemove(uid),
          [`memberInfo.${uid}`]: firebase.firestore.FieldValue.delete(),
        });
      },
    };
  }, [uid, user]);

  return { loading, lists, spaces, activeList, activeListId, setActiveListId, items, invites, ops };
}

// A space created or joined a moment ago can still be in flight to the server,
// so the rules' membership lookup fails and the listener dies. Re-subscribe a
// few times before giving up. Returns the unsubscribe function.
function listenWithRetry(query, onNext, label, onGiveUp) {
  let unsub = () => {};
  let timer = null;
  let attempt = 0;
  const subscribe = () => {
    unsub = query.onSnapshot((snap) => { attempt = 0; onNext(snap); }, (err) => {
      if (attempt < 5) { attempt += 1; timer = setTimeout(subscribe, 700 * attempt); return; }
      console.error(`${label} subscribe error`, err);
      if (onGiveUp) onGiveUp(err);
    });
  };
  subscribe();
  return () => { clearTimeout(timer); unsub(); };
}

function memberInfoOf(user) {
  return { name: user?.displayName || '', email: user?.email || '', photo: user?.photoURL || '' };
}

// Subscriptions that belong to shared spaces: { [listId]: payment[] }.
// Personal subscriptions stay in users/{uid}/payments (usePayments).
function useSpaceSubs(listIds) {
  const [byList, setByList] = React.useState({});
  const [loaded, setLoaded] = React.useState({});
  const key = listIds.join('|');
  React.useEffect(() => {
    const unsubs = listIds.map((id) => listenWithRetry(fbDb.collection('lists').doc(id).collection('subs'), (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setByList(prev => ({ ...prev, [id]: rows }));
      setLoaded(prev => ({ ...prev, [id]: true }));
    }, 'space subs', () => setLoaded(prev => ({ ...prev, [id]: true }))));
    return () => unsubs.forEach(u => u());
  }, [key]);

  const opsFor = React.useCallback((listId) => {
    const col = fbDb.collection('lists').doc(listId).collection('subs');
    return {
      add: (p) => {
        const { id, ...data } = p;
        const ref = id ? col.doc(id) : col.doc();
        return ref.set({ ...data, paidBy: data.paidBy || fbAuth.currentUser?.uid || '', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      },
      update: (p) => {
        const { id, ...data } = p;
        return col.doc(id).set(data, { merge: true });
      },
      remove: (id) => col.doc(id).delete(),
    };
  }, []);

  return { byList, loaded, opsFor };
}
// ---------- Home section ----------
function PendingInvitesCard({ lists }) {
  const { invites, ops } = lists;
  const toast = useToast();
  if (!invites || !invites.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
      {invites.map(inv => {
        const owner = (inv.memberInfo || {})[inv.ownerUid] || {};
        const who = owner.name || owner.email || 'משתמש';
        return (
          <div key={inv.id} style={{
            background: 'var(--surface-1)', borderRadius: 20, padding: '16px 18px',
            border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 13 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: 'var(--accent)',
                color: 'var(--accent-fg)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="user" size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  הוזמנת ל״{inv.name || 'מרחב משותף'}״
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  על ידי {who}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={async () => {
                try { await ops.acceptInvite(inv.id); toast('הצטרפת למרחב', { type: 'success' }); }
                catch (e) { console.error(e); toast('ההצטרפות נכשלה', { type: 'error' }); }
              }} style={{
                flex: 1, padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'var(--accent)', color: 'var(--accent-fg)',
                fontFamily: 'inherit', fontWeight: 800, fontSize: 14,
              }}>הצטרף</button>
              <button onClick={async () => {
                try { await ops.declineInvite(inv.id); toast('ההזמנה נדחתה', { type: 'info' }); }
                catch (e) { console.error(e); }
              }} style={{
                padding: '11px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'var(--surface-2)', color: 'var(--ink-dim)',
                fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
              }}>לא עכשיו</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Shared inputs ----------
// Numbers are typed into a text field (decimal keypad): the browser's number
// input brings spinners, scroll-to-change and accepts "e".
function FieldInput({ value, onChange, placeholder, type = 'text', onEnter, dir, inputRef, inputMode, big }) {
  const numeric = type === 'number';
  const clean = (v) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
  return (
    <input
      ref={inputRef}
      value={value ?? ''} onChange={e => onChange(numeric ? clean(e.target.value) : e.target.value)}
      placeholder={placeholder} type={numeric ? 'text' : type} dir={dir}
      inputMode={numeric ? (inputMode || 'decimal') : inputMode}
      onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter(); }}
      style={{
        width: '100%', background: 'var(--surface-2)', border: 'none', outline: 'none',
        color: 'var(--ink)', fontSize: big ? 30 : 16, fontWeight: big ? 800 : 600, fontFamily: 'inherit',
        padding: big ? '16px 15px' : '13px 15px', borderRadius: 14, boxSizing: 'border-box',
        letterSpacing: big ? '-0.02em' : 0, fontVariantNumeric: 'tabular-nums',
      }}
    />
  );
}

function CategoryChips({ categories, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {categories.map(c => (
        <Chip key={c} active={value === c} onClick={() => onChange(c)}>{c}</Chip>
      ))}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="btn-primary" style={{
      width: '100%', height: 56, fontFamily: 'inherit', fontSize: 16.5,
    }}>{children}</button>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-dim)', marginBottom: 9 }}>{children}</div>
  );
}

// App-styled date field — tap to reveal an inline month-grid picker (no native UI).
function DateField({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const d = parseISODate(value);
  const isToday = value === todayISO();
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface-2)', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        color: 'var(--ink)', padding: '13px 15px', borderRadius: 14,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700 }}>
          <Icon name="calendar" size={16} />
          {isToday ? 'היום' : fmtDateHeFull(d)}
        </span>
        <span style={{ display: 'inline-flex', transition: 'transform .2s ease', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--ink-dim)' }}>
          <Icon name="chevron-down" size={16} />
        </span>
      </button>
      {open && <MiniCalendar value={value} onPick={(iso) => { onChange(iso); setOpen(false); }} />}
    </div>
  );
}

function MiniCalendar({ value, onPick }) {
  const sel = parseISODate(value);
  const [cursor, setCursor] = React.useState(() => new Date(sel.getFullYear(), sel.getMonth(), 1));
  const cells = React.useMemo(() => {
    const startDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < startDay; i++) arr.push(null);
    for (let dd = 1; dd <= days; dd++) arr.push(dd);
    return arr;
  }, [cursor]);
  const today = new Date();
  const isSel = (dd) => sel.getFullYear() === cursor.getFullYear() && sel.getMonth() === cursor.getMonth() && sel.getDate() === dd;
  const isToday = (dd) => today.getFullYear() === cursor.getFullYear() && today.getMonth() === cursor.getMonth() && today.getDate() === dd;

  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: 12, marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <IconButton name="chevron-right" size={30} iconSize={16} bg="var(--surface-3)"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} />
        <div style={{ fontSize: 14, fontWeight: 800 }}>{MONTH_NAMES_HE[cursor.getMonth()]} {cursor.getFullYear()}</div>
        <IconButton name="chevron-left" size={30} iconSize={16} bg="var(--surface-3)"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 4 }}>
        {DAY_NAMES_HE.map((n, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-dim)', padding: '2px 0' }}>{n}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {cells.map((dd, i) => dd == null ? <div key={i} /> : (
          <button key={i} onClick={() => onPick(localISO(new Date(cursor.getFullYear(), cursor.getMonth(), dd)))} style={{
            aspectRatio: '1 / 1', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            borderRadius: 10, fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            background: isSel(dd) ? 'var(--accent)' : 'transparent',
            color: isSel(dd) ? 'var(--accent-fg)' : 'var(--ink)',
            outline: isToday(dd) && !isSel(dd) ? '1.5px solid var(--accent)' : 'none', outlineOffset: -1.5,
          }}>{dd}</button>
        ))}
      </div>
    </div>
  );
}

// ---------- Quick add / edit expense ----------
function EditExpenseSheet({ open, onClose, item, categories, onSave, onDelete, renderPayer }) {
  const [amount, setAmount] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [date, setDate] = React.useState(todayISO());
  const [note, setNote] = React.useState('');
  const [paidBy, setPaidBy] = React.useState(null);
  const confirm = useConfirm();

  React.useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setAmount(item.amount == null ? '' : String(item.amount));
      setCategory(item.group || categories[0]);
      setDate(item.date || localISO(expenseDate(item)));
      setNote(item.note || '');
      setPaidBy(item.paidBy || null);
    }
  }, [item]);

  const valid = amount !== '' && Number(amount) > 0;
  const save = () => {
    if (!valid) return;
    const next = { id: item.id, title: title.trim() || category, amount, group: category, note, date };
    if (paidBy) next.paidBy = paidBy;
    onSave(next);
  };
  const del = async () => {
    const ok = await confirm({ title: 'מחיקת הוצאה', message: 'ההוצאה תימחק לצמיתות', confirmLabel: 'מחק' });
    if (ok) onDelete(item.id);
  };

  return (
    <Sheet open={open} onClose={onClose} title="עריכת הוצאה" height="90%">
      <div style={{ padding: '18px 22px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <Label>סכום</Label>
          <FieldInput value={amount} onChange={setAmount} placeholder="₪0" type="number" inputMode="decimal" big onEnter={save} />
        </div>
        <div>
          <Label>שם</Label>
          <FieldInput value={title} onChange={setTitle} onEnter={save} />
        </div>
        <div>
          <Label>קטגוריה</Label>
          <div className="hide-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -22px', padding: '0 22px' }}>
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '2px 4px', minWidth: 66, flexShrink: 0,
              }}>
                <CategoryBadge name={c} size={50} selected={c === category} />
                <span style={{ fontSize: 12.5, fontWeight: c === category ? 800 : 600, whiteSpace: 'nowrap' }}>{c}</span>
              </button>
            ))}
          </div>
        </div>
        {renderPayer && renderPayer(paidBy || item?.paidBy, setPaidBy)}
        <div>
          <Label>תאריך</Label>
          <DateField value={date} onChange={setDate} />
        </div>
        <div>
          <Label>הערה (אופציונלי)</Label>
          <FieldInput value={note} onChange={setNote} placeholder="אופציונלי" onEnter={save} />
        </div>
        <PrimaryButton onClick={save} disabled={!valid}>שמור</PrimaryButton>
        <button onClick={del} style={{
          width: '100%', padding: '12px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'transparent', color: 'var(--danger)', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Icon name="trash" size={16} /> מחק הוצאה
        </button>
      </div>
    </Sheet>
  );
}

// ---------- Manage / categories / share ----------
function ManageExpensesSheet({ open, onClose, lists }) {
  const { activeList, activeListId, lists: allLists, setActiveListId, ops } = lists;
  const [name, setName] = React.useState('');
  const [newCat, setNewCat] = React.useState('');
  const [inviteMail, setInviteMail] = React.useState('');
  const [showCode, setShowCode] = React.useState(false);
  const [joinCode, setJoinCode] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const user = fbAuth.currentUser;
  const isOwner = activeList && user && activeList.ownerUid === user.uid;
  const categories = activeList?.groups || [];

  React.useEffect(() => { if (activeList) setName(activeList.name || ''); }, [activeList, open]);

  const saveName = () => { const n = name.trim(); if (activeList && n && n !== activeList.name) ops.renameList(activeListId, n); };
  const addCat = () => { const g = newCat.trim(); if (!g || categories.includes(g)) { setNewCat(''); return; } ops.setGroups(activeListId, [...categories, g]); setNewCat(''); };
  const removeCat = (g) => ops.setGroups(activeListId, categories.filter(x => x !== g));
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(activeListId); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { toast('לא ניתן להעתיק — סמן והעתק ידנית', { type: 'error' }); }
  };
  const pendingInvites = activeList?.invitedEmails || [];
  const invite = async () => {
    const res = await ops.inviteEmail(activeListId, inviteMail);
    if (res.ok) { setInviteMail(''); toast(`הזמנה נשלחה ל${res.email}`, { type: 'success' }); }
    else if (res.reason === 'invalid') toast('כתובת מייל לא תקינה', { type: 'error' });
    else if (res.reason === 'self') toast('זו הכתובת שלך', { type: 'error' });
    else if (res.reason === 'failed') toast('ההזמנה נכשלה', { type: 'error' });
  };
  const join = async () => {
    const res = await ops.joinByCode(joinCode);
    if (res.ok) { setJoinCode(''); toast('הצטרפת למרחב', { type: 'success' }); onClose(); }
    else if (res.reason !== 'empty') toast('קוד לא תקין או שאין הרשאה', { type: 'error' });
  };
  const removeCurrent = async () => {
    if (!activeList) return;
    if (isOwner) {
      const ok = await confirm({ title: 'מחיקת מרחב', message: `"${activeList.name}" וכל ההוצאות והמנויים בו יימחקו לצמיתות`, confirmLabel: 'מחק' });
      if (ok) { await ops.deleteList(activeListId); onClose(); toast('נמחק', { type: 'info' }); }
    } else {
      const ok = await confirm({ title: 'יציאה מהמרחב המשותף', message: 'תפסיק לראות את המרחב המשותף. אפשר להצטרף שוב עם הקוד.', confirmLabel: 'צא' });
      if (ok) { await ops.leaveList(activeListId); onClose(); toast('יצאת', { type: 'info' }); }
    }
  };

  const members = activeList?.members || [];
  const memberInfo = activeList?.memberInfo || {};

  return (
    <Sheet open={open} onClose={onClose} title="ניהול מרחבים" height="90%">
      <div style={{ padding: '18px 22px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {allLists.length > 1 && (
          <Section title="מרחבים">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allLists.map(l => (
                <Chip key={l.id} active={l.id === activeListId} onClick={() => setActiveListId(l.id)}>
                  {l.name}
                </Chip>
              ))}
            </div>
          </Section>
        )}

        <Section title="שם המרחב">
          <div style={{ display: 'flex', gap: 8 }}>
            <FieldInput value={name} onChange={setName} onEnter={saveName} />
            <button onClick={saveName} style={{ ...ghostBtn, width: 'auto', padding: '0 16px', whiteSpace: 'nowrap' }}>שמור</button>
          </div>
        </Section>

        <Section title="קטגוריות">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {categories.map(g => (
              <div key={g} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', borderRadius: 12, padding: '10px 14px' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{g}</span>
                <button onClick={() => removeCat(g)} aria-label="מחק קטגוריה" disabled={categories.length <= 1} style={{
                  background: 'transparent', border: 'none', cursor: categories.length <= 1 ? 'not-allowed' : 'pointer',
                  color: '#FF5C5C', opacity: categories.length <= 1 ? .35 : 1, padding: 4,
                }}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <FieldInput value={newCat} onChange={setNewCat} placeholder="קטגוריה חדשה (למשל: דלק)" onEnter={addCat} />
            <button onClick={addCat} style={{ ...ghostBtn, width: 'auto', padding: '0 16px', whiteSpace: 'nowrap' }}>
              <Icon name="plus" size={16} /> הוסף
            </button>
          </div>
        </Section>

        <Section title="שיתוף עם חשבון גוגל">
          <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginBottom: 10, lineHeight: 1.5 }}>
            הזן את כתובת ה-Gmail שהוא מתחבר איתה. ההזמנה תופיע לו באפליקציה,
            ואחרי שיאשר תוכלו לנהל את ההוצאות יחד.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <FieldInput value={inviteMail} onChange={setInviteMail} placeholder="name@gmail.com"
              type="email" dir="ltr" onEnter={invite} />
            <button onClick={invite} style={{ ...ghostBtn, width: 'auto', padding: '0 16px', whiteSpace: 'nowrap' }}>
              הזמן
            </button>
          </div>

          {(pendingInvites.length > 0) && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-dim)', marginBottom: 8 }}>
                ממתינות לאישור
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingInvites.map(e => (
                  <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--surface-2)', borderRadius: 12, padding: '9px 13px' }}>
                    <Icon name="bell" size={15} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, direction: 'ltr',
                      textAlign: 'start', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e}</span>
                    <button onClick={() => ops.revokeInvite(activeListId, e)} aria-label="בטל הזמנה" style={{
                      background: 'transparent', border: 'none', cursor: 'pointer', color: '#FF5C5C', padding: 4,
                    }}>
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Code sharing stays available for accounts without email (anonymous). */}
          <button onClick={() => setShowCode(v => !v)} style={{
            marginTop: 12, background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--ink-dim)', fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5,
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0,
          }}>
            {showCode ? 'הסתר' : 'או שיתוף באמצעות קוד'}
            <span style={{ display: 'inline-flex', transition: 'transform .2s ease',
              transform: showCode ? 'rotate(180deg)' : 'none' }}>
              <Icon name="chevron-down" size={13} />
            </span>
          </button>
          {showCode && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr' }}>
                  {activeListId || '—'}
                </span>
                <button onClick={copyCode} style={{ ...ghostBtn, width: 'auto', padding: '8px 14px', whiteSpace: 'nowrap' }}>
                  {copied ? 'הועתק ✓' : 'העתק'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <FieldInput value={joinCode} onChange={setJoinCode} placeholder="או הדבק קוד להצטרפות" dir="ltr" onEnter={join} />
                <button onClick={join} style={{ ...ghostBtn, width: 'auto', padding: '0 16px', whiteSpace: 'nowrap' }}>הצטרף</button>
              </div>
            </div>
          )}
        </Section>

        {members.length > 0 && (
          <Section title={`חברים · ${members.length}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(m => {
                const info = memberInfo[m] || {};
                const isYou = user && m === user.uid;
                const owner = activeList.ownerUid === m;
                return (
                  <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-2)', borderRadius: 12, padding: '10px 14px' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="user" size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {info.name || info.email || 'משתמש'}{isYou ? ' (אתה)' : ''}
                      </div>
                      {info.email && <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.email}</div>}
                    </div>
                    {owner && <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-fg)' }}>בעלים</span>}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <button onClick={removeCurrent} style={{
          width: '100%', padding: '13px', borderRadius: 14, border: '1px solid #FF5C5C', cursor: 'pointer',
          background: 'transparent', color: '#FF5C5C', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Icon name={isOwner ? 'trash' : 'arrow-right'} size={16} />
          {isOwner ? 'מחק מרחב' : 'צא מהמרחב'}
        </button>
      </div>
    </Sheet>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-dim)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '11px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
  background: 'var(--surface-3)', color: 'var(--ink)', fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5,
};

export { DEFAULT_CATEGORIES, DAY_NAMES_HE, EditExpenseSheet, SHARED_CATEGORIES, isSharedList, memberInfoOf, useSpaceSubs, FieldInput, MONTH_NAMES_HE, MiniCalendar, fmtDateHe, ManageExpensesSheet, PendingInvitesCard, PrimaryButton, Section, expenseDate, ghostBtn, localISO, todayISO, useLists, useStickyState };
