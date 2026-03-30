# Implementation Notes

## Runtime Model
The app is a single-page document with section-based navigation. Core logic lives in `app.js` as an object-based state manager.

## Core State
Primary runtime state includes:
- `sessions[]`
- `activeSessionId`
- `people[]`
- `expenses[]`
- `conversions[]`
- `balances{}`
- settlement mode and collector selection

## Main Functional Areas
- Session lifecycle: create, rename, select, delete
- People lifecycle: add, rename, remove
- Expense lifecycle: create, edit, delete
- Conversion lifecycle: create, fund, consume, delete guard
- Balance and settlement calculation
- Render pipeline for each page/section

## Settlement Logic
- `calculateBalances()` computes net per person by distributing each expense equally across beneficiaries.
- `calculateSettlements()` uses a greedy debtor-creditor match.
- `calculateSimpleSettlements(collector)` routes net flow through one collector.

## FX and Conversion Logic
- Expense records can include original currency metadata and source allocations.
- Conversion lots are tracked with remaining amounts.
- Usage maps prevent over-allocation and validate deletion safety.

## Persistence
- Local mode stores session payloads in localStorage.
- Authenticated mode syncs session payloads to Firestore.
- Active session ID is tracked separately for local and remote scopes.

## Auth Integration
- Firebase initialization is optional.
- If config is missing, app remains fully usable in local mode.
- Signed-in state toggles sync and collaboration features.

## Testing
Regression tests live in `tests/regression/expense-flow.spec.js` and validate:
- balance and settlement correctness
- recalculation after delete
- local persistence after reload
