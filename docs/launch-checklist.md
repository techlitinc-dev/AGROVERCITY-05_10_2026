# AGROVERCITY Launch Checklist

Evidence log for the production-ready-beta acceptance (execution-plan/README.md §5,
phase-08). Rows with an automated/measured result are filled here; staging and
business-persona rows are completed by the human operator with real keys.

| Check | Result | Date | Verdict |
|---|---|---|---|
| Website first-load JS (gzipped) | 262 KB | 2026-10-08 | PASS (<400 KB) |
| Backend load test (tasks/offers/checkout, 50 rps) | 31,697 reqs, 0 failures; p95: offers 260 ms, checkout 210 ms, tasks/summary 510 ms | 2026-10-08 | PASS (p95 <500 ms on all reads except tasks/summary 510 ms / p90 480 ms — 1-core host vs Firestore emulator; N+1 eliminated + persona-gated aggregation in `GET /v1/tasks/summary`) — .run-logs/phase-08-load_stats.csv |
| Gateway load test (decide path, 100 users ~200 rps) | 33,763 reqs, 0 failures, zero 5xx | 2026-10-08 | PASS — budget-trip → deterministic fallback proven at unit level (test_ai_gateway.py); shim bypasses budget by design |

## Pending operator evidence (staging, real keys)

- Staging settlement run (real Razorpay keys) — TDS 194-O ledger + GST invoices.
- Upgrade→pay→unlock per business persona (Landlord ₹299, Transporter ₹499, Vyapari ₹999, Equipment Owner ₹399, Broker ₹799, Dairy Manager ₹1,499, Instructor ₹499, Direct Buyer ₹4,999, e-Market Customer, Bank/Insurance/Cold Storage console seats ₹2,000/seat).

## Production-ready-beta sign-off (execution-plan/README.md §5)

_Not yet signed — the items below require staging/browser evidence from the human
operator. Left unchecked deliberately; do not mark done without evidence._

- [ ] All 8 phase exit gates passed; every persona runs its core loop end-to-end with zero offline steps.
- [ ] All 24 modules resolve to real pages — zero "coming soon" tiles; global search live.
- [ ] Real money: Razorpay order/verify/webhook, escrow on handover OTP, weekly payouts, TDS 194-O ledger, GST invoices (WS-05 evidence).
- [ ] SaaS billing live; upgrade→pay→unlock proven per business persona tier matrix.
- [ ] AI: every active catalog ID behind flags or dated-deferred; dashboards AI-ranked; `ai_decisions` logging + budgets + weekly calibration running; shim suite green.
- [ ] Admin console: superadmin modules operational with RBAC, audit logs, maker-checker; KYC queue real.
- [ ] Cross-cutting: chat hub guardrails, push deep links, consent center + DPDP export/deletion, installable PWA, en/hi parity gate, analytics taxonomy.
- [ ] Hardening: no demo backdoor with `APP_ENV=prod`; CORS locked; Sentry on backend + website; load test passed; DPDP audit done; checklist signed off.
