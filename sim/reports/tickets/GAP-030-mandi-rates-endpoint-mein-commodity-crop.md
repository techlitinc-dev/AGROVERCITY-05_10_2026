# [GAP-030] mandi rates endpoint mein commodity/crop filter (pyaaj ke liye alag se filter) — step 5, 12, 14, 15, 16, 19
severity: P2 · score: 1 · class: feature-gap
personas_affected: seller
source_scenarios: see evidence runs
evidence: debrief @ smoke-20261021T17-57-07--seller-procure-and-sell.meta.json

## User story
As a <persona>, I want <capability>, so that <outcome>.
Quote: "Baar-baar same endpoint daba ke bhi pyaaj ka bhav nahi aaya, sirf tamatar dikha raha hai — time barbaad ho gaya aur kharidari bhi nahi ho paayi."

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
