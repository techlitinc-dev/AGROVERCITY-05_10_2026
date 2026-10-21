# [GAP-003] GET /v1/finance/loans returned 403 Forbidden
severity: P2 · score: 3 · class: bug-suspicion
personas_affected: bankManager
source_scenarios: see evidence runs
evidence: blocker @ smoke-20261021T17-57-07--bank-loan-pipeline.meta.json

## User story
As a <persona>, I want <capability>, so that <outcome>.
Quote: "I can read the file, but where are the approve and disburse buttons? I cannot clear this loan from the queue with GET calls alone."

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
