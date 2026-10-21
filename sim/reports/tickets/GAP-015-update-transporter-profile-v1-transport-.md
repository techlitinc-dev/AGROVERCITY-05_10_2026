# [GAP-015] update_transporter_profile_v1_transport_profile_put: agent expected success but got 403 (403=role scope? 404=missing? 422=validation?)
severity: P2 · score: 2 · class: expectation-mismatch
personas_affected: ?
source_scenarios: see evidence runs
evidence: mismatch @ smoke-20261021T17-57-07--transporter-run-trip.meta.json

## User story
As a <persona>, I want <capability>, so that <outcome>.
Quote: "Bhai, itna ghumaya transporter banne ke liye, load list tak nahi khula, OTP toh door ki baat hai, ye app direct bata nahi sakta tha ke pehle profile activate karni hai?"

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
