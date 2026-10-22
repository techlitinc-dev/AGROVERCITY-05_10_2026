# [GAP-002] Bar bar tomato/dairy jaisi galat commodity ka rate aa raha tha, wheat ka nahi
severity: P2 · score: 2 · class: bug-suspicion
personas_affected: farmer
source_scenarios: see evidence runs
evidence: blocker @ oneshot-20261021T21-52-56--farmer-sell-wheat.meta.json

## User story
As a <persona>, I want <capability>, so that <outcome>.
Quote: "Bhai, itni der se Anand ka gehu ka bhav nikaal raha hoon, har baar kuchh aur hi aa jaata hai, params ka koi sahi jawaab nahi milta, dimaag kharab ho gaya!"

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
