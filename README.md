# Payments-2026

Hebrew RTL recurring-payments tracker. Static HTML + React (Babel-in-browser) + Firebase (Hosting, Auth, Firestore).

## Schema

```
users/{uid}/
  settings/main                — single settings document
  payments/{paymentId}         — one document per tracked payment
```

Each browser is signed in **anonymously** on first load; data is scoped to that uid by `firestore.rules`.

## Deploy

```bash
npm i -g firebase-tools
firebase login
firebase use schedual-fdde7

# First time: in the Firebase Console, enable
#   - Authentication → Sign-in method → Anonymous
#   - Firestore Database → Create database (production mode is fine; rules deploy next)
#   - Hosting → Get started (no need to upload anything)

firebase deploy
```

After deploy: `https://schedual-fdde7.web.app`

## Wipe existing project content

```bash
# remove existing Hosting site contents
firebase deploy --only hosting

# remove existing Firestore collections — requires running the destructive
# script manually, or doing it from the Firebase Console (Firestore → … → Delete collection).
```

## Files

- `payments.html` — entry HTML (RTL Hebrew, Heebo font, CSS variables for theming)
- `index.html` — redirects to `payments.html` (Hosting rewrites all to `payments.html` anyway)
- `app.jsx` — root component, theme/accent, navigation, sheet mounts
- `firebase-init.jsx` — Firebase init + `usePayments` / `useFirebaseSettings` hooks
- `data.jsx` — service catalog, helpers (`fmtMoney`, `isAutoPaid`, etc.)
- `components.jsx` — `Sheet`, `Icon`, `Chip`, `Toggle`, `Row`, `ServiceBubble`
- `payment-card.jsx` — `StatsCard`, `ListCard`, `SectionHeader`
- `stacked-list.jsx` — single-container glassmorphism stacked payments list
- `sheets.jsx` — `DetailSheet`, `AddSheet`, `CustomServiceBuilder`, `EditCustomSheet`
- `screens.jsx` — `HomeScreen`, `CalendarScreen`, `SettingsScreen`
- `tweaks-panel.jsx` — design-tool tweaks panel (no-op outside Claude Design)
