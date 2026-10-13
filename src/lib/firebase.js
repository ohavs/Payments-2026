// Firebase (compat API, bundled from npm). Hosting used to inject the config
// from /__/firebase/init.js; that path doesn't exist inside an Android APK, so
// the public web config lives here.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/messaging';

const config = {
  apiKey: 'AIzaSyDvFsWsB6gH988212-SbF8VdgIV-dfrAvA',
  authDomain: 'schedual-fdde7.firebaseapp.com',
  projectId: 'schedual-fdde7',
  storageBucket: 'schedual-fdde7.firebasestorage.app',
  messagingSenderId: '267719533646',
  appId: '1:267719533646:web:c5fe14d9fa9d3930734f1f',
};

// VAPID public key for FCM Web Push (safe to ship in client).
export const FCM_VAPID_KEY = 'BLNBh697CTtcMnsr4XkUTX11HdCehqTLP8M1eZAo9_XlPgp3GBTa2G0z-XWZOIw4_fv-5Gtf7L6nXLePzpe-SN4';

// Local development and end-to-end tests run against the Firebase emulators.
const useEmulators = !!import.meta.env.VITE_USE_EMULATORS;

firebase.initializeApp(useEmulators ? { ...config, projectId: 'demo-payments' } : config);

if (useEmulators) {
  firebase.auth().useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
  firebase.firestore().useEmulator('127.0.0.1', 8080);
  window.firebase = firebase; // lets e2e scripts seed data through the same SDK
}

export default firebase;
