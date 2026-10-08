# AGROVERCITY Launch Checklist

Evidence log for the production-ready-beta acceptance (execution-plan/README.md §5,
phase-08). Rows with an automated/measured result are filled here; staging and
business-persona rows are completed by the human operator with real keys.

| Check | Result | Date | Verdict |
|---|---|---|---|
| Website first-load JS (gzipped) | 262 KB | 2026-10-08 | PASS (<400 KB) |

## Pending operator evidence (staging, real keys)

- Backend load test (tasks/offers/checkout, 50 rps) — pending `.run-logs/phase-08-load_stats.csv`.
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
