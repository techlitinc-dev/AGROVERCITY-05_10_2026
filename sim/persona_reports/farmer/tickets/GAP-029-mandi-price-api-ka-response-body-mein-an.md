# [GAP-029] mandi price API ka response body mein Anand APMC wheat ka min/modal/max price dikhana — trace mein sirf 200 st
severity: P2 · score: 1 · class: feature-gap
personas_affected: farmer
source_scenarios: see evidence runs
evidence: debrief @ persona-farmer-20261021T22-05-45--farmer-sell-wheat.meta.json

## User story
As a <persona>, I want <capability>, so that <outcome>.
Quote: "Baar-baar mandi price check kiya par asal rate hi nahi dikhaya, aur abhi tak lot banane ka option bhi nahi mila — time barbaad ho raha hai!"

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
