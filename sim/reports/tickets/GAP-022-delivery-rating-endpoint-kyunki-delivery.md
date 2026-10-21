# [GAP-022] Delivery rating endpoint, kyunki delivery ko rate karna tha.
severity: P2 · score: 1 · class: feature-gap
personas_affected: customer
source_scenarios: see evidence runs
evidence: debrief @ smoke-20261021T17-57-07--customer-buy-basket.meta.json

## User story
As a <persona>, I want <capability>, so that <outcome>.
Quote: "Bhai, itni der se product list aur prod-3 ghumake thak gayi, par mall wala weekly vegetable basket mila hi nahi — app ne dukaan ki jagah beej aur khad dikha di!"

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
