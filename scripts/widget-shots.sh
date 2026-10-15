#!/usr/bin/env bash
# Hosts the home screen widget on the CI emulator (WidgetPreviewActivity) at
# three sizes, taps through it and saves screenshots: large (amount +
# category, saving queues without a real account, shared space, the new
# category sheet over the keyboard), medium (the category "dropdown" sheet,
# which saves), small, and dark.
set -euo pipefail
PKG=com.ohavs.payments
adb root >/dev/null; sleep 3; adb wait-for-device
adb shell appwidget grantbind --package $PKG --user 0

CONFIG='{"uid":"ci","refreshToken":"ci-not-a-token","apiKey":"ci","projectId":"schedual-fdde7","currency":"₪","activeSpaceId":"p1","spaces":[{"id":"p1","name":"ההוצאות שלי","shared":false,"groups":["קניות","ביטוחים","אוכל בחוץ","שונות"]},{"id":"s1","name":"הבית שלנו","shared":true,"groups":["קניות","בית","חשבונות","אוכל בחוץ","רכב","ספורט"]}]}'
B64=$(printf '%s' "$CONFIG" | base64 -w0)
B64_VIOLET=$(printf '%s' "${CONFIG%\}},\"palette\":\"violet\"}" | base64 -w0)
open_widget() {  # [widthDp heightDp [config64]]
  adb shell am force-stop $PKG
  sleep 2  # let the system drop the killed host before a new one registers
  adb shell am start -W -n $PKG/.widget.WidgetPreviewActivity --es config64 "${3:-$B64}" --ei widthDp "${1:-360}" --ei heightDp "${2:-380}" >/dev/null
  sleep 3
}
shot() { sleep 1.2; adb exec-out screencap -p > "$1.png"; echo "shot $1"; }
dump() { adb shell uiautomator dump /sdcard/w.xml >/dev/null 2>&1; adb pull /sdcard/w.xml w.xml >/dev/null; }
# "x1 y1 x2 y2" of the first node whose text is exactly $1 (from the last dump).
bounds() {
  grep -o "text=\"$1\"[^>]*bounds=\"\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]\"" w.xml | head -1 \
    | sed 's/.*bounds="\[\([0-9]*\),\([0-9]*\)\]\[\([0-9]*\),\([0-9]*\)\]"/\1 \2 \3 \4/'
}
# Taps the first node whose text (or content-desc) starts with $1; "=" before
# the value means the exact text (keypad keys).
tap() {
  dump
  local want=$1 end='[^"]*' b
  if [ "${want:0:1}" = "=" ]; then want=${want:1}; end=''; fi
  want=$(printf '%s' "$want" | sed 's/[].[*^$\\]/\\&/g')
  b=$(grep -o "\(text\|content-desc\)=\"$want$end\"[^>]*bounds=\"\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]\"" w.xml | head -1 \
    | sed 's/.*bounds="\[\([0-9]*\),\([0-9]*\)\]\[\([0-9]*\),\([0-9]*\)\]"/\1 \2 \3 \4/')
  if [ -z "$b" ]; then echo "no node: $1"; exit 1; fi
  set -- $b
  adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
  sleep 0.6
}

