// Monthly expenses tracker (קניות / ביטוחים / אוכל בחוץ / שונות ...).
// A "tracker" is a top-level Firestore doc under /lists so it can be shared
// across accounts. Expenses live in an items subcollection.
//
// Schema:
//   lists/{id}            → { name, ownerUid, members[], memberInfo{}, groups[](=categories), createdAt }
//   lists/{id}/items/{id} → { title, group(=category), amount, note, date(YYYY-MM-DD), createdAt }
//
// Sharing: the list id itself is the unguessable invite code (see firestore.rules).

const DEFAULT_CATEGORIES = ['קניות', 'ביטוחים', 'אוכל בחוץ', 'שונות'];
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
  const seededRef = React.useRef(false);

  React.useEffect(() => {
    if (!uid || !window.fbDb) { setLists([]); setLoading(false); return; }
    setLoading(true);
    const unsub = fbDb.collection('lists')
      .where('members', 'array-contains', uid)
      .onSnapshot((snap) => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        setLists(rows);
        setLoading(false);
      }, (err) => { console.error('lists subscribe error', err); setLoading(false); });
    return () => unsub();
  }, [uid]);

  React.useEffect(() => {
    if (!uid || loading || seededRef.current) return;
    if (lists.length === 0) {
      seededRef.current = true;
      fbDb.collection('lists').add({
        name: 'ההוצאות שלי',
        ownerUid: uid,
        members: [uid],
        memberInfo: { [uid]: { name: user?.displayName || '', email: user?.email || '' } },
        groups: DEFAULT_CATEGORIES.slice(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch((e) => { console.error('seed tracker', e); seededRef.current = false; });
    }
  }, [uid, loading, lists.length]);

  React.useEffect(() => {
    if (!lists.length) { if (activeListId) setActiveListId(null); return; }
    if (!activeListId || !lists.some(l => l.id === activeListId)) setActiveListId(lists[0].id);
  }, [lists, activeListId]);

  React.useEffect(() => {
    if (!activeListId || !window.fbDb) { setItems([]); return; }
    const unsub = fbDb.collection('lists').doc(activeListId).collection('items')
      .onSnapshot((snap) => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (expenseDate(b) - expenseDate(a)) || ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        setItems(rows);
      }, (err) => console.error('expense items subscribe error', err));
    return () => unsub();
  }, [activeListId]);

  const activeList = React.useMemo(
    () => lists.find(l => l.id === activeListId) || null,
    [lists, activeListId]
  );

  const ops = React.useMemo(() => {
    const col = () => fbDb.collection('lists');
    const meInfo = () => ({ name: user?.displayName || '', email: user?.email || '' });
    const cleanAmount = (a) => (a === '' || a == null) ? 0 : Number(a);
    return {
      createList: async (name) => {
        const ref = await col().add({
          name: name || 'מעקב חדש', ownerUid: uid, members: [uid],
          memberInfo: { [uid]: meInfo() }, groups: DEFAULT_CATEGORIES.slice(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        setActiveListId(ref.id);
        return ref.id;
      },
      renameList: (id, name) => col().doc(id).set({ name }, { merge: true }),
      setGroups: (id, groups) => col().doc(id).set({ groups }, { merge: true }),
      deleteList: async (id) => {
        const itemsSnap = await col().doc(id).collection('items').get();
        const batch = fbDb.batch();
        itemsSnap.docs.forEach(d => batch.delete(d.ref));
        batch.delete(col().doc(id));
        await batch.commit();
      },
      addItem: (id, item) => col().doc(id).collection('items').add({
        title: (item.title || '').trim(),
        group: item.group || '',
        amount: cleanAmount(item.amount),
        note: (item.note || '').trim(),
        date: item.date || todayISO(),
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
      joinByCode: async (code) => {
        const clean = (code || '').trim();
        if (!clean) return { ok: false, reason: 'empty' };
        try {
          await col().doc(clean).update({
            members: firebase.firestore.FieldValue.arrayUnion(uid),
            [`memberInfo.${uid}`]: meInfo(),
          });
          setActiveListId(clean);
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

  return { loading, lists, activeList, activeListId, setActiveListId, items, ops };
}
// ---------- Home section ----------
// Budget-aware expenses card: month navigator, headline total with the ceiling
// progress, and two ways to read the data — by category (accordion) or by date.
function ExpenseListSection({ lists, settings, setSettings, subsMonthly, onOpenBudget }) {
  const { loading, activeList, activeListId, items, ops } = lists;
  const [collapsed, setCollapsed] = useStickyState('home.expensesCollapsed', false);
  const [byDate, setByDate] = useStickyState('home.expensesByDate', false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState(null);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [addCat, setAddCat] = React.useState(null);
  const [openCat, setOpenCat] = React.useState(null);
  const [view, setView] = React.useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const toast = useToast();

  const categories = (activeList?.groups && activeList.groups.length) ? activeList.groups : DEFAULT_CATEGORIES;

  const stats = React.useMemo(() => computeBudgetStats({
    items, y: view.y, m: view.m,
    income: Number(settings?.monthlyIncome) || 0,
    cap: Number(settings?.monthlyCap) || 0,
    subsMonthly, includeSubs: settings?.includeSubsInBudget !== false,
    categories, categoryCaps: settings?.categoryCaps || {},
  }), [items, view.y, view.m, settings, subsMonthly, categories.join('|')]);

  const shiftMonth = (delta) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
    setOpenCat(null);
  };

  // Expenses of the viewed month, grouped by day (newest first).
  const dayGroups = React.useMemo(() => {
    const map = new Map();
    stats.monthItems.forEach(it => {
      const key = localISO(expenseDate(it));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [stats.monthItems]);

  // Titles used recently — offered as one-tap fill in the quick-add sheet.
  const recentTitles = React.useMemo(() => {
    const seen = []; 
    items.forEach(it => {
      const t = (it.title || '').trim();
      if (t && !seen.includes(t)) seen.push(t);
    });
    return seen.slice(0, 6);
  }, [items]);

  const openAdd = (cat) => { setAddCat(cat || categories[0]); setAddOpen(true); };

  const manageBtn = (
    <button onClick={() => setManageOpen(true)} aria-label="ניהול הוצאות" style={{
      width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
      background: 'var(--surface-2)', color: 'var(--ink)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon name="more" size={18} />
    </button>
  );

  const barColor = budgetColor(stats);

  return (
    <div>
      <SectionHeader
        title="הוצאות"
        count={loading ? null : stats.count}
        collapsible collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        onAdd={() => openAdd()}
        addLabel="הוסף הוצאה"
        rightNode={manageBtn}
      />

      {!collapsed && (
        loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
            <Spinner size={24} color="var(--accent)" />
          </div>
        ) : (
          <div style={{ background: 'var(--surface-1)', borderRadius: 22, overflow: 'hidden' }}>
            {/* Month navigator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 12px 0' }}>
              <IconButton name="chevron-right" size={30} iconSize={16} bg="var(--surface-2)"
                onClick={() => shiftMonth(-1)} ariaLabel="חודש קודם" />
              <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.01em' }}>
                {MONTH_NAMES_HE[view.m]} {view.y}
              </div>
              <IconButton name="chevron-left" size={30} iconSize={16} bg="var(--surface-2)"
                onClick={() => shiftMonth(1)} ariaLabel="חודש הבא" />
            </div>

            {/* Headline total + ceiling progress */}
            <button onClick={onOpenBudget} style={{
              width: '100%', textAlign: 'start', background: 'transparent', border: 'none',
              cursor: onOpenBudget ? 'pointer' : 'default', fontFamily: 'inherit', color: 'var(--ink)',
              padding: '12px 16px 15px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-dim)' }}>
                  סה״כ הוצאות
                  {stats.committed > 0 ? ` + מנויים ${fmtMoney(stats.committed)}` : ''}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(stats.used)}
                </div>
              </div>

              {stats.hasCap ? (
                <div style={{ marginTop: 11 }}>
                  <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                    <div style={{ width: `${clamp(stats.pctUsed, 0, 100)}%`, height: '100%', background: barColor,
                      borderRadius: 999, transition: 'width .45s cubic-bezier(.22,.61,.36,1)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 7, gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      color: stats.overCap ? '#FF5C5C' : 'var(--ink-dim)' }}>
                      {stats.overCap ? `חריגה ${fmtMoney(-stats.remaining)}` : `נשאר ${fmtMoney(stats.remaining)}`}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-dim)', fontVariantNumeric: 'tabular-nums' }}>
                      תקרה {fmtMoney(stats.cap)}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 9, fontSize: 12, fontWeight: 700, color: 'var(--accent)',
                  display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  הגדר תקציב חודשי <Icon name="chevron-left" size={13} />
                </div>
              )}
            </button>

            {/* View switch */}
            <div style={{ display: 'flex', gap: 4, padding: '0 12px 12px' }}>
              <SegBtn active={!byDate} onClick={() => setByDate(false)}>קטגוריות</SegBtn>
              <SegBtn active={byDate} onClick={() => setByDate(true)}>תאריכים</SegBtn>
            </div>

            {stats.count === 0 ? (
              <div style={{ padding: '20px 18px 26px', textAlign: 'center', color: 'var(--ink-dim)', borderTop: '1px solid var(--divider)' }}>
                <div style={{ fontSize: 14, marginBottom: 12 }}>
                  אין הוצאות {stats.isCurrent ? 'החודש' : 'בחודש זה'}
                </div>
                <button onClick={() => openAdd()} style={{
                  background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', padding: '9px 16px',
                  borderRadius: 999, fontWeight: 700, fontSize: 13.5,
                }}>הוסף הוצאה</button>
              </div>
            ) : byDate ? (
              <div style={{ borderTop: '1px solid var(--divider)' }}>
                {dayGroups.map(([iso, list]) => {
                  const sum = list.reduce((s, it) => s + (Number(it.amount) || 0), 0);
                  const d = parseISODate(iso);
                  const isToday = iso === todayISO();
                  return (
                    <div key={iso}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px 4px', background: 'var(--surface-1)' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: isToday ? 'var(--ink)' : 'var(--ink-dim)' }}>
                          {isToday ? 'היום' : `${DAY_NAMES_HE[d.getDay()]}׳ · ${fmtDateHe(d)}`}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink-dim)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtMoney(sum)}
                        </span>
                      </div>
                      <div style={{ paddingBottom: 4 }}>
                        {list.map(it => (
                          <ExpenseRow key={it.id} item={it} showCategory onOpen={() => setEditItem(it)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ borderTop: '1px solid var(--divider)' }}>
                {stats.catRows.map(r => (
                  <CategoryBlock key={r.cat} row={r} spent={stats.spent}
                    items={(stats.monthItems || []).filter(it => (r.cat === 'ללא קטגוריה'
                      ? !it.group || !categories.includes(it.group)
                      : it.group === r.cat))}
                    expanded={openCat === r.cat}
                    onToggle={() => setOpenCat(prev => prev === r.cat ? null : r.cat)}
                    onAdd={r.cat === 'ללא קטגוריה' ? null : () => openAdd(r.cat)}
                    onOpen={(it) => setEditItem(it)} />
                ))}
              </div>
            )}
          </div>
        )
      )}

      <AddExpenseSheet open={addOpen} onClose={() => setAddOpen(false)}
        categories={categories} defaultCategory={addCat} recentTitles={recentTitles}
        onAdd={(item) => { ops.addItem(activeListId, item); toast('ההוצאה נוספה', { type: 'success' }); }} />

      <EditExpenseSheet open={!!editItem} onClose={() => setEditItem(null)}
        item={editItem} categories={categories}
        onSave={(item) => { ops.updateItem(activeListId, item); setEditItem(null); toast('נשמר', { type: 'success' }); }}
        onDelete={(id) => { ops.removeItem(activeListId, id); setEditItem(null); toast('נמחק', { type: 'info' }); }} />

      <ManageExpensesSheet open={manageOpen} onClose={() => setManageOpen(false)} lists={lists} />
    </div>
  );
}

function SegBtn({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '9px 0', borderRadius: 11, border: 'none', cursor: 'pointer',
      background: active ? 'var(--surface-3)' : 'var(--surface-2)',
      color: active ? 'var(--ink)' : 'var(--ink-dim)',
      fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5,
      transition: 'background .15s ease, color .15s ease',
    }}>{children}</button>
  );
}

// One category: a clear heading with its total and a share/ceiling bar.
// Tap to expand the expenses inside it — keeps the card compact and scannable.
function CategoryBlock({ row, spent, items, expanded, onToggle, onAdd, onOpen }) {
  const pct = row.cap > 0 ? row.capPct : row.pct;
  return (
    <div style={{ borderBottom: '1px solid var(--divider)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 11px' }}>
        <button onClick={onToggle} style={{
          flex: 1, minWidth: 0, textAlign: 'start', background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)', padding: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ display: 'inline-flex', color: 'var(--ink-dim)', transition: 'transform .2s ease',
                transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                <Icon name="chevron-down" size={15} />
              </span>
              <span style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.01em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.cat}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-dim)' }}>{row.count}</span>
            </span>
            <span style={{ fontSize: 15.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
              color: row.overCap ? '#FF5C5C' : 'var(--ink)', whiteSpace: 'nowrap' }}>
              {fmtMoney(row.sum)}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div style={{ width: `${clamp(pct, 0, 100)}%`, height: '100%', borderRadius: 999,
              background: row.overCap ? '#FF5C5C' : 'var(--accent)',
              transition: 'width .45s cubic-bezier(.22,.61,.36,1)' }} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: row.overCap ? '#FF5C5C' : 'var(--ink-dim)',
            marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>
            {row.cap > 0
              ? (row.overCap ? `חריגה מתקרת ${fmtMoney(row.cap)}` : `${fmtMoney(row.cap - row.sum)} נשאר מתוך ${fmtMoney(row.cap)}`)
              : `${row.pct}% מההוצאות`}
          </div>
        </button>
        {onAdd && (
          <button onClick={onAdd} aria-label={`הוסף ל${row.cat}`} style={{
            width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--surface-2)', color: 'var(--ink-dim)', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="plus" size={14} strokeWidth={2.8} />
          </button>
        )}
      </div>
      <div className="stack-expand-area" data-open={expanded ? 'true' : 'false'}>
        <div className="stack-expand-wrap">
          <div style={{ paddingBottom: 6 }}>
            {items.map(it => (
              <ExpenseRow key={it.id} item={it} onOpen={() => onOpen(it)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpenseRow({ item, onOpen, showCategory }) {
  const d = expenseDate(item);
  const meta = [showCategory ? (item.group || 'ללא קטגוריה') : fmtDateHe(d), item.note].filter(Boolean).join(' · ');
  return (
    <button onClick={onOpen} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '7px 16px 7px 34px',
      background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      color: 'var(--ink)', textAlign: 'start',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title || 'הוצאה'}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', marginTop: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {fmtMoney(item.amount)}
      </div>
    </button>
  );
}

// ---------- Shared inputs ----------
function FieldInput({ value, onChange, placeholder, type = 'text', onEnter, dir, inputRef, inputMode, big }) {
  return (
    <input
      ref={inputRef}
      value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} type={type} dir={dir} inputMode={inputMode}
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
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '15px', borderRadius: 14, border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      background: 'var(--accent)', color: 'var(--accent-fg)', fontWeight: 800, fontSize: 16,
      opacity: disabled ? .5 : 1,
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
function AddExpenseSheet({ open, onClose, categories, defaultCategory, recentTitles = [], onAdd }) {
  const [amount, setAmount] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState(defaultCategory || categories[0]);
  const [date, setDate] = React.useState(todayISO());
  const [note, setNote] = React.useState('');
  const [showNote, setShowNote] = React.useState(false);
  const amountRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    setAmount(''); setTitle(''); setNote(''); setShowNote(false); setDate(todayISO());
    setCategory(defaultCategory || categories[0]);
    const id = setTimeout(() => { try { amountRef.current && amountRef.current.focus({ preventScroll: true }); } catch (e) {} }, 360);
    return () => clearTimeout(id);
  }, [open, defaultCategory]);

  const valid = title.trim() && amount !== '' && Number(amount) > 0;
  const submit = () => { if (valid) { onAdd({ title, amount, group: category, note, date }); onClose(); } };

  return (
    <Sheet open={open} onClose={onClose} title="הוצאה חדשה" height="86%">
      <div style={{ padding: '18px 22px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <Label>כמה?</Label>
          <FieldInput inputRef={amountRef} value={amount} onChange={setAmount} placeholder="₪0" type="number" inputMode="decimal" big onEnter={submit} />
        </div>
        <div>
          <Label>על מה?</Label>
          <FieldInput value={title} onChange={setTitle} placeholder="למשל: סופר, דלק, מסעדה..." onEnter={submit} />
          {recentTitles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
              {recentTitles.map(t => (
                <Chip key={t} onClick={() => setTitle(t)} style={{ padding: '6px 11px', fontSize: 12 }}>{t}</Chip>
              ))}
            </div>
          )}
        </div>
        <div>
          <Label>קטגוריה</Label>
          <CategoryChips categories={categories} value={category} onChange={setCategory} />
        </div>
        <div>
          <Label>תאריך</Label>
          <DateField value={date} onChange={setDate} />
        </div>
        {showNote ? (
          <div>
            <Label>הערה</Label>
            <FieldInput value={note} onChange={setNote} placeholder="אופציונלי" onEnter={submit} />
          </div>
        ) : (
          <button onClick={() => setShowNote(true)} style={{
            alignSelf: 'flex-start', background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--ink-dim)', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0,
          }}>
            <Icon name="plus" size={13} strokeWidth={2.6} /> הוסף הערה
          </button>
        )}
        <PrimaryButton onClick={submit} disabled={!valid}>הוסף הוצאה</PrimaryButton>
      </div>
    </Sheet>
  );
}

function EditExpenseSheet({ open, onClose, item, categories, onSave, onDelete }) {
  const [amount, setAmount] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [date, setDate] = React.useState(todayISO());
  const [note, setNote] = React.useState('');
  const confirm = useConfirm();

  React.useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setAmount(item.amount == null ? '' : String(item.amount));
      setCategory(item.group || categories[0]);
      setDate(item.date || localISO(expenseDate(item)));
      setNote(item.note || '');
    }
  }, [item]);

  const valid = title.trim() && amount !== '' && Number(amount) > 0;
  const save = () => { if (valid) onSave({ id: item.id, title, amount, group: category, note, date }); };
  const del = async () => {
    const ok = await confirm({ title: 'מחיקת הוצאה', message: 'ההוצאה תימחק מהמעקב', confirmLabel: 'מחק' });
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
          <CategoryChips categories={categories} value={category} onChange={setCategory} />
        </div>
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
          background: 'transparent', color: '#FF5C5C', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
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
  const [joinCode, setJoinCode] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const user = window.fbAuth?.currentUser;
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
  const join = async () => {
    const res = await ops.joinByCode(joinCode);
    if (res.ok) { setJoinCode(''); toast('הצטרפת למעקב', { type: 'success' }); onClose(); }
    else if (res.reason !== 'empty') toast('קוד לא תקין או שאין הרשאה', { type: 'error' });
  };
  const removeCurrent = async () => {
    if (!activeList) return;
    if (isOwner) {
      const ok = await confirm({ title: 'מחיקת מעקב', message: `"${activeList.name}" וכל ההוצאות בו יימחקו לצמיתות`, confirmLabel: 'מחק' });
      if (ok) { await ops.deleteList(activeListId); onClose(); toast('נמחק', { type: 'info' }); }
    } else {
      const ok = await confirm({ title: 'יציאה ממעקב משותף', message: 'תפסיק לראות את המעקב המשותף. אפשר להצטרף שוב עם הקוד.', confirmLabel: 'צא' });
      if (ok) { await ops.leaveList(activeListId); onClose(); toast('יצאת', { type: 'info' }); }
    }
  };

  const members = activeList?.members || [];
  const memberInfo = activeList?.memberInfo || {};

  return (
    <Sheet open={open} onClose={onClose} title="ניהול הוצאות" height="90%">
      <div style={{ padding: '18px 22px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {allLists.length > 1 && (
          <Section title="מעקבים">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allLists.map(l => (
                <Chip key={l.id} active={l.id === activeListId} onClick={() => setActiveListId(l.id)}>
                  {l.name}{(l.members?.length || 1) > 1 ? ' ·👥' : ''}
                </Chip>
              ))}
            </div>
          </Section>
        )}

        <Section title="שם המעקב">
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

        <Section title="שיתוף המעקב">
          <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginBottom: 10, lineHeight: 1.5 }}>
            שלח את הקוד למי שתרצה לשתף. מי שיזין אותו יראה ויעדכן את ההוצאות יחד איתך.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr' }}>
              {activeListId || '—'}
            </span>
            <button onClick={copyCode} style={{ ...ghostBtn, width: 'auto', padding: '8px 14px', whiteSpace: 'nowrap' }}>
              {copied ? 'הועתק ✓' : 'העתק'}
            </button>
          </div>
        </Section>

        <Section title="הצטרפות למעקב משותף">
          <div style={{ display: 'flex', gap: 8 }}>
            <FieldInput value={joinCode} onChange={setJoinCode} placeholder="הדבק כאן קוד" dir="ltr" onEnter={join} />
            <button onClick={join} style={{ ...ghostBtn, width: 'auto', padding: '0 16px', whiteSpace: 'nowrap' }}>הצטרף</button>
          </div>
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
          {isOwner ? 'מחק מעקב' : 'צא מהמעקב'}
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

Object.assign(window, {
  useLists, ExpenseListSection, AddExpenseSheet, EditExpenseSheet, ManageExpensesSheet,
  expenseDate, localISO, todayISO, MONTH_NAMES_HE, DEFAULT_CATEGORIES,
});
