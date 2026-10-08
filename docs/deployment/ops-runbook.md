# AGROVERCITY Ops Runbook

Operating manual for the production-ready beta. Follow the existing deploy docs
alongside this file.

## 1. Deploy steps

### Backend (Cloud Run / GCE)
1. Build & push the backend image (see `docs/deployment/backend-deploy.md`).
2. Deploy with env from GCP Secret Manager (`APP_ENV=prod`, real secrets).
3. Roll traffic: `gcloud run deploy agrovercity-api --image <tag> --region <r>`.
4. Health check: `curl -sf https://<api>/v1/health`.

### Website (Firebase Hosting / CDN)
1. `cd website && pnpm install --frozen-lockfile && pnpm build`.
2. `firebase deploy --only hosting`.

### Firestore indexes & rules
1. `firebase deploy --only firestore:indexes`.
2. `firebase deploy --only firestore:rules`.
3. Watch for `FAILED_PRECONDITION` index errors for 15 minutes post-deploy.

## 2. Rollback steps

- **Backend:** redeploy the previous revision —
  `gcloud run services update-traffic agrovercity-api --to-revisions=<prev>=100`.
  Verify `/v1/health`, then watch Sentry for 5 minutes.
- **Website:** `firebase hosting:rollback` (or redeploy the previous bundle).
- **Indexes/rules:** re-apply the previous `firestore.indexes.json` /
  `firestore.rules` from the last known-good commit and redeploy.
- **Data:** no destructive migrations in this program; rollback is config/code only.

## 3. On-call & alert routing

- Sentry (backend + website) → `#agrovercity-oncall` (PagerDuty for P1).
- Escalation: on-call engineer → platform lead → CTO (P1 within 15 min).
- AI Health page banner (`ai_golden_banner/current`) → triage golden regressions.

## 4. AI kill-switch & budget caps

- **Module kill-switch:** flip the module flag to `false` in the admin
  `platform_config/ai` editor (maker-checker + `audit_logs`). The gateway then
  degrades every call for that module to its deterministic fallback — no errors.
  Flags: `women_shg_readiness`, `receipt_scan`, `churn_signal`, `agent_rules`,
  `onboarding_copilot`, plus earlier modules.
- **Global AI kill:** set `platform_config/ai.modules` all `false`, or lower
  `AI_DAILY_BUDGET_USD` to force budget-trip degradation (`fallbackUsed` logged).
- **OpenRouter backstop:** account-level spend cap (operator-owned).

## Rehearsal log

- _Pending:_ operator to rehearse one rollback on staging and record the duration
  here with the date (phase-08 task 6.8).
