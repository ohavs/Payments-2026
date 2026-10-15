#!/usr/bin/env bash
# Launcher icon per palette: the app keeps the asked-for icon in its prefs
# (Settings > מראה) and switches the launcher entry once it leaves the
# screen: home (onUserLeaveHint) or screen off (onStop only, like leaving
# with gesture navigation on some phones). Needs adb root and the app installed.
# Usage: bash scripts/icon-switch.sh [shot-prefix]
set -euo pipefail
PKG=com.ohavs.payments
SHOT=${1:-widget-14}
# Newer images drop the connection while adbd restarts as root ("unable to
# connect for root: closed"), so check the result instead of the exit code.
for i in 1 2 3; do
  adb root >/dev/null 2>&1 || true
  sleep 3; adb wait-for-device
  [ "$(adb shell id -u | tr -d '\r')" = 0 ] && break
done
[ "$(adb shell id -u | tr -d '\r')" = 0 ] || { echo "no adb root"; exit 1; }

launcher() { adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER $PKG | tail -1 | tr -d '\r'; }
ask_icon() {
  adb shell am force-stop $PKG
  local dir=/data/data/$PKG/shared_prefs owner
  owner=$(adb shell stat -c %u:%g /data/data/$PKG | tr -d '\r')
  printf '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<map>\n    <string name="pending">%s</string>\n</map>\n' "$1" > app_icon.xml
  adb push app_icon.xml /data/local/tmp/app_icon.xml >/dev/null
  adb shell "mkdir -p $dir && cp /data/local/tmp/app_icon.xml $dir/app_icon.xml && chown $owner $dir $dir/app_icon.xml && chmod 660 $dir/app_icon.xml && restorecon -R $dir" >/dev/null
}
expect() {  # alias, what was done
  local now; now=$(launcher)
  echo "launcher entry after $2: $now"
  [ "$now" = "$PKG/$1" ] || {
    echo "icon did not switch to $1"
    adb shell cat /data/data/$PKG/shared_prefs/app_icon.xml || true
    adb logcat -d | grep -E "AppIcons|AndroidRuntime|$PKG" | tail -30
    exit 1
  }
}

adb shell getprop ro.build.version.release | sed 's/^/Android /'
expect .MainActivity "install"

# Home key.
ask_icon violet
adb shell am start -W -n $PKG/.MainActivity >/dev/null
sleep 6
adb shell input keyevent KEYCODE_HOME
sleep 4
expect .IconViolet "home"
# The system applies the switch (launcher icons, and closing the task opened
# through the old icon) with a batched broadcast, up to ~10s later. A phone
# shows the new icon only then, so tap it only then.
sleep 12
# The new icon opens the app.
adb shell am start -W -n $PKG/.IconViolet | grep -q "Status: ok" || { echo "the violet icon does not open the app"; exit 1; }
sleep 4
adb shell dumpsys activity activities | grep -qE "$PKG/\.(AppActivity|IconViolet)" || { echo "app not running after the switch"; exit 1; }
adb shell input keyevent KEYCODE_HOME; sleep 2
adb shell input swipe 540 1900 540 400 300; sleep 3
adb exec-out screencap -p > "$SHOT-launcher-icon.png"; echo "shot $SHOT-launcher-icon"
adb shell input keyevent KEYCODE_HOME

# Screen off: no leave hint, only onStop.
ask_icon green
adb shell am start -W -n $PKG/.IconViolet >/dev/null
sleep 6
adb shell input keyevent KEYCODE_SLEEP
sleep 5
expect .MainActivity "screen off"
adb shell input keyevent KEYCODE_WAKEUP; sleep 1; adb shell wm dismiss-keyguard || true
echo "icon switch ok"
