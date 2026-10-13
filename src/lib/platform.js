// Native (Android app) vs web. Everything platform-specific goes through here
// so screens don't need to know where they run.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNative = Capacitor.isNativePlatform();

// ---- Android back button ----
// Open sheets push a close handler; back closes the topmost one. With nothing
// open, the app's base handler decides (go to the home tab, or exit).
const backStack = [];
let baseBack = null;

export function pushBackHandler(fn) {
  backStack.push(fn);
  return () => {
    const i = backStack.lastIndexOf(fn);
    if (i !== -1) backStack.splice(i, 1);
  };
}

export function setBaseBackHandler(fn) { baseBack = fn; }

if (isNative) {
  App.addListener('backButton', () => {
    const top = backStack[backStack.length - 1];
    if (top) { top(); return; }
    if (baseBack && baseBack()) return;
    App.exitApp();
  });
}

// ---- Status bar icons follow the theme ----
export function setStatusBarTheme(dark) {
  if (!isNative) return;
  StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
}

export async function appVersion() {
  if (!isNative) return null;
  const info = await App.getInfo();
  return { name: info.version, code: Number(info.build) || 0 };
}
