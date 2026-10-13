import { expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({}), Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/app', () => ({ App: {} }));
vi.mock('@capacitor/status-bar', () => ({ StatusBar: {}, Style: {} }));
vi.mock('./detect.js', () => ({ detectStatus: async () => ({}) }));

const { parseRelease } = await import('./updater.js');

// Shape of a real release as published by .github/workflows/android.yml.
const release = {
  tag_name: 'v2.0.4',
  published_at: '2026-10-13T05:18:31Z',
  body: '- אפליקציית אנדרואיד ראשונה\n- פתיחה מהירה יותר\n\n<!-- update {"versionCode":104,"sha256":"56caf3fcf0c5845f359e142ecd14831bf0ed896abe898e755c5fc9d9d9adcfa9","apk":"payments.apk"} -->\n',
  assets: [{ name: 'payments.apk', size: 6315022, browser_download_url: 'https://github.com/ohavs/Payments-2026/releases/download/v2.0.4/payments.apk' }],
};

it('reads version, checksum, download URL and notes from a release', () => {
  expect(parseRelease(release)).toEqual({
    versionName: '2.0.4',
    versionCode: 104,
    sha256: '56caf3fcf0c5845f359e142ecd14831bf0ed896abe898e755c5fc9d9d9adcfa9',
    url: 'https://github.com/ohavs/Payments-2026/releases/download/v2.0.4/payments.apk',
    sizeMb: 6.3,
    notes: ['אפליקציית אנדרואיד ראשונה', 'פתיחה מהירה יותר'],
    publishedAt: '2026-10-13T05:18:31Z',
  });
});

it('ignores releases without the update marker or the APK', () => {
  expect(parseRelease({ ...release, body: 'notes only' })).toBeNull();
  expect(parseRelease({ ...release, assets: [] })).toBeNull();
});

// Since the lite split: the marker carries both builds.
const split = {
  ...release,
  tag_name: 'v2.0.30',
  body: '- שיפורים\n\nטלפון חדש? להתקנה ראשונה מוואטסאפ או מהדפדפן: payments-lite.apk. את זיהוי התשלומים מתקינים אחר כך מתוך האפליקציה.\n\n<!-- update {"versionCode":130,"sha256":"aaa","apk":"payments.apk","lite":{"apk":"payments-lite.apk","sha256":"bbb"}} -->\n',
  assets: [
    { name: 'payments.apk', size: 7000000, browser_download_url: 'https://example.test/payments.apk' },
    { name: 'payments-lite.apk', size: 6900000, browser_download_url: 'https://example.test/payments-lite.apk' },
  ],
};

it('picks the build that matches the installed variant', () => {
  expect(parseRelease(split)).toMatchObject({ versionCode: 130, sha256: 'aaa', url: 'https://example.test/payments.apk', notes: ['שיפורים'] });
  expect(parseRelease(split, 'lite')).toMatchObject({ versionCode: 130, sha256: 'bbb', url: 'https://example.test/payments-lite.apk' });
  // A release from before the split has no lite build: lite installs take the full one.
  expect(parseRelease(release, 'lite')).toMatchObject({ versionCode: 104, url: release.assets[0].browser_download_url });
});
