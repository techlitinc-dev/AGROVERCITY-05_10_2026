# Play Store Release Runbook — AGROVERCITY / Kisan Setu

> Package: `com.agrovercity.kisansetu`. Target: internal → closed → production track.

---

## 1. Signing setup (once)

```bash
keytool -genkey -v -keystore apps/mobile/android/upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias kisan_setu
```

`apps/mobile/android/key.properties` (gitignored — verify `git check-ignore android/key.properties android/upload-keystore.jks` returns both):

```properties
storePassword=<password>
keyPassword=<password>
keyAlias=kisan_setu
storeFile=../upload-keystore.jks
```

Back up the keystore + passwords to the company password vault **immediately** — losing the upload key means Play App Signing recovery flow.

`apps/mobile/android/app/build.gradle.kts` must load `key.properties` and set `signingConfig = signingConfigs.release` on the release build type (Day 15 Task B1).

## 2. Build the app bundle

```bash
cd apps/mobile
flutter build appbundle --release --dart-define=API_BASE_URL=https://api.agrovercity.in
# output: build/app/outputs/bundle/release/app-release.aab
```

## 3. Version strategy

In `apps/mobile/pubspec.yaml`: `version: 1.0.0+<versionCode>`.

- `versionCode` = integer, **monotonically increasing forever, never reused**. Scheme: `major*10000 + minor*100 + patch` → `1.0.0+10000`, `1.0.1+10001`, `1.1.0+10100`.
- Every upload to any track must have a versionCode higher than any previous upload.
- Bump in the same commit as the release; tag the commit `v1.0.0+10000`.

## 4. Play Console app creation (once)

1. Play Console → Create app → name **Kisan Setu — AGROVERCITY**, default language Hindi (hi-IN), app type: App, free.
2. Enroll in **Play App Signing** (Google holds the app-signing key; our upload key signs uploads).
3. Set up → App category: Business/Productivity.

## 5. Store listing copy

**Short description (80 chars):**
- hi: `किसान सेतु — मंडी भाव, फसल सलाह, लोन, बीमा और बाज़ार, सब एक ऐप में`
- en: `Kisan Setu — mandi rates, crop advice, loans, insurance & marketplace in one app`

**Full description (hi):**
```
किसान सेतु (AGROVERCITY) — भारतीय किसानों के लिए संपूर्ण कृषि सुपर ऐप।

🌾 लाइव मंडी भाव — आपके जिले की मंडियों के ताज़ा भाव, MSP तुलना और स्मार्ट मंडी चुनाव
🤖 किसान मित्र AI — हिंदी में सवाल पूछें: फसल, मौसम, कीट, सरकारी योजनाएं
📈 बाज़ार संतृप्ति सलाह — बुवाई से पहले जानें कीमत-जोखिम
🛒 कृषि बाज़ार — बीज, उर्वरक, यंत्र; QR प्रमाणित उत्पाद, UPI/COD/BNPL
📄 बायर कॉन्ट्रैक्ट — बुवाई-पूर्व रेट लॉक, डिजिटल हस्ताक्षर
🚜 यंत्र किराया — ट्रैक्टर/हार्वेस्टर टाइम-स्लॉट बुकिंग
🏛️ सरकारी योजनाएं — PM-KISAN, PMFBY, PM-KUSUM; पात्रता जांच और आवेदन
🛡️ फसल बीमा — पॉलिसी पासबुक, 72-घंटे दावा, दावा ट्रैकर
💰 वित्त — किसान क्रेडिट स्कोर, KCC, इनपुट लोन कैलकुलेटर
📓 फार्म डायरी और लाभ-हानि — PDF रिपोर्ट सहित
🌳 वृक्षारोपण, पशुपालन, जल प्रबंधन, FPO, महिला किसान हब और बहुत कुछ

6 प्रोफ़ाइल: किसान, खेत मालिक, परिवहन, व्यापारी, यंत्र किराया, दलाल — एक ही खाते में।
```

**Full description (en):** same structure translated: live mandi prices with MSP comparison, Kisan Mitra AI assistant in Hindi, market-saturation advisory, input marketplace with QR-verified products and UPI/COD/BNPL, pre-sowing buyer contracts with e-sign, equipment time-slot rental, government scheme eligibility + application, crop insurance with 72-hour claim tracking, kisan credit score & KCC, farm diary with PDF P&L reports, and 6 persona profiles in one account.

## 6. Screenshots (8, named)

