// A personal space created twice (the old first-sign-in bug) is merged into
// the oldest one: expenses move over, categories are combined.
import { expect, test } from '@playwright/test';
import { offline, signInGuest, trackErrors } from './helpers.js';

test('duplicate personal spaces are merged', async ({ page, context }) => {
  await offline(context);
  const errors = trackErrors(page);
  await signInGuest(page);
  await page.evaluate(async () => {
    const fb = window.firebase;
    const db = fb.firestore();
    const uid = fb.auth().currentUser.uid;
    const ref = await db.collection('lists').add({
      name: 'ההוצאות שלי', kind: 'personal', ownerUid: uid, members: [uid], memberInfo: {},
      groups: ['קניות', 'דלק'], invitedEmails: [], createdAt: fb.firestore.FieldValue.serverTimestamp(),
    });
    await ref.collection('items').doc('dup-1').set({ title: 'תדלוק', group: 'דלק', amount: 250, note: '', date: '2026-10-14' });
  });
  await page.reload();
  await expect.poll(() => page.evaluate(async () => {
    const fb = window.firebase;
    const uid = fb.auth().currentUser?.uid;
    if (!uid) return null;
    const s = await fb.firestore().collection('lists').where('members', 'array-contains', uid).get();
    const personal = s.docs.filter((d) => d.data().kind === 'personal');
    if (personal.length !== 1) return `personal: ${personal.length}`;
    const items = await personal[0].ref.collection('items').get();
    return { groups: personal[0].data().groups, items: items.docs.map((d) => d.id) };
  }), { timeout: 20_000 }).toEqual({ groups: ['קניות', 'ביטוחים', 'אוכל בחוץ', 'שונות', 'דלק'], items: ['dup-1'] });
  expect(errors).toEqual([]);
});
