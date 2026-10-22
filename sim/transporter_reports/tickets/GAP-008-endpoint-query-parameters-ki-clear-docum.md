# [GAP-008] Endpoint query parameters ki clear documentation / schema
severity: P2 · score: 1 · class: feature-gap
personas_affected: transporter
source_scenarios: see evidence runs
evidence: debrief @ oneshot-20261021T21-54-59--transporter-run-trip.meta.json

## User story
As a <persona>, I want <capability>, so that <outcome>.
Quote: "Bhai itni der laga di, phir bhi Rajkot se Ahmedabad ka ek bhi load nahi mila, aur wallet toh dekhe hi nahi — bas Malegaon-Surat dikhaata raha, time barbaad ho gaya."

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
