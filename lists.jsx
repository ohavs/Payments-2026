// Free-form shareable lists (e.g. "קניות" / "כל מיני").
// A "list" is a top-level Firestore doc under /lists that can have several
// members, so it can be shared across accounts. Items live in a subcollection.
//
// Schema:
//   lists/{listId}                → { name, ownerUid, members[], memberInfo{}, groups[], createdAt }
//   lists/{listId}/items/{itemId} → { title, group, amount, checked, createdAt }
//
// Sharing model: the list id itself is the unguessable invite code. Anyone who
// receives it can add themselves as a member (see firestore.rules). No server
// function required.

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

  // Subscribe to every list this user is a member of.
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

  // Create a default personal list the first time a user has none.
  React.useEffect(() => {
    if (!uid || loading || seededRef.current) return;
    if (lists.length === 0) {
      seededRef.current = true;
      fbDb.collection('lists').add({
        name: 'הרשימה שלי',
        ownerUid: uid,
        members: [uid],
        memberInfo: { [uid]: { name: user?.displayName || '', email: user?.email || '' } },
        groups: ['קניות', 'כל מיני'],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch((e) => { console.error('seed list', e); seededRef.current = false; });
    }
  }, [uid, loading, lists.length]);

  // Keep a valid active list selected.
  React.useEffect(() => {
    if (!lists.length) { if (activeListId) setActiveListId(null); return; }
    if (!activeListId || !lists.some(l => l.id === activeListId)) {
      setActiveListId(lists[0].id);
    }
  }, [lists, activeListId]);

  // Subscribe to the active list's items.
  React.useEffect(() => {
    if (!activeListId || !window.fbDb) { setItems([]); return; }
    const unsub = fbDb.collection('lists').doc(activeListId).collection('items')
      .onSnapshot((snap) => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        setItems(rows);
      }, (err) => console.error('list items subscribe error', err));
    return () => unsub();
  }, [activeListId]);

  const activeList = React.useMemo(
    () => lists.find(l => l.id === activeListId) || null,
    [lists, activeListId]
  );

  const ops = React.useMemo(() => {
    const col = () => fbDb.collection('lists');
    const meInfo = () => ({ name: user?.displayName || '', email: user?.email || '' });
    return {
      createList: async (name) => {
        const ref = await col().add({
          name: name || 'רשימה חדשה', ownerUid: uid, members: [uid],
          memberInfo: { [uid]: meInfo() }, groups: ['כל מיני'],
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
        amount: (item.amount === '' || item.amount == null) ? null : Number(item.amount),
        checked: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }),
      updateItem: (id, item) => {
        const { id: itemId, ...rest } = item;
        const data = { ...rest };
        if ('amount' in data) data.amount = (data.amount === '' || data.amount == null) ? null : Number(data.amount);
        return col().doc(id).collection('items').doc(itemId).set(data, { merge: true });
      },
      toggleItem: (id, item) =>
        col().doc(id).collection('items').doc(item.id).set({ checked: !item.checked }, { merge: true }),
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
        } catch (e) {
          console.error('join list error', e);
          return { ok: false, reason: 'invalid' };
        }
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
function ExpenseListSection({ lists }) {
  const { loading, activeList, activeListId, items, ops } = lists;
  const [collapsed, setCollapsed] = useStickyState('home.listCollapsed', false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState(null);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [addGroup, setAddGroup] = React.useState(null);
  const toast = useToast();

  const groups = (activeList?.groups && activeList.groups.length) ? activeList.groups : ['כל מיני'];
  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const title = activeList?.name || 'רשימות';
  const shared = (activeList?.members?.length || 1) > 1;

  // Bucket items by group; anything with an unknown/empty group falls into "אחר".
  const buckets = React.useMemo(() => {
    const map = {};
    groups.forEach(g => { map[g] = []; });
    const extra = [];
    items.forEach(it => {
      if (it.group && map[it.group]) map[it.group].push(it);
      else extra.push(it);
    });
    return { map, extra };
  }, [items, groups.join('|')]);

  const manageBtn = (
    <button onClick={() => setManageOpen(true)} aria-label="נהל רשימה" style={{
      width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
      background: 'var(--surface-2)', color: 'var(--ink)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon name="more" size={18} />
    </button>
  );

  const openAdd = (group) => { setAddGroup(group || groups[0]); setAddOpen(true); };

  return (
    <div>
      <SectionHeader
        title={title}
        count={loading ? null : items.length}
        collapsible collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        onAdd={() => openAdd()}
        addLabel="הוסף פריט"
        rightNode={manageBtn}
      />

      {shared && !collapsed && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, margin: '-4px 4px 10px',
          fontSize: 11.5, fontWeight: 700, color: 'var(--ink-dim)',
          background: 'var(--surface-2)', padding: '4px 10px', borderRadius: 999,
        }}>
          <Icon name="user" size={12} />
          משותפת · {activeList.members.length} חשבונות
        </div>
      )}

      {!collapsed && (
        loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
            <Spinner size={24} color="var(--accent)" />
          </div>
        ) : items.length === 0 ? (
          <div style={{
            background: 'var(--surface-1)', borderRadius: 20, padding: '26px 18px',
            textAlign: 'center', color: 'var(--ink-dim)',
          }}>
            <div style={{ fontSize: 14, marginBottom: 12 }}>הרשימה ריקה</div>
            <button onClick={() => openAdd()} style={{
              background: 'var(--accent)', color: 'var(--accent-fg)', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', padding: '9px 16px',
              borderRadius: 999, fontWeight: 700, fontSize: 13.5,
            }}>הוסף פריט ראשון</button>
          </div>
        ) : (
          <div style={{ background: 'var(--surface-1)', borderRadius: 20, overflow: 'hidden' }}>
            {groups.map((g) => {
              const list = buckets.map[g] || [];
              return (
                <GroupBlock key={g} label={g} items={list}
                  onAdd={() => openAdd(g)}
                  onToggle={(it) => ops.toggleItem(activeListId, it)}
                  onOpen={(it) => setEditItem(it)} />
              );
            })}
            {buckets.extra.length > 0 && (
              <GroupBlock label="ללא קבוצה" items={buckets.extra}
                onToggle={(it) => ops.toggleItem(activeListId, it)}
                onOpen={(it) => setEditItem(it)} />
            )}
            {total > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '13px 16px', borderTop: '1px solid var(--divider)',
                fontSize: 13.5, fontWeight: 700,
              }}>
                <span style={{ color: 'var(--ink-dim)' }}>סה״כ</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(total)}</span>
              </div>
            )}
          </div>
        )
      )}

      <AddListItemSheet open={addOpen} onClose={() => setAddOpen(false)}
        groups={groups} defaultGroup={addGroup}
        onAdd={(item) => { ops.addItem(activeListId, item); toast('נוסף לרשימה', { type: 'success' }); }} />

      <EditListItemSheet open={!!editItem} onClose={() => setEditItem(null)}
        item={editItem} groups={groups}
        onSave={(item) => { ops.updateItem(activeListId, item); setEditItem(null); }}
        onDelete={(id) => { ops.removeItem(activeListId, id); setEditItem(null); toast('נמחק', { type: 'info' }); }} />

      <ManageListSheet open={manageOpen} onClose={() => setManageOpen(false)} lists={lists} />
    </div>
  );
}

