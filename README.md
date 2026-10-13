# Payments-2026

Hebrew RTL expenses + recurring-payments tracker. React + Vite, Firebase (Auth, Firestore, Hosting, Cloud Functions, FCM). Heading to an Android app (Capacitor); see `docs/PLAN.md` and `PROGRESS.md`.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173 against production Firebase
npm test           # unit tests (Vitest)
npm run lint
npm run build      # → dist/
```

Against local emulators instead of production:

```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-payments
VITE_USE_EMULATORS=1 npm run dev
```

## Deploy

Pushing to `claude/implement-payments-page-G9fij` runs `.github/workflows/deploy.yml`: lint, tests, build, deploy Hosting (`dist/`), smoke-test the live site, deploy Firestore rules. Live: https://schedual-fdde7.web.app

## Data

```
users/{uid}/settings/main          settings
users/{uid}/payments/{id}          recurring payment; nextDate is the recurrence anchor (src/lib/recurrence.js)
lists/{id}                         shared expenses tracker (members, invitedEmails)
lists/{id}/items/{id}              expense
```

## Layout

- `index.html`, `src/main.jsx`: entry
- `src/app.jsx`: shell, navigation, sheets
- `src/screens.jsx`, `src/sheets.jsx`, `src/lists.jsx`, `src/budget.jsx`: screens and flows
- `src/data.jsx`: service catalog, money/date helpers
- `src/lib/firebase.js`: Firebase config (and emulator wiring)
- `src/lib/recurrence.js`: next/last occurrence of a recurring payment (copied to `functions/recurrence.mjs`)
- `functions/`: scheduled FCM reminders
- `public/sw.js`: offline shell + background push
