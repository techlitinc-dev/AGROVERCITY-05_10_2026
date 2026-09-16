# Backend Deployment — FastAPI on Cloud Run

> Target: `api.agrovercity.in` → Cloud Run service `kisan-setu-api`, region `asia-south1`.
> Prerequisites: `gcloud` CLI authenticated, billing enabled, project id referenced below as `$PROJECT_ID` (set it: `export PROJECT_ID=agrovercity-prod`).

---

## 1. Enable services (once)

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com vpcaccess.googleapis.com redis.googleapis.com \
  firestore.googleapis.com --project $PROJECT_ID
```

Firebase project (Firestore, Auth, FCM, Storage) must exist and be linked to the same GCP project.

## 2. Dockerfile

`backend/Dockerfile`:

```dockerfile
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
```

`backend/.dockerignore`:

```
__pycache__/
*.pyc
tests/
.env
.git/
venv/
```

## 3. Redis (Memorystore)

```bash
gcloud redis instances create kisan-setu-redis --size=1 --region=asia-south1 \
  --redis-version=redis_7_0 --project $PROJECT_ID
gcloud redis instances describe kisan-setu-redis --region=asia-south1 \
  --format='value(host)' --project $PROJECT_ID   # note HOST
```

Cloud Run reaches Memorystore through a Serverless VPC connector:

```bash
gcloud compute networks vpc-access connectors create kisan-connector \
  --region=asia-south1 --range=10.8.0.0/28 --project $PROJECT_ID
```

`REDIS_URL = redis://<HOST>:6379/0`

## 4. Secrets (Secret Manager)

Create each secret, then grant the Cloud Run service account access:

| Secret name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Full service-account JSON (Firebase console → Project settings → Service accounts) |
| `REDIS_URL` | `redis://<HOST>:6379/0` |
| `JWT_SECRET` | 64-char random (`openssl rand -hex 32`) |
| `RAZORPAY_KEY_ID` | Razorpay live key id |
| `RAZORPAY_KEY_SECRET` | Razorpay live secret |
| `OPENROUTER_API_KEY` | OpenRouter key |
| `SARVAM_API_KEY` | Sarvam AI key |

```bash
echo -n "<value>" | gcloud secrets create <NAME> --data-file=- --project $PROJECT_ID
SA=$(gcloud run services describe kisan-setu-api --region asia-south1 \
  --format='value(spec.template.spec.serviceAccountName)' --project $PROJECT_ID 2>/dev/null)
# (use the default compute SA on first deploy: <project-number>-compute@developer.gserviceaccount.com)
gcloud secrets add-iam-policy-binding <NAME> \
  --member="serviceAccount:<SA>" --role="roles/secretmanager.secretAccessor" --project $PROJECT_ID
```

Repeat `add-iam-policy-binding` for all 7 secrets.

## 5. Build & deploy

```bash
gcloud artifacts repositories create kisan-setu --repository-format=docker \
  --location=asia-south1 --project $PROJECT_ID   # once

cd backend
gcloud builds submit --tag asia-south1-docker.pkg.dev/$PROJECT_ID/kisan-setu/api:v1 --project $PROJECT_ID

gcloud run deploy kisan-setu-api \
  --image asia-south1-docker.pkg.dev/$PROJECT_ID/kisan-setu/api:v1 \
  --region asia-south1 --platform managed --allow-unauthenticated \
  --vpc-connector kisan-connector \
  --set-secrets FIREBASE_SERVICE_ACCOUNT=FIREBASE_SERVICE_ACCOUNT:latest,REDIS_URL=REDIS_URL:latest,JWT_SECRET=JWT_SECRET:latest,RAZORPAY_KEY_ID=RAZORPAY_KEY_ID:latest,RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest,OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest,SARVAM_API_KEY=SARVAM_API_KEY:latest \
  --set-env-vars ENV=production,FIREBASE_PROJECT_ID=$PROJECT_ID \
  --min-instances 0 --max-instances 10 --concurrency 80 --memory 512Mi \
  --project $PROJECT_ID
```

Verify:

```bash
curl https://<run-url>/v1/health   # {"status":"ok"}
python scripts/smoke_test.py https://<run-url>
```

## 6. Firestore rules & indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes --project $PROJECT_ID
# files: infra/firestore.rules (deny-all; backend uses Admin SDK), infra/firestore.indexes.json
```

## 7. Custom domain + HTTPS

```bash
gcloud run domain-mappings create --service kisan-setu-api \
  --domain api.agrovercity.in --region asia-south1 --project $PROJECT_ID
```

Add the DNS records printed by the command at the DNS provider (A/AAAA records to Google IPs). Managed TLS certificate is provisioned automatically (allow ~15 min). Verify `curl -I https://api.agrovercity.in/v1/health` → 200 with valid cert.

## 8. Rollback

Every deploy creates an immutable revision. Roll back by shifting traffic:

```bash
gcloud run revisions list --service kisan-setu-api --region asia-south1 --project $PROJECT_ID
gcloud run services update-traffic kisan-setu-api --region asia-south1 \
  --to-revisions <PREVIOUS_REVISION>=100 --project $PROJECT_ID
```

Config-only rollbacks are instant; image rollbacks take effect in < 1 min. Database schema changes must be backward-compatible so a rollback never strands data (additive fields only within a release).

## 9. Operational checks

- Logs: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=kisan-setu-api" --limit 50 --format json` — expect one JSON line per request (Day 15 middleware).
- Rate limiting: Redis must be reachable through the VPC connector — if Memorystore is down the middleware fails open (requests allowed, warning logged).
- Secrets rotation: update secret version, then `gcloud run services update kisan-setu-api --update-secrets NAME=NAME:latest` to pick it up.
