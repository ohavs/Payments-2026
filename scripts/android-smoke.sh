#!/usr/bin/env bash
# Installs the APK on the CI emulator, launches it and checks the web app
# booted to the login screen (WebView text shows up in the UI dump).
set -euo pipefail
APK=$1
adb install -r "$APK"
adb shell dumpsys package com.ohavs.payments | grep -E "versionCode|versionName" | head -2
adb logcat -c
# A slow first boot can leave a "System UI isn't responding" dialog on top.
close_dialogs() { adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true; }
close_dialogs
adb shell am start -W -n com.ohavs.payments/.MainActivity
START=$(date +%s)
while [ $(( $(date +%s) - START )) -lt 120 ]; do
  sleep 3
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || continue
  adb pull /sdcard/ui.xml ui.xml >/dev/null 2>&1 || continue
  if grep -q "המשך עם Google" ui.xml; then
    echo "login screen rendered after $(( $(date +%s) - START ))s"
    adb exec-out screencap -p > android-smoke.png
    booted=1
    break
  fi
  if grep -qiE "isn.t responding|keeps stopping" ui.xml; then
    echo "system dialog on screen, closing it"; close_dialogs
    adb shell am start -n com.ohavs.payments/.MainActivity >/dev/null
  fi
done
if [ -z "${booted:-}" ]; then
  echo "login screen never appeared"; adb exec-out screencap -p > android-smoke.png || true
  echo "on screen:"; grep -o 'text="[^"]\+"\|package="[^"]*"' ui.xml 2>/dev/null | sort | uniq -c | sort -rn | head -30 || true
  adb logcat -d | grep -iE "chromium|console|capacitor|AndroidRuntime|ANR" | grep -v "uiautomator\|RuntimeInit\|boot image\|lock profiling\|nativeloader\|Shutting down VM" | tail -80
  exit 1
fi

# Payment detection: the notification listener is declared correctly and
# Android binds it once access is granted (what the user does in Settings).
LISTENER=com.ohavs.payments/com.ohavs.payments.detect.PaymentListenerService
adb shell cmd notification allow_listener "$LISTENER"
sleep 4
if adb shell dumpsys notification | grep -q "$LISTENER"; then
  echo "payment listener registered"
else
  echo "payment listener not registered"; adb shell dumpsys notification | grep -iA3 "listener" | head -40
  exit 1
fi
adb shell pidof com.ohavs.payments >/dev/null || { echo "app died after enabling the listener"; adb logcat -d | grep -E "AndroidRuntime" -A20 | tail -60; exit 1; }
