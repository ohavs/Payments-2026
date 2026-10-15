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
- [x] תזכורות למנויים משותפים בצד השרת (`paymentReminders`, ראו שלב 3 צד שרת)
- [x] ייצוא CSV: הגדרות ← "ייצוא הוצאות" (`src/lib/export.js`). אנדרואיד: Filesystem + Share. שם קובץ ASCII (שם עברי נזרק בדפדפן)
- [x] ~~מעבר ל־Firebase modular SDK~~: נמדד (2026-10-15) 216KB→187KB gzip לחלק של Firebase, חיסכון ~29KB מתוך ~350KB (8%). לא שווה את הסיכון לכניסת Google/התראות שלא נבדקות ב־CI. לחזור לזה רק אם הפתיחה איטית בטלפון
- [x] שלב 3 (צד שרת): `functions/index.js` נפרס מה־CI (`deploy.yml`, אחרון). Blaze פעיל
  - `onSpaceItemCreated` (europe-west1, ליד Firestore ב־eur3): push לשאר חברי המרחב + התראת תקציב 80%/100% פעם אחת לחודש (`lists/{id}.budgetAlerts.mYYYYMM`)
  - סיכום חודשי (1 לחודש 09:00): רץ בתוך `paymentReminders` השעתית, כי פונקציה מתוזמנת חדשה דורשת הרשאת invoker על שירות Cloud Run שחשבון הפריסה לא יכול לתת. נפרס בהצלחה 2026-10-13
  - `paymentReminders`: רק למכשירי ווב (`localReminders: false`), כולל מנויים משותפים
  - מכשירים ב־`users/{uid}/devices/{deviceId}`. אנדרואיד: `@capacitor-firebase/messaging`, ערוצים shared-activity / budget / monthly-summary
  - לוגיקה טהורה ב־`functions/lib.js` עם בדיקות. הטריגר והסיכום נבדקו מול Firestore emulator (FCM מדומה)
  - הרשאות סוכני השירות לפריסת Functions הוגדרו ידנית (pubsub tokenCreator, compute run.invoker + eventarc.eventReceiver). חשבון הפריסה (Editor) לא יכול לשנות IAM בעצמו
- [x] שלב 4: e2e ב־CI (`e2e/`, Playwright מול emulators עם ה־rules האמיתיים): משתמש אחד (הוצאות, הוספה מהירה, מנויים, מצב כהה) ומרחב משותף לשניים (הצטרפות בקוד, מי שילם, סנכרון חי, מנוי משותף, פרטיות המרחב האישי). מקומית: `VITE_USE_EMULATORS=1 npx vite build --outDir dist-emu && cd e2e && npm test`

- [x] פקדים מותאמים במקום ברירות המחדל של הדפדפן: בורר שעות (`src/ui/time-picker.jsx`, שעות משמאל, דקות מימין, קפיצות של 5 דק׳), פלטת צבעים מורחבת במקום `input type=color`, שדות מספר כטקסט עם מקלדת עשרונית, צבעי caret/selection. תאריכים כבר היו מותאמים (`MiniCalendar`)

- [x] Gmail אוטומטי (אנדרואיד): `GmailTokenPlugin.silentToken` (GoogleAuthUtil, בלי UI). הסריקה בפתיחת האפליקציה הוחלפה בבדיקה ברקע (למטה)
- [x] Play Protect חוסם התקנה ראשונה מוואטסאפ/דפדפן (בגלל קריאת ההתראות). החלטת המשתמש: גרסה אחת לכולם, מכבים Play Protect לרגע בהתקנה הראשונה. גרסת ה־lite בוטלה (v2.0.42). עדכונים מתוך האפליקציה לא נחסמים
- [x] Gmail ברקע (אנדרואיד): `detect/GmailReceiptJob` (JobScheduler, כל שעה, persisted) + `GmailReceiptScanner` (טוקן שקט, השאילתה מ־`receiptQuery(3)`, רק מיילים שהגיעו אחרי ההפעלה, כל הודעה פעם אחת) → `SuggestionStore` + התראה "קבלה במייל · להוסיף?". המפענח `GmailReceiptParser` (פורט של `gmail.js`, אותם מקרים ב־JUnit). הגדרות ← "קבלה חדשה במייל". מסך ההסכמה פורסם (Production) ע"י המשתמש, אז ההרשאה לא פגה כל 7 ימים; עד אימות Google יופיע מסך "האפליקציה לא אומתה" בהרשאה הראשונה
  - טרם נבדק במכשיר אמיתי
