import { expect, it } from 'vitest';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Two copies of @firebase/app-compat in node_modules (it happened after a
// version change) make the compat services register on the wrong instance and
// the app dies on startup with "firebase.auth is not a function".
it('compat services register on the same firebase namespace', () => {
  expect(typeof firebase.auth).toBe('function');
  expect(typeof firebase.firestore).toBe('function');
});
