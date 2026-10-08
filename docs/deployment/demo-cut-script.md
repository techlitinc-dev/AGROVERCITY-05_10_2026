# AGROVERCITY Investor Demo-Cut Script (robust.md §11)

Live staging narrative, zero offline steps. Five beats; target ~9 minutes.

## Staging setup (before recording)

- Accounts: farmer (Ramesh), vyapari (Verma Traders), transporter (Singh
  Logistics), dairy manager (DairyOS Pro aspirant).
- Seeded: one open wheat lot; transporter with an available vehicle; escrow-funded
  vyapari wallet.

## Beats

1. **Farmer posts a lot** (~1 min) — Ramesh opens the AI-ranked dashboard → hero
   card "Post your wheat lot" → next-best-action deep link → lot form prefilled
   (crop, quantity, mandi modal band) → "AI sujhav" badges → publish. _Staging
   data: open lot created._
2. **Vyapari pays via escrow** (~2 min) — Verma sees the lot in FarmLink → makes an
   offer → farmer accepts → vyapari funds the **escrow** (Razorpay order → verify
   → webhook confirms) → purchase enters `escrow_funded`.
3. **Transporter delivers with POD** (~2 min) — transporter accepts the trip →
   pickup → weighbridge slip read → in-transit → delivery → **handover OTP**
   released by the farmer → proof-of-delivery completes.
4. **Commission settles** (~2 min) — next weekly settlement run computes the
   platform commission and the vyapari/farmer nets; TDS 194-O ledger entry and GST
   invoices appear; **dashboard shows the whole story as completed tasks**
   (post → offer → escrow → dispatch → delivered → settled).
5. **Dairy manager upgrades to Pro** (~2 min) — dairy console hits the 25-member
   Free cap → upgrade prompt → ₹1,499/mo Pro via Razorpay → member 26 unlocks →
   R1 (milk ledger) + R2 (route intelligence) + R3 (produce/livestock) visible.

## Recording

- _Pending:_ operator to run the cut live on staging, record it, note the total
  runtime, and paste the recording link/path + date here (phase-08 task 6.10).
