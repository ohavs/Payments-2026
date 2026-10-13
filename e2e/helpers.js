// Shared steps for the e2e tests.
import { expect } from '@playwright/test';

// Fonts, exchange rates and GitHub are outside the emulators: answer them
// offline so the tests don't depend on the network.
export async function offline(context) {
  await context.route(/fonts\.(googleapis|gstatic)\.com|open\.er-api\.com|api\.github\.com/, (r) => r.abort());
}

// Uncaught exceptions fail the test (console noise from blocked hosts doesn't).
export function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

export async function signInGuest(page, name) {
  await page.goto('/');
  await page.getByText('המשך ללא חשבון').click({ timeout: 30_000 });
  await page.waitForFunction(() => window.firebase?.auth().currentUser, null, { timeout: 30_000 });
  if (name) await page.evaluate((n) => window.firebase.auth().currentUser.updateProfile({ displayName: n }), name);
  // The personal space is created on first sign-in.
  await page.waitForFunction(async () => {
    const fb = window.firebase;
    const s = await fb.firestore().collection('lists').where('members', 'array-contains', fb.auth().currentUser.uid).get();
    return !s.empty;
  }, null, { timeout: 30_000, polling: 500 });
}

export const tab = (page, label) => page.locator(`nav button[aria-label="${label}"]`).click();

export async function quickAdd(page, digits, category, payer) {
  await page.locator('nav button[aria-label="הוספת הוצאה"]').click();
  for (const d of digits) await page.locator(`button[aria-label="${d}"]`).click();
  await page.getByRole('button', { name: category, exact: true }).last().click();
  if (payer) await page.getByRole('button', { name: payer, exact: true }).last().click();
  await page.getByRole('button', { name: /^שמור · / }).click();
  await expect(page.getByRole('button', { name: /^שמור · / })).toBeHidden();
}

// Expenses of the user's spaces, straight from Firestore.
export function spaceItems(page, kind) {
  return page.evaluate(async (k) => {
    const fb = window.firebase;
    const s = await fb.firestore().collection('lists').where('members', 'array-contains', fb.auth().currentUser.uid).get();
    const list = s.docs.find((d) => (d.data().kind || 'personal') === k);
    if (!list) return null;
    const items = await list.ref.collection('items').get();
    return { id: list.id, items: items.docs.map((d) => d.data()) };
  }, kind);
}
