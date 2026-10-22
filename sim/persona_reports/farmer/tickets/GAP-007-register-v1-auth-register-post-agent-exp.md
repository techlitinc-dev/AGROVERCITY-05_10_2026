# [GAP-007] register_v1_auth_register_post: agent expected success but got 422 (403=role scope? 404=missing? 422=validation?)
severity: P2 · score: 3 · class: expectation-mismatch
personas_affected: ?
source_scenarios: see evidence runs
evidence: mismatch @ persona-farmer-20261021T22-05-45--onboard-farmer-first-run.meta.json

## User story
As a <persona>, I want <capability>, so that <outcome>.
Quote: "Arre pehle hi register karne mein 422 aa gaya, OTP bhej toh diya lekin verify ka schema samajh nahi aaya, kheti ka kaam chhod ke yeh search-search karna pad raha hai!"

## Current behavior
<from run evidence — failing request/response in the cited run file>

## Expected behavior
<what the persona attempted/expected>

## Proposed implementation
### API
<endpoints, request/response shapes — follow existing router conventions>
### Data
<collections / fields / state transitions>
### Frontend
<routes in website/src/views/, api module, i18n en+hi>
### Seeds / fixtures
<backend/scripts/seed_*.py or sim seed_sim.py updates>
### Tests
<backend/tests/test_*.py + scenario checkpoint update>

## Acceptance criteria
- [ ] scenario rerun shows no recurrence
- [ ] pytest green
- [ ] sim analyze --diff shows zero new entries on touched endpoints
- [ ] i18n keys present (en + hi)

## Out of scope
<explicit non-goals>
