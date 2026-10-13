#!/usr/bin/env bash
# Installs the APK on the CI emulator, launches it and checks the web app
# booted to the login screen (WebView text shows up in the UI dump).
set -euo pipefail
APK=$1
adb install -r "$APK"
adb shell dumpsys package com.ohavs.payments | grep -E "versionCode|versionName" | head -2
adb logcat -c
adb shell am start -W -n com.ohavs.payments/.MainActivity
for i in $(seq 1 20); do
  sleep 3
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || continue
  adb pull /sdcard/ui.xml ui.xml >/dev/null 2>&1 || continue
  if grep -q "המשך עם Google" ui.xml; then
    echo "login screen rendered after $((i * 3))s"
    adb exec-out screencap -p > android-smoke.png
    exit 0
  fi
done
echo "login screen never appeared"; adb exec-out screencap -p > android-smoke.png || true
adb logcat -d | grep -iE "chromium|console|capacitor|AndroidRuntime" | tail -120
exit 1
