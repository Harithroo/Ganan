# Quick Start

## 1. Launch
- Open `index.html` in a browser.
- Or run a static server and open the app URL.

## 2. Create or Select a Session
- Go to `Sessions`.
- Create a new session name or pick an existing one.

## 3. Add People
- Go to `People`.
- Add each member once.

## 4. Add Expenses
- Go to `Add Expense`.
- Select payer.
- Enter currency and amount.
- Select beneficiaries.
- Submit.

## 5. Optional: Add Conversions
- Go to `Conversions`.
- Add conversion records (from currency/amount -> to currency/amount).
- Use funding allocation methods when needed.

## 6. Review Outputs
- `Expenses` page: full expense list, edit, delete
- `Balances` page: per-person net balances
- `Settlements` page:
  - Optimized mode (greedy settlement)
  - Collector mode (all flows via selected collector)

## 7. Sync (Optional)
- If Firebase is configured, sign in from Home.
- Sessions can sync to Firestore.
- Invite links are available for signed-in sessions.

## Regression Tests
Install:
```bash
npm install
npx playwright install chromium
```

Run:
```bash
npm run test:regression
```

## Troubleshooting
- If auth says not configured, app will continue in local mode.
- If numbers look off, confirm beneficiaries and currency/rate inputs.
- If old data appears, clear session data from Home or clear localStorage.
