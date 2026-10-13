# PROGRESS

## מצב נוכחי
- ענף פיתוח: `claude/optimistic-mccarthy-a7zskt`
- ענף מוגש (פריסה אוטומטית ל־Firebase Hosting): `claude/implement-payments-page-G9fij`
- אתר חי: https://schedual-fdde7.web.app
- תוכנית מלאה: `docs/PLAN.md`
- פרוטוטייפ עיצוב (שלב 0): https://claude.ai/artifact/LqLdFpPFf6dkWUTTEy9P5t

## נעשה
- [x] תוכנית: אנדרואיד עם Capacitor, עיצוב מחדש, 8 שלבים
- [x] שלב 0: פרוטוטייפ אינטראקטיבי (בית, ניתוח, הוספה מהירה, מנויים, פרופיל, עדכונים)
- [x] שלב 1: Vite + ES modules, React 19, Firebase מ־npm (compat), Hosting מגיש `dist/`
  - נבדק מול Firebase emulators: 9 מסכים זהים לפיקסל לגרסה הקודמת
  - תוקן: `nextDate` לא התקדם, ולכן תשלום "שולם לתמיד", תזכורות נעצרו ולוח השנה הראה מופע אחד (`src/lib/recurrence.js` + בדיקות)
  - תוקן: רשימת ההוצאות ריקה בכניסה הראשונה עד רענון
  - CI על כל ענף. הפריסה מריצה lint, בדיקות ו־build, ואחרי הפריסה בדיקת smoke על האתר החי

## הבא
- [x] שלב 2: אפליקציית Android (Capacitor 8). Release ראשון: v2.0.4 https://github.com/ohavs/Payments-2026/releases/latest
  - כניסת Google נייטיב, כפתור חזור, edge-to-edge, אייקון ו־splash
  - "בדוק עדכונים" בהגדרות + באנר בפתיחה. הורדה, בדיקת SHA-256, מתקין אנדרואיד
  - `android.yml`: APK חתום, בדיקת חתימה, הרצה על emulator (מסך הכניסה עולה), Release רק מהענף המוגש ורק כשמשהו באפליקציה השתנה. ההערות ב־`release-notes.md`
  - אפליקציית Android רשומה ב־Firebase (`1:267719533646:android:18a498064f979005734f1f`) עם SHA, `google-services.json` בריפו
  - טרם נבדק במכשיר אמיתי: כניסת Google ועדכון בפועל (מחכה למשתמש)
- [x] עיצוב מחדש (שלבים 4–5 בתוכנית, בגרסה מצומצמת לפי המשוב: פרקטיקה בפרונט)
  - טאבים: הוצאות · מנויים · + · הגדרות. ה־+ פותח הוספה מהירה עם מקלדת מספרים
  - הוצאות: סכום החודש, תקציב, סינון לפי קטגוריה, רשימה לפי ימים. "סיכום" פותח את הסטטיסטיקות
  - מנויים: סה״כ, החיוב הבא, רשימה לפי מועד, לוח שנה
  - הגדרות: כסף (תקציב, מעקבים ושיתוף, מטבע), התראות, מראה (אוטומטי/בהיר/כהה), עדכונים, חשבון
  - design system: `src/styles.css` (טוקנים בהיר/כהה), `src/ui/` (אייקונים, kit), Rubik מקומי, haptics
  - הוסרו: בחירת צבע חופשית, שפה (לא עבד), ייצוא CSV/PDF (לא היה ממומש), tweaks-panel
- [x] מרחבים משותפים (`src/spaces.jsx`, `src/lists.jsx`)
  - `lists/{id}` עם `kind: personal|shared`, `memberInfo`, `budget` (תקציב נפרד למשותף). מנויים משותפים ב־`lists/{id}/subs`; מנויים אישיים נשארים ב־`users/{uid}/payments`
  - הוצאה במשותף: `paidBy` (uid או `joint`) + `addedBy`. סיכום לפי אדם וסינון
  - הצטרפות: הזמנה לפי Gmail (מופיעה אצל המוזמן) או קוד (מזהה המרחב)
  - נבדק עם שני משתמשים מול emulators (בהיר/כהה): פתיחה, הצטרפות בקוד, הוספות עם שיוך, מנוי משותף מסתנכרן
  - תוקן: במכשיר חדש הסנאפשוט הראשון מה־cache ריק ולכן נוצר מעקב אישי כפול. עכשיו זורעים רק אחרי תשובה מהשרת, וכפילויות ריקות נמחקות
- [x] שלב 3 (חלק מקומי): תזכורות מתוזמנות על הטלפון (`src/lib/reminders.js`, `@capacitor/local-notifications`)
  - 60 יום קדימה, מנויים אישיים ומשותפים, מתוזמן מחדש בכל שינוי ובכל חזרה לאפליקציה. לחיצה פותחת "מנויים"
  - הפעלת "תזכורות" באנדרואיד מבקשת הרשאת התראות. "בדיקה" שולחת התראה מקומית
  - בווב: נשאר הסורק בטעינה + FCM
