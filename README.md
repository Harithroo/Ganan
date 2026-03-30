# Ganan

Ganan is a client-side group expense splitter with session management, optional Firebase sync, and settlement calculation.

## Highlights
- Manage multiple sessions (local or cloud-backed)
- Add and manage people per session
- Track expenses with payer, beneficiaries, currency, and optional FX handling
- Track currency conversions and conversion-funded expenses
- View balances and settlements (optimized or collector mode)
- Works as a PWA with service worker caching
- Includes Playwright regression tests and GitHub Actions CI

## Tech Stack
- HTML/CSS/JavaScript (no build step)
- Umbrella JS (DOM helper)
- Optional Firebase Auth + Firestore sync
- Playwright for regression testing

## Project Structure
- `index.html` - App UI
- `app.js` - App state, calculations, rendering, session/auth logic
- `style.css` - Styles
- `sw.js` - Service worker
- `manifest.json` - PWA metadata
- `tests/regression/` - Playwright regression tests
- `.github/workflows/regression-tests.yml` - CI workflow

## Run the App
Open `index.html` in a modern browser.

For best behavior with service worker and testing, run with a local static server.

## Regression Testing
Install:
```bash
npm install
npx playwright install chromium
```

Run tests:
```bash
npm run test:regression
```

Open interactive runner:
```bash
npm run test:regression:ui
```

## Notes
- Local mode works without Firebase.
- Cloud sync features require valid Firebase configuration.
- Data is session-scoped; local and remote active session IDs are tracked separately.

## Documentation
- `QUICKSTART.md` - User workflow and setup
- `FEATURES.md` - Functional capability list
- `IMPLEMENTATION.md` - Implementation details
- `ARCHITECTURE.md` - System architecture and data model
- `VERIFICATION.md` - Validation and test checklist
- `COMPLETE.md` - Current delivery status
- `REFACTOR.md` - UI/navigation refactor notes
