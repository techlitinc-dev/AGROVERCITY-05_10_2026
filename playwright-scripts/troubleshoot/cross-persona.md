# Troubleshoot — Cross-persona workflow chain

> One story across five actors: farmer posts a lot → buyer posts a requirement → vyapari & transporter see trade boards → customer browses the mall.
> Walked: 2026-11-02T18:13:11.431Z

- ✅ **[farmer]** farmer posts produce lot — create attempt → blocked-by-kyc
- ✅ **[directBuyer]** direct buyer posts requirement — create attempt → blocked-by-kyc
- ✅ **[seller]** vyapari views lot discovery — listing renders (1450 chars of content)
- ✅ **[transporter]** transporter views loads board — loads board renders (1341 chars of content)
- ❌ **[customer]** customer browses mall → cart — no product card found

Notes: `blocked-by-kyc` means the UI correctly refused the action because the account lacks verified KYC — seeded demo users (dev-user-*) carry no `kycStatus` field, so backend KYC gates treat them as unverified. To exercise the full create flows, seed kycStatus="verified" on the demo users or complete KYC through the UI.

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test specs/cross-persona.spec.ts
```
