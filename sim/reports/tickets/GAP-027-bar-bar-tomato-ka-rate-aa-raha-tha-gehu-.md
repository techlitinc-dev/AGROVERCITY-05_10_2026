# [GAP-027] Bar bar tomato ka rate aa raha tha, gehu ka nahi - query parameter kaise lagate hain samajh nahi aaya.
severity: P2 · score: 1 · class: bug-suspicion
personas_affected: farmer
source_scenarios: see evidence runs
evidence: blocker @ smoke-20261021T17-57-07--farmer-sell-wheat.meta.json

## User story
As a <persona>, I want <capability>, so that <outcome>.
Quote: "Bhai, baar baar tamatar ka daam dikhata raha, mujhe toh Anand ka gehu bechna tha, param samajh nahi aaya toh lot banane tak kabhi pahuncha hi nahi!"

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
