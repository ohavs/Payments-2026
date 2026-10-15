// The app's palette (Settings > מראה): accent colours and the texture behind
// the screens (styles.css, [data-palette]), the favicon, and on Android the
// launcher icon. Kept on the phone too, so the next start opens in it before
// the settings load.
import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform.js';
import { iconSvg, validPalette } from './app-icons.js';

const AppIcon = registerPlugin('AppIcon');
const KEY = 'palette';

export function storedPalette() {
  try { return validPalette(localStorage.getItem(KEY)); } catch (e) { return validPalette(null); }
}

export function applyPalette(id) {
  const palette = validPalette(id);
  document.documentElement.dataset.palette = palette;
  try { localStorage.setItem(KEY, palette); } catch (e) { /* private mode */ }
  const icon = document.querySelector('link[rel="icon"][sizes="32x32"]');
  if (icon) icon.href = `data:image/svg+xml,${encodeURIComponent(iconSvg(palette, { size: 32, round: 16 }))}`;
  return palette;
}

// Android: the launcher icon follows, once the user leaves the app (switching
// it closes the app's screen). Returns { current, pending } or null.
export async function setLauncherIcon(id) {
  if (!isNative) return null;
  try { return await AppIcon.set({ name: validPalette(id) }); } catch (e) { return null; }
}

export async function launcherIcon() {
  if (!isNative) return null;
  try { return await AppIcon.get(); } catch (e) { return null; }
}
