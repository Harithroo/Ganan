# Verification Checklist

## Functional Verification
- [x] Session create/select/rename/delete
- [x] People add/rename/remove
- [x] Expense add/edit/delete
- [x] Beneficiary selection and validation
- [x] Balance rendering with positive/negative states
- [x] Settlement rendering in optimized mode
- [x] Settlement rendering in collector mode
- [x] Conversion add and listing
- [x] Conversion deletion guard when referenced

## Persistence Verification
- [x] Local session data persists across reload
- [x] Active session ID stored and restored
- [x] Local/remote active-session separation
- [x] Auth-missing fallback works in local mode

## Regression Automation
- [x] Playwright configured
- [x] Static test web server configured
- [x] Chromium project configured
- [x] CI workflow configured (GitHub Actions)
- [x] Latest local regression run: `3 passed` on March 30, 2026

## Non-Functional Checks
- [x] Responsive behavior for common viewport sizes
- [x] Offline support via service worker
- [x] Input sanitization for rendered text
- [x] No build step required for runtime app

## Remaining Gaps
- [ ] Automated coverage for conversion funding edge cases
- [ ] Automated coverage for auth/session invite flows
- [ ] Dedicated unit tests for pure balance/settlement helpers
