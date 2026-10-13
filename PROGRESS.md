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
- [ ] מעבר ל־Firebase modular SDK (החבילה היום ~330KB gzip, בעיקר compat)
- [ ] שלב 3: התראות. לפרוס גם את `functions/` (היום ה־CI לא פורס Functions; לא ידוע אם הפונקציה רצה בפרודקשן)
- [ ] שלב 4: להכניס את תרחיש ה־e2e מול emulators ל־CI (היום רץ רק בסשן)

## החלטות
- הפצה: APK ב־GitHub Releases + עדכון מתוך האפליקציה. בלי Play.
- כניסה: חשבון Google.
- הווב (PWA) נשאר, מאותו קוד.
- זיהוי תשלומים אוטומטי (התראות Wallet/אשראי, Gmail): שלב 8, עתידי.
- פונט: Rubik.
- **כיוון עיצוב (משוב על הפרוטוטייפ):** הפרקטיקה בפרונט. הוספת הוצאה ומעקב זמינים מיד במסך הראשי, בלי עומס של סטטיסטיקות ומידע. ניתוח ונתונים רק במקום משני ומצומצם.
- `nextDate` נשאר עוגן ולא נכתב מחדש. כל התצוגות מחשבות את המופע הבא.

## חתימת Android
- keystore: PKCS12, alias `payments`, נוצר 2026-10-13
- SHA1: `F7:48:90:AD:F8:0A:DD:BC:50:E4:25:58:8A:90:74:19:91:83:AE:BA`
- SHA256: `DC:8B:1C:EF:D1:48:26:BD:99:4D:34:3B:33:8D:1C:79:50:0E:7D:3A:D4:16:65:6F:F5:E4:22:9A:74:72:5C:0B`

## סודות (שמות בלבד)
- `FIREBASE_SERVICE_ACCOUNT`: קיים (פריסה)
- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`: קיימים
