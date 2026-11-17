// "Move everything" in space management: two personal spaces become one, then
// the personal space moves into the shared one with its subscriptions, and the
// tabs give way to a single heading.
import { expect, test } from '@playwright/test';
import { offline, quickAdd, signInGuest, trackErrors } from './helpers.js';

const mySpaces = (page) => page.evaluate(async () => {
  const fb = window.firebase;
  const uid = fb.auth().currentUser.uid;
  const s = await fb.firestore().collection('lists').where('members', 'array-contains', uid).get();
  const out = {};
  for (const d of s.docs) {
    const items = await d.ref.collection('items').get();
    const subs = await d.ref.collection('subs').get();
    out[d.data().name] = {
      kind: d.data().kind, hidden: !!d.data().hidden, groups: d.data().groups,
      items: items.docs.map((x) => ({ title: x.data().title, paidBy: x.data().paidBy === uid, moved: !!x.data().movedFrom })),
      subs: subs.docs.map((x) => ({ name: x.data().name, paidBy: x.data().paidBy === uid })),
    };
  }
  const personalSubs = await fb.firestore().collection('users').doc(uid).collection('payments').get();
  return { spaces: out, personalSubs: personalSubs.size };
});

async function moveTo(page, target) {
  await page.getByRole('button', { name: 'מרחבים ושיתוף' }).click();
  await page.getByRole('button', { name: `העבר הכל ל"${target}"` }).click();
  await page.getByRole('button', { name: 'העבר', exact: true }).click();
  await expect(page.getByText(`הכל הועבר ל"${target}"`)).toBeVisible();
}

test('move everything into one space', async ({ page, context }) => {
  await offline(context);
  const errors = trackErrors(page);
  await signInGuest(page, 'אוהב כהן');

  // A second personal space with an expense, and a personal subscription.
  await page.evaluate(async () => {
    const fb = window.firebase;
    const db = fb.firestore();
    const uid = fb.auth().currentUser.uid;
    const ref = await db.collection('lists').add({
      name: 'הרשימה שלי', kind: 'personal', ownerUid: uid, members: [uid], memberInfo: {},
      groups: ['קניות', 'דלק'], invitedEmails: [], createdAt: fb.firestore.FieldValue.serverTimestamp(),
    });
    await ref.collection('items').doc('fuel').set({ title: 'תדלוק', group: 'דלק', amount: 250, note: '', date: '2026-11-02', paidBy: uid, addedBy: uid });
    await db.collection('users').doc(uid).collection('payments').doc('spotify').set({
      name: 'Spotify', amount: 22, currency: '₪', frequency: 'monthly', nextDate: '2026-11-20', category: 'בידור',
    });
  });

  // Tabs at the top: both personal spaces by name, and "+ משותף".
  await expect(page.getByRole('tab', { name: 'הרשימה שלי' })).toBeVisible();
  await page.getByRole('tab', { name: 'ההוצאות שלי' }).click();
  await quickAdd(page, ['4', '0'], 'קניות');
  await page.getByRole('button', { name: '+ משותף' }).click();
  await page.getByRole('button', { name: 'פתח מרחב' }).click();
  await expect(page.getByRole('tab', { name: /הבית שלנו/ })).toHaveAttribute('aria-selected', 'true');

  // Personal into personal: the space is deleted, the expense moves.
  await page.getByRole('tab', { name: 'הרשימה שלי' }).click();
  await moveTo(page, 'ההוצאות שלי');
  await expect(page.getByRole('tab', { name: 'אישי' })).toHaveAttribute('aria-selected', 'true');
  let s = await mySpaces(page);
  expect(Object.keys(s.spaces).sort()).toEqual(['הבית שלנו', 'ההוצאות שלי']);
  expect(s.spaces['ההוצאות שלי'].items.map((i) => i.title).sort()).toEqual(['קניות', 'תדלוק']);
  expect(s.spaces['ההוצאות שלי'].groups).toContain('דלק');

  // Personal into shared: expenses and subscriptions move, paid by me; the
  // last personal space is kept but hidden, so only a heading is left.
  await page.getByRole('tab', { name: 'אישי' }).click();
  await moveTo(page, 'הבית שלנו');
  await expect(page.getByRole('heading', { name: 'הוצאות' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  s = await mySpaces(page);
  expect(s.spaces['ההוצאות שלי']).toMatchObject({ hidden: true, items: [] });
  expect(s.spaces['הבית שלנו'].items).toEqual(expect.arrayContaining([
    { title: 'קניות', paidBy: true, moved: true }, { title: 'תדלוק', paidBy: true, moved: true },
  ]));
  expect(s.spaces['הבית שלנו'].subs).toEqual([{ name: 'Spotify', paidBy: true }]);
  expect(s.personalSubs).toBe(0);
  await expect(page.getByRole('button', { name: /^תדלוק דלק/ })).toBeVisible();

  // It stays hidden after a reload, and can be brought back.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'הוצאות' })).toBeVisible();
  await page.getByRole('button', { name: 'מרחבים ושיתוף' }).click();
  await page.getByRole('button', { name: 'ההוצאות שלי (מוסתר)' }).click();
  await page.getByRole('button', { name: 'להחזיר לטאבים' }).click();
  await expect(page.getByRole('tab', { name: 'אישי' })).toBeVisible();
  expect(errors).toEqual([]);
});
