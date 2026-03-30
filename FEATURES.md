# Features

## Session and Collaboration
- Multiple named sessions
- Active session switching
- Rename and delete session
- Invite link generation and copy
- Session member management

## Authentication and Storage
- Local-first usage without account
- Optional Firebase email/password and Google sign-in
- Firestore sync when authenticated
- Separate local vs remote active-session tracking

## People Management
- Add person with validation
- Rename person
- Remove person
- Automatic propagation to forms and calculations

## Expense Management
- Add expense with payer, amount, description, beneficiaries
- Currency-aware input and display
- FX-aware expense support
- Edit and delete expenses

## Conversion Management
- Record conversion lots (from amount/currency -> to amount/currency)
- Track holdings and lot usage
- Manual or conversion-source funding for conversions
- Prevent deletion of in-use conversions

## Calculation and Settlement
- Balance calculation per person
- Optimized settlement mode using greedy matching
- Simple collector settlement mode
- Floating-point tolerance handling via epsilon

## UX and Platform
- Multi-page single-document navigation
- Responsive layout for desktop/mobile
- Service worker caching and PWA manifest
- Clear empty states and validation messaging

## Quality and Tooling
- Playwright regression suite
- CI workflow for regression tests on push/PR