- [x] שלב 8: זיהוי תשלומים אוטומטי
  - אנדרואיד: `detect/PaymentListenerService` קורא התראות Wallet / אפליקציות אשראי / SMS. מפענח `PaymentParser` (Java טהור, בדיקות JUnit ב־CI). התראה "₪45 · שופרסל — להוסיף?" עם הוסף/התעלם, וכרטיס "זוהו תשלומים" במסך ההוצאות. שום דבר לא נשמר בענן עד שמוסיפים
  - Gmail: "קבלות מ־Gmail" בהגדרות. קריאה בלבד (`gmail.readonly`), 90 יום, מנויים חוזרים + קבלות. באנדרואיד דרך Google Sign-In הישן (`useCredentialManager: false`) כי ה־Credential Manager לא מחזיר access token כשכבר אושר
  - נבדק: סריקת Gmail מול API מדומה ב־emulators (בהיר/כהה), כרטיס ההצעות ועריכה לפני הוספה
  - טרם נבדק במכשיר אמיתי: פורמט ההתראות האמיתי של Wallet ושל אפליקציות האשראי בישראל (המפענח נכתב לפי פורמטים מוכרים)
  - `gcp-setup.yml` מפעיל Gmail API עם חשבון השירות
- [x] ניווט: הוצאות · מנויים · + · סיכום · הגדרות (ה־+ באמצע). טאב סיכום (`src/screens/summary.jsx`) במקום גיליון התקציב
- [x] טופס מנוי משותף (`SubscriptionForm` ב־`sheets.jsx`) להוספה ולפרטים. "חיובים אחרונים" מחושבים מהלו"ז (היה מדומה)
- [x] גיליון סגור מוסתר (`visibility`) והמעטפת `overflow: clip`, כדי ש־focus/scroll לא יזיזו את המסך
- [x] Gmail: מסך ההסכמה במצב Testing. נוספו כ־Test users: ohav88, ohav.ecommerce, maitesilvaf. Publish חסום עד השלמת Branding. בבדיקה, אישור משתמש פג אחרי 7 ימים (אנחנו מבקשים טוקן בכל סריקה, אז רק ההסכמה תופיע שוב)
- [x] בונה שירות מותאם אישית בסגנון החדש. ניהול מרחבים כבר קרוב לסגנון החדש
- [ ] תזכורות למנויים משותפים בצד השרת: `functions/` קורא רק `users/{uid}/payments` (וממילא לא נפרס)
- [x] ייצוא CSV: הגדרות ← "ייצוא הוצאות" (`src/lib/export.js`). אנדרואיד: Filesystem + Share. שם קובץ ASCII (שם עברי נזרק בדפדפן)
- [ ] מעבר ל־Firebase modular SDK (החבילה היום ~330KB gzip, בעיקר compat)
- [x] שלב 3 (צד שרת): `functions/index.js` נפרס מה־CI (`deploy.yml`, אחרון). Blaze פעיל
  - `onSpaceItemCreated` (europe-west1, ליד Firestore ב־eur3): push לשאר חברי המרחב + התראת תקציב 80%/100% פעם אחת לחודש (`lists/{id}.budgetAlerts.mYYYYMM`)
  - סיכום חודשי (1 לחודש 09:00): רץ בתוך `paymentReminders` השעתית, כי פונקציה מתוזמנת חדשה דורשת הרשאת invoker על שירות Cloud Run שחשבון הפריסה לא יכול לתת. נפרס בהצלחה 2026-10-13
  - `paymentReminders`: רק למכשירי ווב (`localReminders: false`), כולל מנויים משותפים
  - מכשירים ב־`users/{uid}/devices/{deviceId}`. אנדרואיד: `@capacitor-firebase/messaging`, ערוצים shared-activity / budget / monthly-summary
  - לוגיקה טהורה ב־`functions/lib.js` עם בדיקות. הטריגר והסיכום נבדקו מול Firestore emulator (FCM מדומה)
  - הרשאות סוכני השירות לפריסת Functions הוגדרו ידנית (pubsub tokenCreator, compute run.invoker + eventarc.eventReceiver). חשבון הפריסה (Editor) לא יכול לשנות IAM בעצמו
- [ ] שלב 4: להכניס את תרחיש ה־e2e מול emulators ל־CI (היום רץ רק בסשן)

- [x] פקדים מותאמים במקום ברירות המחדל של הדפדפן: בורר שעות (`src/ui/time-picker.jsx`, שעות משמאל, דקות מימין, קפיצות של 5 דק׳), פלטת צבעים מורחבת במקום `input type=color`, שדות מספר כטקסט עם מקלדת עשרונית, צבעי caret/selection. תאריכים כבר היו מותאמים (`MiniCalendar`)