- [x] ווידג׳ט מסך בית "הוספת הוצאה" (`android/.../widget/`): מקלדת, רשימת קטגוריות של המרחב (מדבקות כ־vector, אותו מיפוי כמו `icons.jsx`), "+ קטגוריה חדשה" (גיליון קטן מעל מסך הבית, `NewCategoryActivity`; ווידג׳ט לא יכול להכיל שדה טקסט), מעבר בין מרחבים, שמירה
  - שומר ישירות ל־Firestore ב־REST כמשתמש (`FirestoreRest`): האפליקציה מסנכרנת refresh token, מרחבים וקטגוריות (`src/lib/widget.js` → `WidgetBridgePlugin`). אותם מסמכים ו־rules כמו האפליקציה; `source: 'widget'`. נבדק מול emulators (JVM)
  - בלי חיבור: נשמר בתור ונשלח בשמירה הבאה או כשהאפליקציה נפתחת
  - טוקנים ועיצוב: `values(-night)/widget_colors.xml` מ־`styles.css`, Rubik סטטי (600/800, מוקטן לעברית+לטינית), RTL קבוע
  - הגדרות ← "ווידג׳ט למסך הבית" (requestPinAppWidget)
  - CI: `scripts/widget-shots.sh` מארח את הווידג׳ט באמולטור (`WidgetPreviewActivity`, adb root + `appwidget grantbind`), לוחץ ומצלם. הצילומים בענף `ci-shots`
  - טרם נבדק בטלפון אמיתי: שמירה מול Firebase האמיתי (מפתח ה־API עם Referer/X-Android headers)
- [x] ווידג׳ט, סבב 2 (בקשות 04:45/04:47 שלא הגיעו בזמן, שוחזרו מהאירועים): שלושה גדלים (`widget_quick_add[_medium|_small].xml`, `RemoteViews(Map<SizeF,…>)` ב־12+, `onAppWidgetOptionsChanged` לפני), "dropdown" קטגוריות → `CategorySheetActivity` (מרחבים, קטגוריות, חדשה; עם סכום, בחירה שומרת), insets של המקלדת, לחיצה על ריק פותחת את האפליקציה, תוויות מרחב מהאפליקציה
  - "אישי" כפול: מרחבים אישיים בשם ברירת המחדל מתמזגים לישן (פריטים ומנויים עם אותם ids, איחוד קטגוריות). e2e `merge.spec.js`
  - הודעת שמירה: מלאה בגדול ובפס השמירה של הבינוני, קצרה (`statusShort`) בשורת הסכום של הקטנים
  - CI: `WidgetPreviewActivity` מוחק את רשומת ה־host הקודמת ומאזין לפני הרינדור הראשון (אחרי force-stop הרשומה הצביעה על מאזין מת והעדכונים אבדו). Gradle cache ב־`android.yml` (Maven Central נכשל פעם בהורדת jar של Kotlin)
  - פורסם ב־v2.0.63 ואילך
- [x] אייקון: רקע ירוק מלא + ₪ ב־Rubik ExtraBold, שכבת monochrome (`scripts/make_icons.py`)
- [x] הגדרות: קבוצות מתקפלות, נזכר לכל קבוצה (`settings.open.<כותרת>` ב־localStorage)
- [x] ווידג׳ט, סבב 3: בגודל רחב ונמוך המקשים נמרחו. עכשיו כל גודל שהמשגר מדווח (`OPTION_APPWIDGET_SIZES`, או min/max) מקבל פריסה משלו ורוחב מקלדת מחושב (`layoutFor`/`keypadWidth`, בדיקות ב־`WidgetLogicTest`). פריסה רביעית `widget_quick_add_wide.xml`: מקלדת מימין, סכום/קטגוריה/שמירה משמאל. בגדול המקלדת עברה לימין. ארבעה גדלי fallback למשגר שלא מדווח
- [x] ערכות צבע (הגדרות ← מראה): קלאסי · לילך · שקיעה · ים · דבש. `settings.palette` (מסונכרן) + `localStorage` לפתיחה מהירה, `[data-palette]` ב־`styles.css` (accent + טקסטורה ב־`.app-bg::before`), favicon, צבע התזכורות, הווידג׳ט (`WidgetTheme`, drawables לכל ערכה)
  - סמלים: מקור אחד `src/lib/app-icons.js` (SVG), `node scripts/make_icons.mjs` מייצר mipmaps לכל ערכה + אייקוני ווב (במקום `make_icons.py`)
  - סמל המשגר: activity-alias לכל ערכה. הפעילות האמיתית היא `AppActivity`; ה־alias `.MainActivity` (ירוק, ברירת מחדל) שומר על אייקונים קיימים במסך הבית. ההחלפה (`AppIcons`) רק ב־`onUserLeaveHint`/יציאה, כי המערכת סוגרת את המסך שנפתח דרך alias שכובה. הסמל מתחלף רק במכשיר שבו בחרו
  - טרם נבדק בטלפון אמיתי: החלפת הסמל (במשגרים רבים האייקון נעלם ממסך הבית וצריך לגרור מחדש)
- בהמשך: אימות מפתחים של Google לאפליקציות מחוץ ל־Play (בעולם ב־2027). יחייב רישום ב־Android Developer Console (חשבון חינמי עד 20 מכשירים)
- [x] Gmail: מסך ההסכמה פורסם (Production). דף פרטיות: https://schedual-fdde7.web.app/privacy.html

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
