// In-app updates from GitHub Releases (Android only).
//
// Each release is tagged v<versionName> and its notes end with a marker
// <!-- update {"versionCode":N,"sha256":"…","apk":"payments.apk"} -->
// written by .github/workflows/android-release.yml.
import { registerPlugin } from '@capacitor/core';
import { appVersion, isNative } from './platform.js';

const ApkUpdater = registerPlugin('ApkUpdater');
const REPO = 'ohavs/Payments-2026';
const LAST_CHECK_KEY = 'update-last-check';

function parseRelease(rel) {
  const m = /<!--\s*update\s*(\{[\s\S]*?\})\s*-->/.exec(rel.body || '');
  if (!m) return null;
  const meta = JSON.parse(m[1]);
  const asset = (rel.assets || []).find((a) => a.name === meta.apk);
  if (!asset) return null;
  const notes = (rel.body || '').replace(m[0], '').trim();
  return {
    versionName: rel.tag_name.replace(/^v/, ''),
    versionCode: meta.versionCode,
    sha256: meta.sha256,
    url: asset.browser_download_url,
    sizeMb: Math.round(asset.size / 1e5) / 10,
    notes: notes.split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean),
    publishedAt: rel.published_at,
  };
}

// → { current, latest, available } ; throws on network errors.
export async function checkForUpdate() {
  if (!isNative) return { current: null, latest: null, available: false };
  const [current, res] = await Promise.all([
    appVersion(),
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } }),
  ]);
  if (!res.ok) throw new Error('GitHub ' + res.status);
  const latest = parseRelease(await res.json());
  try { localStorage.setItem(LAST_CHECK_KEY, String(Date.now())); } catch {}
  return { current, latest, available: !!latest && latest.versionCode > current.code };
}

// Background check at most every 6 hours.
export async function checkForUpdateQuietly() {
  if (!isNative) return null;
  try {
    const last = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
    if (Date.now() - last < 6 * 3600 * 1000) return null;
  } catch {}
  try { return await checkForUpdate(); } catch { return null; }
}

export const canInstallUpdates = async () => (await ApkUpdater.canInstall()).allowed;
export const openInstallSettings = () => ApkUpdater.openInstallSettings();

// Downloads, verifies and opens the installer. onProgress(0..100).
export async function installUpdate(latest, onProgress) {
  const sub = await ApkUpdater.addListener('progress', (e) => onProgress?.(e.percent));
  try {
    await ApkUpdater.downloadAndInstall({ url: latest.url, sha256: latest.sha256 });
  } finally {
    sub.remove();
  }
}
