// Main app shell — state, theme, navigation, mounts screens & sheets
const { useState: _useState4, useEffect: _useEffect4, useMemo: _useMemo4 } = React;

function App() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);

  // Apply theme + accent + radius via CSS vars
  useEffect(() => {
    const root = document.documentElement;
    const dark = t.theme === 'dark';
    root.style.setProperty('--bg', dark ? '#0B0B0B' : '#F4F4F2');
    root.style.setProperty('--surface-1', dark ? '#161616' : '#FFFFFF');
    root.style.setProperty('--surface-2', dark ? '#222222' : '#EFEFEC');
    root.style.setProperty('--surface-3', dark ? '#2E2E2E' : '#E2E2DE');
    root.style.setProperty('--ink', dark ? '#FAFAFA' : '#0B0B0B');
    root.style.setProperty('--ink-dim', dark ? '#8A8A8A' : '#6B6B6B');
    root.style.setProperty('--divider', dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)');
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-fg', '#0B0B0B');
    root.style.setProperty('--chip-bg', dark ? '#222222' : '#EFEFEC');
    root.style.setProperty('--chip-fg', dark ? '#FAFAFA' : '#0B0B0B');
    root.style.setProperty('--glass-border', dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)');
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'he';
  }, [t.theme, t.accent]);

  // App state — payments + settings come from Firestore (anonymous auth scopes to this browser)
  const [payments, paymentOps] = usePayments();
  const [settings, setSettings] = useFirebaseSettings();
  const [tab, setTab] = useState('home');
  const [detail, setDetail] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editCustom, setEditCustom] = useState(null); // payment whose customService is being edited

  // Sync settings.theme → tweak.theme (so changing theme from settings page updates root vars)
  useEffect(() => {
    if (settings.theme && settings.theme !== t.theme) setTweak('theme', settings.theme);
  }, [settings.theme]);

  // Handlers — write through to Firestore
  const openPayment = (p) => setDetail(p);
  const savePayment = (p) => paymentOps.update(p);
  const deletePayment = (id) => { paymentOps.remove(id); setDetail(null); };
  const addPayment = (p) => paymentOps.add(p);

  return (
    <div style={{
      width: '100%', minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)',
      position: 'relative', display: 'flex', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 480, height: '100vh', position: 'relative',
        background: 'var(--bg)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }} data-screen-label={`tab: ${tab}`}>
        {/* Decorative bg orbs — the surface the glass cards read against */}
        <div className="bg-orbs" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        {/* Scrollable screen body (only for tabs that need page scroll) */}
        <div style={{
          flex: 1, minHeight: 0,
          overflowY: tab === 'home' ? 'hidden' : 'auto',
          overflowX: 'hidden',
        }}>
        {tab === 'home' && (
          <HomeScreen
            payments={payments}
            onOpenPayment={openPayment}
            onOpenAdd={() => setAddOpen(true)}
            settings={settings}
          />
        )}
        {tab === 'calendar' && (
          <CalendarScreen
            payments={payments}
            onOpenPayment={openPayment}
            onOpenAdd={() => setAddOpen(true)}
          />
        )}
        {tab === 'settings' && (
          <SettingsScreen settings={settings} setSettings={setSettings} accent={t.accent} setAccent={v => setTweak('accent', v)} />
        )}
        </div>{/* /scrollable body */}

        {/* Bottom nav */}
        <BottomNav tab={tab} setTab={setTab} onAdd={() => setAddOpen(true)} />

        {/* Sheets */}
        <DetailSheet
          payment={detail}
          open={!!detail}
          onClose={() => setDetail(null)}
          onSave={savePayment}
          onDelete={deletePayment}
          onEditCustom={(p) => { setDetail(null); setEditCustom(p); }}
        />
        <AddSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdd={addPayment}
        />
        <EditCustomSheet
          payment={editCustom}
          open={!!editCustom}
          onClose={() => setEditCustom(null)}
          onSave={(p) => { savePayment(p); setEditCustom(null); }}
        />
      </div>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme" value={t.theme}
          options={['dark', 'light']}
          onChange={v => setTweak('theme', v)} />
        <TweakColor label="Accent" value={t.accent}
          options={['#F2FF44', '#A3FF6A', '#FF8A4C', '#7C5CFF']}
          onChange={v => setTweak('accent', v)} />
      </TweaksPanel>
    </div>
  );
}

function BottomNav({ tab, setTab, onAdd }) {
  const items = [
    { id: 'home', icon: 'home', label: 'בית' },
    { id: 'calendar', icon: 'calendar', label: 'לוח' },
    { id: 'settings', icon: 'settings', label: 'הגדרות' },
  ];
  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)', maxWidth: 448, zIndex: 50,
      background: 'var(--accent)',
      borderRadius: 999, padding: 6,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
      boxShadow: '0 12px 30px -10px rgba(0,0,0,.4), 0 0 0 1px rgba(0,0,0,.05)',
    }}>
      {items.map(item => {
        const active = tab === item.id;
        return (
          <button key={item.id} onClick={() => setTab(item.id)} style={{
            flex: 1, padding: '10px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: active ? '#0B0B0B' : 'transparent',
            color: active ? 'var(--accent)' : '#000',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all .18s ease',
          }}>
            <Icon name={item.icon} size={18} strokeWidth={active ? 2.4 : 2} />
            {active && <span>{item.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
