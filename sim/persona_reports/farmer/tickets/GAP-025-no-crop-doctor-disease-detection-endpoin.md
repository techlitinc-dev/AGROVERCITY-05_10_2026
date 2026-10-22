# [GAP-025] No Crop Doctor / disease detection endpoint found for cotton leaf spots
severity: P2 · score: 1 · class: bug-suspicion
personas_affected: farmer
source_scenarios: see evidence runs
evidence: blocker @ persona-farmer-20261021T22-05-45--farmer-evening-round.meta.json

## User story
As a <persona>, I want <capability>, so that <outcome>.
Quote: "Mandi ka daam to aa gaya, lekin baar-baar search karne ke baad bhi diary, crop doctor aur sarkari yojna ka koi raasta nahi mila."

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
