# KYC Verification Status — Where It Lives in the Database

Reference guide (validated live against the running dev environment, 2026-11-17).
No code changes were needed — KYC status is already fully persisted.

## 1. `users` collection — current status per account

Each user document carries the account-level KYC state (set only by the
backend; the frontend cannot write these fields):

| Field | Values | Meaning |
|---|---|---|
| `kycStatus` | `unverified` \| `verified` | Whether identity verification has succeeded |
| `registrationStatus` | `pendingProfile` \| `pendingKyc` \| `completed` | Registration journey position; `pendingKyc` = profile done, KYC pending |
| `kycVerifiedAt` | ISO-8601 timestamp | When verification completed |
| `verificationMode` | `mock` \| `sandbox` | Which provider verified the user |
| `verifiedName` | string | Name returned by the provider |
| `maskedAadhaar` | e.g. `XXXXXXXX1018` | Last-4-only Aadhaar; full number is never stored |

Writer: `backend/app/routers/registration.py` (`registration/complete` sets
`kycStatus=verified`, `kycVerifiedAt`, `verificationMode`, `verifiedName`,
`maskedAadhaar` and flips `registrationStatus` to `completed` — only after a
verified KYC session + saved identity record).

## 2. `kyc_sessions` collection — per-attempt status lifecycle

One document per verification attempt:

- `userId`, `context` (`registration`, …), `provider`, `method` (`digilocker`, `aadhaar_okyc`)
- `status`: open = `created` → `pending` → `processing`; terminal = `verified` \| `failed` \| `expired` \| `reviewRequired` \| `denied`
- `createdAt` / `updatedAt` (ISO-8601), `authorizationUrl`, `error`
- Expiry is enforced on read (`expire_if_needed`)

Writer: `backend/app/services/kyc_sessions.py`.

## 3. `identity_verifications` collection — verified identity record

Saved separately so completion can prove the identity really landed:

- `id` / `sessionId`, `userId`
- `status` (`verified`), `provider` / `verificationMode`, `signatureVerified`
- `fullName`, `maskedAadhaar` (plus other provider-returned identity fields)

## 4. Related collections

- `kyc_documents` — uploaded KYC documents (separate document-KYC workflow)
- `kyc_cases` + admin audit — see §6

## 5. How to query the status

### User-facing APIs (Bearer token)

```bash
# Full account status — the frontend "Verified" badge reads this
GET /v1/kyc/me
# → {"registrationStatus":"completed","kycStatus":"verified",
#    "kycVerifiedAt":"…","verifiedName":"…","maskedAadhaar":"XXXXXXXX1018",
#    "verificationMode":"mock","provider":"mock","session":null,"testMode":true}

# Document-KYC case list for the signed-in user
GET /v1/kyc/status

# Session detail (poll during verification)
GET /v1/kyc/sessions/{session_id}

# Raw user document (also served to the app)
GET /v1/users/me
```

### Admin APIs (admin token)

```bash
GET  /v1/admin/kyc/pending                      # document-KYC cases awaiting review
POST /v1/admin/kyc/{case_id}:{doc_id}/verify    # approve — writes audit
POST /v1/admin/kyc/{case_id}:{doc_id}/reject    # reject — writes audit
```

### Firestore console

- `users/{uid}` → `kycStatus`, `registrationStatus`, `kycVerifiedAt`, `verificationMode`
- `kyc_sessions/{session_id}` → attempt status history per user (`userId` field)
- `identity_verifications/{session_id}` → verified record

## 6. Frontend display of these fields

- Navbar profile dropdown: `Verified` badge / `(Test)` tag / `KYC` status (`Navbar.tsx`)
- Login resume logic: `pendingKyc`/`pendingProfile` bounce back into the
  registration wizard (`LoginPage.tsx`)
- Registration wizard: step restore uses `registrationStatus` (`RegisterPage.tsx`)
- Profile page KYC card: reads `kycStatus` / `verificationMode`

## Verification of this document

Every endpoint, field, and enum above was checked live (login → `GET /v1/kyc/me`,
`GET /v1/kyc/status`) and against `backend/tests/test_admin_kyc.py` /
`test_kyc_pipeline.py` on 2026-11-17.
