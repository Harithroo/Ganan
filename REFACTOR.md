# Refactor Notes

## Scope
This document tracks the UI and structure refactor that moved the app from a stacked single-view layout to section-based navigation inside one document.

## Refactor Outcomes
- Added navbar-driven page sections (`home`, `sessions`, `people`, `add-expense`, `conversions`, `expenses`, `balances`, `settlements`)
- Centralized page switching through `showPage()` and nav state updates
- Preserved existing domain logic while improving flow and discoverability
- Added mobile menu behavior and active state handling

## Stability Considerations
- Core calculation and persistence logic remained in `app.js`
- Render pipeline remained centralized to avoid divergent page state
- No build tooling introduced during refactor

## Follow-up Work Already Done
- Regression tests were introduced after refactor to guard key flows
- CI automation now runs those tests on push/PR

## Future Refactor Targets
1. Extract pure calculation helpers into standalone modules for easier unit testing.
2. Introduce small view/controller boundaries to reduce file size pressure in `app.js`.
3. Add typed contracts (JSDoc or TypeScript) for expense/conversion/session payloads.
