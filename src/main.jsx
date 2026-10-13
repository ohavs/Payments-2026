import '@fontsource-variable/rubik';
import './styles.css';
import ReactDOM from 'react-dom/client';
import { App } from './app.jsx';
import { isNative } from './lib/platform.js';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// Service worker: offline shell + FCM background push. Network-first inside the
// SW handles freshness; poll for updates and reload once a new one takes control.
if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator) {
  const wasControlled = !!navigator.serviceWorker.controller;
  let didReload = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Reload only on a genuine update (page was already controlled).
    if (!wasControlled || didReload) return;
    didReload = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.update();
      setInterval(() => reg.update(), 5 * 60 * 1000);
    }).catch((e) => console.warn('SW register failed', e));
  });
}