Capture on a 1080×2400 device, Hindi locale:

1. `01_dashboard.png` — Farmer home with Aaj ke Bhav widget
2. `02_mandi.png` — Mandi prices + smart mandi calculator
3. `03_chatbot.png` — Kisan Mitra chat with rich card
4. `04_marketplace.png` — Product list + QR certificate dialog
5. `05_insurance.png` — Claim tracker timeline
6. `06_schemes.png` — Scheme cards with eligibility badges
7. `07_pnl.png` — Profit & Loss KPI cards
8. `09_profiles.png` — 6-persona profile switcher

Plus: feature graphic 1024×500 (brand logo on `#F5F7FA`) and app icon 512×512 (from `assets/app_icon.png`).

## 7. Content rating

Questionnaire answers: no violence, no gambling, no user-generated public content moderation needed beyond channel chat (chat exists — answer "Yes" to UGC and describe moderation: rate-limited, admin-managed channels); expected rating: **Everyone / 3+**.

## 8. Data Safety form

| Data type | Collected? | Shared? | Purpose | Notes |
|---|---|---|---|---|
| Phone number | Yes | No | Account creation (OTP auth), app functionality | Required |
| Name | Yes | No | Personalization | Required |
| Precise location | Yes | No | Mandi distance, pest radar, saturation advisory, farm mapping | Optional; only while using feature |
| Photos | Yes | No | Insurance claims, disease scan, vault documents | User-initiated uploads only |
| Financial info (orders, KCC metadata) | Yes | Razorpay (payments) | Payments, orders | Payment data processed by Razorpay |
| Financial info (bank account number, IFSC) | Yes | No | Insurance DBT, loan disbursal, settlements/payouts | Stored encrypted at rest (Firestore AES-256); only masked last-4 shown anywhere |
| Chat messages | **Conditional — only if X2 (persona chat) ships** | No | Farmer↔broker/transporter coordination | Declare only when Day 14 Task B8 ships; otherwise answer "No" and keep UGC answer limited to channel chat |
| Device IDs (FCM token) | Yes | Firebase | Push notifications | — |

All data: encrypted in transit (TLS). **"Data is deleted on request" → Yes** — in-app account deletion exists (`सेटिंग्स → खाता हटाएं`, server-side purge `DELETE /v1/users/me`).

## 9. Privacy policy & account deletion (Play requirements)

- Host privacy policy at `https://agrovercity.in/privacy` (static page; sections: data collected, purpose, third parties — Firebase/Razorpay/OpenRouter/Sarvam, retention, deletion rights, contact). Required in Play Console AND linked in-app (Settings → सहायता).
- **Legal page URLs (X18) must be live before listing submission** — the Flutter web build serves `/legal/privacy`, `/legal/terms`, `/legal/refunds`, `/legal/community` (Day 14 Task B6). Use these exact URLs in the Play Console listing fields; verify each returns 200 on the production hosting domain (Day 15 Task B5) BEFORE submitting — a dead policy URL is an automatic rejection.
- Play Console → App content → **Account deletion**: provide the web deletion URL (a page explaining in-app deletion steps, e.g. `https://agrovercity.in/delete-account`) — mandatory for apps with account creation. Verify the flow works on the release build (E2E checklist row 10).

## 10. Track promotion

1. **Internal testing** — create release → upload AAB → add tester email list (team) → rolling out in minutes via opt-in link. Run `docs/testing/test-strategy.md` §3 + §4 here.
2. **Closed testing** — promote the same release; add ~100 beta farmers; collect feedback ≥ 7 days; monitor Play pre-launch report + Crashlytics.
3. **Production** — promote with staged rollout: 10% → 50% → 100% over a week; halt on crash rate > 1%.

## 11. Release checklist (each release)

- [ ] versionCode bumped + git tag
- [ ] `flutter analyze` 0 issues; all widget tests pass
- [ ] Backend smoke test 26/26 PASS
- [ ] Signed AAB built with production API define
- [ ] Release notes (hi + en) filled in Play Console
- [ ] Data-safety form re-checked if the release adds a new data type (bank account number added in v1.0.0; chat messages only if X2 shipped)
- [ ] Legal page URLs (`/legal/privacy`, `/legal/terms`, `/legal/refunds`, `/legal/community`) live and 200 on the production hosting domain; account-deletion URL live
- [ ] Crashlytics + Play vitals clean for 48 h on the previous track before promotion