open_widget
dump
adb logcat -d -s WidgetPreview | tail -3
grep -q 'text="קניות"' w.xml || { echo "categories not listed"; grep -o 'text="[^"]*"\|bounds="[^"]*"' w.xml | head -40; adb logcat -d | grep -iE "RemoteViews|AppWidget|WidgetPreview" | tail -30; exit 1; }
# The keypad on the right, the categories on the left.
read -r K1 _ _ _ <<<"$(bounds 1)"; read -r _ _ C2 _ <<<"$(bounds קניות)"
echo "large: key 1 at x=$K1, categories end at x=$C2"
[ "$K1" -ge "$C2" ] || { echo "the keypad is not on the right"; exit 1; }
shot widget-1-empty
tap =4; tap =5; tap =.; tap =9
tap "קניות"
dump; grep -q 'text="שמור · ₪45.9"' w.xml || { echo "save button not ready"; exit 1; }
shot widget-2-ready
tap "שמור"
sleep 4
dump; grep -q 'יישמר' w.xml || { echo "no queued status after save"; grep -o 'text="[^"]*"' w.xml | head -40; exit 1; }
shot widget-3-saved
tap "אישי"
dump; grep -q 'text="חשבונות"' w.xml || { echo "shared space categories missing"; exit 1; }
shot widget-4-shared
tap =1; tap =2; tap =0
tap "+ קטגוריה"
sleep 2
adb shell input text "Gym"
sleep 1
# The sheet's button must sit above the keyboard (the bottom ~40% of the screen).
dump
BTN=$(grep -o 'text="הוסף ושמור[^"]*"[^>]*bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' w.xml | head -1 | sed 's/.*\]\[[0-9]*,\([0-9]*\)\]"/\1/')
SCREEN_H=$(adb shell wm size | grep -o '[0-9]*$')
echo "add button bottom: ${BTN:-none} of $SCREEN_H"
if [ -z "$BTN" ] || [ "$BTN" -gt $(( SCREEN_H * 62 / 100 )) ]; then echo "new category sheet is under the keyboard"; exit 1; fi
shot widget-5-new-category
adb shell input keyevent KEYCODE_BACK; sleep 0.5; adb shell input keyevent KEYCODE_BACK

# Medium: the category "dropdown" opens the sheet, and picking saves.
open_widget 260 300
dump; grep -q 'content-desc="קטגוריה"' w.xml || { echo "medium layout not shown"; grep -o 'text="[^"]*"' w.xml | head -30; exit 1; }
tap =2; tap =8
dump; grep -q 'text="₪28"' w.xml || { echo "medium widget did not update"; grep -o 'text="[^"]*"' w.xml | head -30; adb logcat -d | grep -E "WidgetPreview|AppWidgetServiceImpl" | tail -20; exit 1; }
shot widget-6-medium
adb logcat -d | grep -E "WidgetPreview|QuickAddWidget|AndroidRuntime|FATAL|RemoteViews|AppWidgetHostView" | tail -40
tap "קטגוריה"
sleep 2
dump; grep -q '₪28 · על מה?' w.xml || { echo "picker sheet missing"; grep -o 'text="[^"]*"' w.xml | head -30; exit 1; }
shot widget-7-picker
tap "אוכל בחוץ"
sleep 4
dump; grep -q 'text="יישמר אחרי כניסה באפליקציה"' w.xml && grep -q 'text="ממתין ✓"' w.xml || { echo "picking did not save"; grep -o 'text="[^"]*"' w.xml | head -30; exit 1; }
shot widget-8-medium-saved

# Small: numbers first.
open_widget 180 200
tap =6; tap =4
shot widget-9-small

# Wide and short (4×2): the keypad on the right of the amount and save bar,
# keys close to square.
open_widget 340 180
tap =3; tap =5
dump; grep -q 'text="₪35"' w.xml || { echo "wide widget did not update"; grep -o 'text="[^"]*"' w.xml | head -30; exit 1; }
read -r K1 _ _ _ <<<"$(bounds 1)"; read -r _ _ S2 _ <<<"$(bounds "בחרו קטגוריה")"
read -r A1 B1 A2 B2 <<<"$(bounds 5)"
echo "wide: key 1 at x=$K1, save bar ends at x=$S2, key 5 is $((A2 - A1))x$((B2 - B1))px"
[ -n "$S2" ] && [ "$K1" -ge "$S2" ] || { echo "wide: the keypad is not beside the panel"; exit 1; }
[ $(( (A2 - A1) * 10 )) -le $(( (B2 - B1) * 16 )) ] || { echo "wide: keys are stretched"; exit 1; }
shot widget-12-wide

# The app's palette on the widget's accents (violet).
open_widget 360 380 "$B64_VIOLET"
tap =8; tap "קניות"
shot widget-13-violet

adb shell cmd uimode night yes
sleep 3
open_widget
tap =7; tap =4
shot widget-10-dark
open_widget 180 200
tap =9
shot widget-11-dark-small
adb shell cmd uimode night no
echo "widget screenshots done"