function GroupBlock({ label, items, onAdd, onToggle, onOpen }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 16px 7px',
      }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em',
          color: 'var(--ink-dim)', textTransform: 'uppercase' }}>{label}</span>
        {onAdd && (
          <button onClick={onAdd} aria-label={`הוסף ל${label}`} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-dim)',
            display: 'inline-flex', alignItems: 'center', padding: 2,
          }}>
            <Icon name="plus" size={15} strokeWidth={2.4} />
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '2px 16px 12px', fontSize: 12.5, color: 'var(--ink-dim)', opacity: .7 }}>
          אין פריטים
        </div>
      ) : items.map((it, i) => (
        <ListItemRow key={it.id} item={it} first={i === 0}
          onToggle={() => onToggle(it)} onOpen={() => onOpen(it)} />
      ))}
    </div>
  );
}

function ListItemRow({ item, first, onToggle, onOpen }) {
  const checked = !!item.checked;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
      borderTop: first ? 'none' : '1px solid var(--divider)',
    }}>
      <button onClick={onToggle} aria-label={checked ? 'בטל סימון' : 'סמן כבוצע'} style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
        border: checked ? 'none' : '2px solid var(--surface-3)',
        background: checked ? 'var(--accent)' : 'transparent',
        color: 'var(--accent-fg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <Icon name="check" size={14} strokeWidth={3} />}
      </button>
      <button onClick={onOpen} style={{
        flex: 1, minWidth: 0, textAlign: 'start', background: 'transparent', border: 'none',
        cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)', padding: 0,
      }}>
        <div style={{
          fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
          textDecoration: checked ? 'line-through' : 'none',
          opacity: checked ? .5 : 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.title || 'ללא שם'}</div>
      </button>
      {item.amount != null && item.amount !== '' && (
        <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          opacity: checked ? .5 : 1, flexShrink: 0 }}>
          {fmtMoney(item.amount)}
        </div>
      )}
    </div>
  );
}

