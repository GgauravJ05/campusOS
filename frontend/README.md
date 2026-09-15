# CampusOS Web App

React 19 · Vite 8 · React Router 7 · Tailwind CSS 4 · Vitest + Testing Library + MSW.

## Quick start

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The dev server proxies `/api` to the backend on `http://localhost:5000`, so the
API must be running (see `backend/README.md`). If your API runs on another port
(macOS users often move off 5000), create `frontend/.env.local`:

```bash
VITE_API_PROXY_TARGET=http://localhost:5050
```

In development the sign-in page shows **demo account** buttons for the seeded
users (password `Campus@123`). They are stripped from production builds.
Sign-up codes are printed in the **API terminal** when `SMTP_HOST` is empty.

## Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | ESLint (React hooks rules included) |
| `npm test` | All tests once |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with the coverage gate (90 / 84 / 85 / 92) |

## Layout

```
src/
  App.jsx                   providers + route table (lazy-loaded pages)
  index.css                 Tailwind, design tokens (brand colours, shadows, motion)
  lib/
    api.js                  THE HTTP client: envelope parsing, token refresh
    utils.js                role labels, formatting, cn()
    password.js             mirror of the backend password policy, for live feedback
    hooks.js                useCountdown, useDebouncedValue, useDocumentTitle
  features/
    auth/                   AuthProvider, useAuth, route guards, authApi
    users/usersApi.js
    theme/ThemeProvider.jsx light / dark / system
  components/
    ui/                     Button, Field/Input/Select/PasswordInput, OtpInput,
                            Dialog, Toast, Card, Badge, Avatar, Alert, Skeleton…
    layout/                 AuthLayout (split screen), AppShell (sidebar + drawer)
  pages/                    one file per screen; *.test.jsx next to them
  test/                     MSW fake API, render helper, setup
```

## Conventions

- **Never call `fetch` in a component.** Add a function to the feature's
  `*Api.js`, which uses `lib/api.js`.
- **Tokens.** The access token lives in memory only; the refresh token is an
  httpOnly cookie the browser handles. Nothing auth-related goes in
  `localStorage`. `lib/api.js` refreshes expired tokens automatically, once,
  shared across concurrent requests and across tabs.
- **Errors.** API failures throw `ApiError` with `code`, `message` and
  `fieldErrors` (`{ fieldName: message }`) — map `fieldErrors` onto form fields.
- **Reuse `components/ui`** before writing new markup. Every input goes in a
  `<Field>` so the label, hint, error and ARIA wiring are always right.
- **Build against the real API.** Pages for modules whose backend does not
  exist yet (Venues, Events) describe what is coming — they never show invented data.
- **Test user journeys, not implementation.** Tests render the real routes and
  talk to an MSW fake of the API (`src/test/server.js`) using the backend's
  exact response envelope. Query by role and label, the way a user finds things.
- **Accessible by default:** labelled controls, keyboard reachable, visible
  focus, dialogs trap focus, toasts are announced, motion respects
  `prefers-reduced-motion`.
