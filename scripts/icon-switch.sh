#!/usr/bin/env bash
# Launcher icon: icons per palette were dropped, so a phone that had switched
# to another palette's icon goes back to the green one once the user leaves
# the app: home (onUserLeaveHint) or screen off (onStop only). Needs adb root
# and the app installed.
set -euo pipefail
PKG=com.ohavs.payments
# Newer images drop the connection while adbd restarts as root ("unable to
# connect for root: closed"), so check the result instead of the exit code.
for i in 1 2 3; do
  adb root >/dev/null 2>&1 || true
  sleep 3; adb wait-for-device
  [ "$(adb shell id -u | tr -d '\r')" = 0 ] && break
done
[ "$(adb shell id -u | tr -d '\r')" = 0 ] || { echo "no adb root"; exit 1; }

launcher() { adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER $PKG | tail -1 | tr -d '\r'; }
# The state an older version left after switching to the violet icon.
violet() {
  sleep 12  # the previous switch's batched broadcast settles first
  adb shell am force-stop $PKG
  adb shell pm enable $PKG/.IconViolet >/dev/null
  adb shell pm disable $PKG/.MainActivity >/dev/null
  sleep 2
}
expect() {  # alias, what was done
  local now; now=$(launcher)
  echo "launcher entry after $2: $now"
  [ "$now" = "$PKG/$1" ] || {
    echo "launcher entry is not $1"
    adb logcat -d | grep -E "AppIcons|AndroidRuntime|$PKG" | tail -30
    exit 1
  }
}

adb shell getprop ro.build.version.release | sed 's/^/Android /'
expect .MainActivity "install"

# Home key.
violet
expect .IconViolet "switching to violet"
adb shell am start -W -n $PKG/.IconViolet | grep -q "Status: ok" || { echo "the violet icon does not open the app"; exit 1; }
sleep 6
adb shell input keyevent KEYCODE_HOME
sleep 4
expect .MainActivity "home"

# Screen off: no leave hint, only onStop.
violet
adb shell am start -W -n $PKG/.IconViolet >/dev/null
sleep 6
adb shell input keyevent KEYCODE_SLEEP
sleep 5
expect .MainActivity "screen off"
adb shell input keyevent KEYCODE_WAKEUP; sleep 1; adb shell wm dismiss-keyguard || true
# The system applies the switch with a batched broadcast; let it settle.
sleep 12
adb shell am start -W -n $PKG/.MainActivity | grep -q "Status: ok" || { echo "the green icon does not open the app"; exit 1; }
echo "icon reset ok"