// ---------- Shared inputs ----------
function FieldInput({ value, onChange, placeholder, type = 'text', onEnter, dir, inputRef }) {
  return (
    <input
      ref={inputRef}
      value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} type={type} dir={dir}
      onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter(); }}
      style={{
        width: '100%', background: 'var(--surface-2)', border: 'none', outline: 'none',
        color: 'var(--ink)', fontSize: 16, fontWeight: 600, fontFamily: 'inherit',
        padding: '13px 15px', borderRadius: 14, boxSizing: 'border-box',
      }}
    />
  );
}

function GroupChips({ groups, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {groups.map(g => (
        <Chip key={g} active={value === g} onClick={() => onChange(g)}>{g}</Chip>
      ))}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '14px', borderRadius: 14, border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      background: 'var(--accent)', color: 'var(--accent-fg)', fontWeight: 800, fontSize: 15,
      opacity: disabled ? .5 : 1,
    }}>{children}</button>
  );
}

// ---------- Add / Edit item sheets ----------
function AddListItemSheet({ open, onClose, groups, defaultGroup, onAdd }) {
  const [title, setTitle] = React.useState('');
  const [group, setGroup] = React.useState(defaultGroup || groups[0]);
  const [amount, setAmount] = React.useState('');
  const titleRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle(''); setAmount(''); setGroup(defaultGroup || groups[0]);
    // Focus the field only once the sheet is actually open and on-screen, and
    // never let it scroll the page. Auto-focusing an off-screen input (the sheet
    // is always mounted) would scroll the whole app and drag hidden sheets into
    // view — the cause of the "stuck panel on entry" bug.
    const id = setTimeout(() => {
      try { titleRef.current && titleRef.current.focus({ preventScroll: true }); } catch (e) {}
    }, 360);
    return () => clearTimeout(id);
  }, [open, defaultGroup]);

  const submit = () => {
    if (!title.trim()) return;
    onAdd({ title, group, amount });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="הוספת פריט" height="72%">
      <div style={{ padding: '18px 22px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <Label>שם הפריט</Label>
          <FieldInput inputRef={titleRef} value={title} onChange={setTitle} placeholder="למשל: חלב, סוללות..." onEnter={submit} />
        </div>
        <div>
          <Label>קבוצה</Label>
          <GroupChips groups={groups} value={group} onChange={setGroup} />
        </div>
        <div>
          <Label>סכום (לא חובה)</Label>
          <FieldInput value={amount} onChange={setAmount} placeholder="₪" type="number" onEnter={submit} />
        </div>
        <PrimaryButton onClick={submit} disabled={!title.trim()}>הוסף לרשימה</PrimaryButton>
      </div>
    </Sheet>
  );
}

function EditListItemSheet({ open, onClose, item, groups, onSave, onDelete }) {
  const [title, setTitle] = React.useState('');
  const [group, setGroup] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const confirm = useConfirm();

  React.useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setGroup(item.group || groups[0]);
      setAmount(item.amount == null ? '' : String(item.amount));
    }
  }, [item]);

  const save = () => {
    if (!title.trim()) return;
    onSave({ id: item.id, title: title.trim(), group, amount });
  };
  const del = async () => {
    const ok = await confirm({ title: 'מחיקת פריט', message: 'הפריט יימחק מהרשימה', confirmLabel: 'מחק' });
    if (ok) onDelete(item.id);
  };

  return (
    <Sheet open={open} onClose={onClose} title="עריכת פריט" height="76%">
      <div style={{ padding: '18px 22px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <Label>שם הפריט</Label>
          <FieldInput value={title} onChange={setTitle} onEnter={save} />
        </div>
        <div>
          <Label>קבוצה</Label>
          <GroupChips groups={groups} value={group} onChange={setGroup} />
        </div>
        <div>
          <Label>סכום (לא חובה)</Label>
          <FieldInput value={amount} onChange={setAmount} placeholder="₪" type="number" onEnter={save} />
        </div>
        <PrimaryButton onClick={save} disabled={!title.trim()}>שמור</PrimaryButton>
        <button onClick={del} style={{
          width: '100%', padding: '12px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'transparent', color: '#FF5C5C', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Icon name="trash" size={16} /> מחק פריט
        </button>
      </div>
    </Sheet>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-dim)', marginBottom: 9 }}>
      {children}
    </div>
  );
}

// ---------- Manage / share sheet ----------
function ManageListSheet({ open, onClose, lists }) {
  const { activeList, activeListId, lists: allLists, setActiveListId, ops } = lists;
  const [name, setName] = React.useState('');
  const [newGroup, setNewGroup] = React.useState('');
  const [joinCode, setJoinCode] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const user = window.fbAuth?.currentUser;
  const isOwner = activeList && user && activeList.ownerUid === user.uid;
  const groups = activeList?.groups || [];

  React.useEffect(() => { if (activeList) setName(activeList.name || ''); }, [activeList, open]);

  const saveName = () => {
    const n = name.trim();
    if (activeList && n && n !== activeList.name) ops.renameList(activeListId, n);
  };

  const addGroup = () => {
    const g = newGroup.trim();
    if (!g || groups.includes(g)) { setNewGroup(''); return; }
    ops.setGroups(activeListId, [...groups, g]);
    setNewGroup('');
  };
  const removeGroup = (g) => {
    ops.setGroups(activeListId, groups.filter(x => x !== g));
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(activeListId); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { toast('לא ניתן להעתיק — סמן והעתק ידנית', { type: 'error' }); }
  };

  const join = async () => {
    const res = await ops.joinByCode(joinCode);
    if (res.ok) { setJoinCode(''); toast('הצטרפת לרשימה', { type: 'success' }); onClose(); }
    else if (res.reason !== 'empty') toast('קוד לא תקין או שאין הרשאה', { type: 'error' });
  };

  const removeCurrent = async () => {
    if (!activeList) return;
    if (isOwner) {
      const ok = await confirm({ title: 'מחיקת רשימה', message: `הרשימה "${activeList.name}" וכל הפריטים בה יימחקו לצמיתות`, confirmLabel: 'מחק' });
      if (ok) { await ops.deleteList(activeListId); onClose(); toast('הרשימה נמחקה', { type: 'info' }); }
    } else {
      const ok = await confirm({ title: 'יציאה מהרשימה', message: 'תפסיק לראות את הרשימה המשותפת. אפשר להצטרף שוב עם הקוד.', confirmLabel: 'צא' });
      if (ok) { await ops.leaveList(activeListId); onClose(); toast('יצאת מהרשימה', { type: 'info' }); }
    }
  };

  const members = activeList?.members || [];
  const memberInfo = activeList?.memberInfo || {};

  return (
    <Sheet open={open} onClose={onClose} title="ניהול רשימה" height="90%">
      <div style={{ padding: '18px 22px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Switch / create lists */}
        {allLists.length > 0 && (
          <Section title="הרשימות שלי">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {allLists.map(l => (
                <Chip key={l.id} active={l.id === activeListId} onClick={() => setActiveListId(l.id)}>
                  {l.name}{(l.members?.length || 1) > 1 ? ' ·👥' : ''}
                </Chip>
              ))}
            </div>
            <button onClick={() => ops.createList('רשימה חדשה')} style={ghostBtn}>
              <Icon name="plus" size={16} /> רשימה חדשה
            </button>
          </Section>
        )}

        {/* Rename */}
        <Section title="שם הרשימה">
          <div style={{ display: 'flex', gap: 8 }}>
            <FieldInput value={name} onChange={setName} onEnter={saveName} />
            <button onClick={saveName} style={{ ...ghostBtn, width: 'auto', padding: '0 16px', whiteSpace: 'nowrap' }}>שמור</button>
          </div>
        </Section>

        {/* Groups */}
        <Section title="קבוצות">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {groups.map(g => (
              <div key={g} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--surface-2)', borderRadius: 12, padding: '10px 14px',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{g}</span>
                <button onClick={() => removeGroup(g)} aria-label="מחק קבוצה" disabled={groups.length <= 1} style={{
                  background: 'transparent', border: 'none', cursor: groups.length <= 1 ? 'not-allowed' : 'pointer',
                  color: '#FF5C5C', opacity: groups.length <= 1 ? .35 : 1, padding: 4,
                }}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <FieldInput value={newGroup} onChange={setNewGroup} placeholder="קבוצה חדשה (למשל: ירקות)" onEnter={addGroup} />
            <button onClick={addGroup} style={{ ...ghostBtn, width: 'auto', padding: '0 16px', whiteSpace: 'nowrap' }}>
              <Icon name="plus" size={16} /> הוסף
            </button>
          </div>
        </Section>

        {/* Share */}
        <Section title="שיתוף הרשימה">
          <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginBottom: 10, lineHeight: 1.5 }}>
            שלח את הקוד הזה למי שתרצה לשתף. מי שיזין אותו יראה ויערוך את הרשימה יחד איתך.
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px',
          }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr' }}>
              {activeListId || '—'}
            </span>
            <button onClick={copyCode} style={{ ...ghostBtn, width: 'auto', padding: '8px 14px', whiteSpace: 'nowrap' }}>
              {copied ? 'הועתק ✓' : 'העתק'}
            </button>
          </div>
        </Section>

        {/* Join */}
        <Section title="הצטרפות לרשימה משותפת">
          <div style={{ display: 'flex', gap: 8 }}>
            <FieldInput value={joinCode} onChange={setJoinCode} placeholder="הדבק כאן קוד רשימה" dir="ltr" onEnter={join} />
            <button onClick={join} style={{ ...ghostBtn, width: 'auto', padding: '0 16px', whiteSpace: 'nowrap' }}>הצטרף</button>
          </div>
        </Section>

        {/* Members */}
        {members.length > 0 && (
          <Section title={`חברים ברשימה · ${members.length}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(m => {
                const info = memberInfo[m] || {};
                const isYou = user && m === user.uid;
                const owner = activeList.ownerUid === m;
                return (
                  <div key={m} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'var(--surface-2)', borderRadius: 12, padding: '10px 14px',
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Icon name="user" size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {info.name || info.email || 'משתמש'}{isYou ? ' (אתה)' : ''}
                      </div>
                      {info.email && (
                        <div style={{ fontSize: 11.5, color: 'var(--ink-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {info.email}
                        </div>
                      )}
                    </div>
                    {owner && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                        background: 'var(--accent)', color: 'var(--accent-fg)' }}>בעלים</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Delete / leave */}
        <button onClick={removeCurrent} style={{
          width: '100%', padding: '13px', borderRadius: 14, border: '1px solid #FF5C5C',
          cursor: 'pointer', background: 'transparent', color: '#FF5C5C',
          fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Icon name={isOwner ? 'trash' : 'arrow-right'} size={16} />
          {isOwner ? 'מחק רשימה' : 'צא מהרשימה'}
        </button>
      </div>
    </Sheet>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-dim)', letterSpacing: '.06em',
        textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '11px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
  background: 'var(--surface-3)', color: 'var(--ink)', fontFamily: 'inherit',
  fontWeight: 700, fontSize: 13.5,
};

Object.assign(window, {
  useLists, ExpenseListSection, AddListItemSheet, EditListItemSheet, ManageListSheet,
});
