# PROGRESS

## מצב נוכחי
- ענף פיתוח: `claude/optimistic-mccarthy-a7zskt`
- ענף מוגש (פריסה אוטומטית ל־Firebase Hosting): `claude/implement-payments-page-G9fij`
- תוכנית מלאה: `docs/PLAN.md`
- פרוטוטייפ עיצוב (שלב 0): https://claude.ai/artifact/LqLdFpPFf6dkWUTTEy9P5t

## נעשה
- [x] תוכנית: אנדרואיד עם Capacitor, עיצוב מחדש, 8 שלבים
- [x] שלב 0: פרוטוטייפ אינטראקטיבי (בית, ניתוח, הוספה מהירה, מנויים, פרופיל, עדכונים)

## הבא
- [ ] שלב 1: Vite + ES modules, Firebase מ־npm, תיקון באג התזכורות (`nextDate` לא מתקדם), בדיקות, CI
- [ ] שלב 2: Capacitor + Android, כניסת Google נייטיב, APK חתום ב־GitHub Releases, "בדוק עדכונים" באפליקציה

## החלטות
- הפצה: APK ב־GitHub Releases + עדכון מתוך האפליקציה. בלי Play.
- כניסה: חשבון Google.
- הווב (PWA) נשאר, מאותו קוד.
- זיהוי תשלומים אוטומטי (התראות Wallet/אשראי, Gmail): שלב 8, עתידי.
- פונט: Rubik או Fredoka, לפי הבחירה בפרוטוטייפ.

## סודות (שמות בלבד)
- `FIREBASE_SERVICE_ACCOUNT`: קיים (פריסת Hosting)
- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`: נדרשים לשלב 2
