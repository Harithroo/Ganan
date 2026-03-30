# Architecture

## Repository Map
- `index.html`: UI structure and page sections
- `app.js`: state, logic, rendering, auth/sync orchestration
- `style.css`: visual system and responsive behavior
- `sw.js`: cache-first/refresh support for offline usage
- `manifest.json`: install metadata for PWA
- `tests/regression/*`: regression tests
- `.github/workflows/*`: CI automation

## High-Level Flow
1. App boots on `DOMContentLoaded`.
2. Elements are cached and local state is loaded.
3. Firebase auth is initialized if configured.
4. UI handlers mutate state.
5. Render functions update all dependent views.
6. Changes are persisted locally and optionally synced.

## Data Domains
- Session domain: session metadata and active selection
- Member domain: people and profile references
- Expense domain: payer, amount, beneficiaries, FX metadata
- Conversion domain: lots, funding sources, remaining usage
- Settlement domain: computed balances and payment instructions

## Rendering Strategy
A centralized `render()` fan-outs to page-specific renderers:
- sessions
- people
- expense form/list
- conversion form/list/holdings
- balances
- settlements
- home stats

## Storage Strategy
- LocalStorage for local-mode session payloads and preferences
- Firestore for authenticated session sync
- Remote-save queueing to avoid noisy writes

## Testing Strategy
- Playwright end-to-end regression on key user flows
- Tests run locally and in CI (`regression-tests.yml`)
- Service workers are blocked during tests for determinism
