# Conventions 03 — Git & Collaboration (2 Developers)

Team: **Dev A = backend** (`backend/`, `infra/`), **Dev B = Flutter** (`apps/mobile/`, `apps/admin/`). 15 days, fixed plan. This workflow exists so two people (plus LLM assistants) never block each other.

## 1. Branching — Trunk-Based, Short-Lived

- `main` is always green and deployable. Direct pushes to `main` are forbidden.
- All work happens on short-lived feature branches named by owner:
  - `dev-a/day05-mandi-cache`
  - `dev-b/day06-checkout-screen`
- Branch scope = one day-file task or a tight cluster of tasks from the same day. **Lifetime ≤ 1 day.** Merge or rebase daily; never let a branch age past the next morning sync.
- Start of day: `git checkout main && git pull && git checkout -b dev-a/dayXX-<slug>`.

## 2. Pull Requests & Review

1. Open a PR as soon as the task's Test command passes. Small PRs (one task) beat batching.
2. **Each dev reviews the other's PR.** Review checklist: conventions followed (`conventions/01`, `conventions/02`), no invented endpoints/fields, tests pass, no scope creep, no secrets.
3. Review SLA: respond within 2 working hours. A PR older than half a day blocks the author — escalate at the daily sync.
4. Merge with squash; PR title becomes the commit (see §5).
5. CI (GitHub Actions, set up Day 1) must pass before merge: backend = `ruff check`, `mypy`, `pytest`; Flutter = `flutter analyze`, `flutter test`.

## 3. Contract-First Rule (the most important rule here)

The 15-day plan pairs every backend feature with screens that consume it. To keep Dev B unblocked:

1. **Dev A merges API stubs BEFORE Dev B wires the matching screen.** A stub = router with exact path/method + complete Pydantic v2 request/response models + mock data response. Stubs land in `main` by **end of the previous day** (e.g. Day 6 marketplace stubs merge on Day 5 evening).
2. Dev B develops against the **OpenAPI spec** (`GET /openapi.json`, also exported by `backend/scripts/export_openapi.py`). The Flutter API classes are written from the spec; `api_client.dart` supports a `--dart-define=USE_MOCKS=true` mode that returns fixture JSON matching the spec for UI development without a running backend.
3. **Neither side changes a merged contract unilaterally.** If a field must change: Dev A edits the Pydantic model + stub first, posts the diff in the PR, Dev B approves, then both implement. The spec docs (`endpoints.md`, gap-analysis) are updated in the same PR.
4. Stub responses must be clearly marked: field values like `"mandiName": "STUB Nashik APMC"`, so a forgotten stub is visible in the UI and never mistaken for real data.

## 4. Conflict Avoidance

- Ownership by folder keeps conflicts rare: Dev A → `backend/`, `infra/`; Dev B → `apps/`.
- **Shared files with collision risk** — rules:
  | File | Rule |
  |---|---|
  | `docs/*` | edited only in dedicated `dev-a/docs-*` / `dev-b/docs-*` PRs, one file per PR |
  | root `README.md`, `.gitignore` | changes announced at daily sync before editing |
  | `infra/firestore.indexes.json` | Dev A only; Dev B requests indexes via PR comment |
  | `endpoints.md` / `endpoints.json` | frozen; extensions only via `docs/overview/03-gap-analysis-...md` PRs reviewed by both |
- If a rebase conflict happens anyway: rebase your branch on `main` (`git fetch && git rebase origin/main`), never merge `main` into a feature branch.

## 5. Commit Message Format

Conventional-commits style, imperative, ≤ 72 chars in the subject:

```
<type>(<scope>): <summary>

type:  feat | fix | test | chore | docs | refactor
scope: backend domain or app area — auth, mandi, marketplace, transport,
       equipment, land, broker, seller, insurance, content, chatbot,
       admin, mobile, admin-app, infra
```

Examples:

```
feat(mandi): add vyapari rates endpoint with 2h redis cache
feat(mobile): port aaj-ke-bhav widget, wire to /mandi/vyapari-rates
fix(equipment): enforce 2-slots-per-day rule (409 on third)
test(auth): cover mpin lockout after 5 failures
chore(infra): add redis to docker-compose
```

Body (optional): bullet the *why*, link the day task (`Day 5, Task 5.2`). Squash-merge keeps `main` history to one commit per PR.

## 6. Daily 15-Minute Sync

Every morning, 15 minutes, standing agenda:

1. Yesterday: merged PRs, any red tests left overnight (there should be none).
2. Today: which day-file tasks each dev picks; confirm stubs for tomorrow's Dev B work are merged or will be by tonight.
3. Blockers: contract changes, missing spec entries (add to gap doc first), environment issues.

## 7. Definition of Done for a Merge

1. CI green (lint + typecheck + tests).
2. Partner review approved.
3. Contract rule satisfied: any new/changed endpoint has its Pydantic models merged, and the spec docs updated in the same PR.
4. No `.env`, service-account JSON, or other secrets in the diff (CI runs a secret-scan step).