- [x] Gmail אוטומטי (אנדרואיד): `GmailTokenPlugin.silentToken` (GoogleAuthUtil, בלי UI). אחרי סריקה ידנית ראשונה, סריקה שקטה של 30 יום בכל פתיחה/חזרה (פעם ב־4 שעות), והקבלות נכנסות לכרטיס ההצעות יחד עם Wallet (`useGmailInbox`, localStorage)
- [ ] **ממתין לאישור המשתמש: Play Protect חוסם התקנה בטלפון חדש** ("האפליקציה נחסמה כדי להגן על המכשיר", בלי "התקן בכל זאת")
  - הסיבה: הגנת ההונאה של Google חוסמת התקנה מדפדפן/וואטסאפ/מנהל קבצים של אפליקציה שמצהירה על NotificationListenerService (אצלנו: זיהוי תשלומים מ־Wallet). עדכונים מתוך האפליקציה אינם ממקור כזה
  - טעות: ב־v2.0.39 נבנתה גרסת `lite` נפרדת בלי אישור. המשתמש לא רוצה גרסאות שונות: **צריך לבטל** (`android/app/src/lite/`, buildType `lite` ב־`build.gradle`, `available` ב־`PaymentDetectPlugin`, `checkFullBuild`/`appVariant`/variant ב־`updater.js` ובבדיקות, `mode="full"` ב־`update-sheet.jsx`, `onOpenFullBuild` ב־`app.jsx`/`screens.jsx`, lite ב־`android.yml` וב־`android-smoke.sh`). כל release ימשיך להכיל רק `payments.apk`. אפליקציות שכבר בלייט יעודכנו למלא דרך המעדכן הרגיל (בלי `lite` ב־marker, parseRelease הישן בוחר `payments.apk`)
  - ההמלצה שהוצגה: גרסה אחת לכולם. בטלפון חדש מתקינים פעם אחת עם Play Protect כבוי לדקה (Play Store ← תמונה ← Play Protect ← ⚙ ← כיבוי סריקה, התקנה, הפעלה מחדש). להוסיף דף התקנה באתר (`/install`) עם הקישור וההוראות
  - חלופות שהוצגו: להסיר את קריאת ההתראות לכולם (Gmail נשאר); Google Play במסלול בדיקות (25$, בלי המעדכן הפנימי, נגד ההחלטה "בלי Play")
  - בהמשך: אימות מפתחים של Google לאפליקציות שמותקנות מחוץ ל־Play. בתוקף מ־30.9.2026 בברזיל, אינדונזיה, סינגפור ותאילנד, ובשאר העולם ב־2027. יחייב רישום ב־Android Developer Console (חשבון חינמי עד 20 מכשירים)
- [ ] Gmail במצב Testing: ההסכמה פגה כל 7 ימים. פתרון: Publish (דורש Branding). דף פרטיות: https://schedual-fdde7.web.app/privacy.html

## החלטות
- הפצה: APK ב־GitHub Releases + עדכון מתוך האפליקציה. בלי Play.
- כניסה: חשבון Google.
- הווב (PWA) נשאר, מאותו קוד.
- זיהוי תשלומים אוטומטי: ל־Google Wallet אין API לעסקאות. הדרך: האפליקציה קוראת התראות תשלום של Wallet/אפליקציות האשראי (הרשאת גישה להתראות, פעם אחת) ומקפיצה התראה משלה "להוסיף?" עם כפתור הוספה. מיילים: Gmail API לקריאת קבלות (כניסת Google קיימת) או העברה לכתובת ייעודית שמעובדת ב־Cloud Function. שלב 8.
- פונט: Rubik (נארז מקומית).
- ניווט: הוצאות · מנויים · + · הגדרות. מצב כהה: אוטומטי/בהיר/כהה (ברירת מחדל: אוטומטי).
- **כיוון עיצוב (משוב על הפרוטוטייפ):** הפרקטיקה בפרונט. הוספת הוצאה ומעקב זמינים מיד במסך הראשי, בלי עומס של סטטיסטיקות ומידע. ניתוח ונתונים רק במקום משני ומצומצם.
- `nextDate` נשאר עוגן ולא נכתב מחדש. כל התצוגות מחשבות את המופע הבא.

## חתימת Android
- keystore: PKCS12, alias `payments`, נוצר 2026-10-13
- SHA1: `F7:48:90:AD:F8:0A:DD:BC:50:E4:25:58:8A:90:74:19:91:83:AE:BA`
- SHA256: `DC:8B:1C:EF:D1:48:26:BD:99:4D:34:3B:33:8D:1C:79:50:0E:7D:3A:D4:16:65:6F:F5:E4:22:9A:74:72:5C:0B`

## סודות (שמות בלבד)
- `FIREBASE_SERVICE_ACCOUNT`: קיים (פריסה)
- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`: קיימים
