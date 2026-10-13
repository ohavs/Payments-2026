// End-to-end tests against the Firebase emulators (auth + Firestore with the
// real firestore.rules). `npm test` in e2e/ starts the emulators; the app is
// built with VITE_USE_EMULATORS=1 into dist-emu/ (see .github/workflows/ci.yml).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://127.0.0.1:5002',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --outDir dist-emu --port 5002 --strictPort',
    cwd: '..',
    url: 'http://127.0.0.1:5002',
    reuseExistingServer: !process.env.CI,
  },
});
