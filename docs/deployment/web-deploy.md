# Web Deployment — Firebase Hosting (user app + admin console)

> Two Firebase Hosting **sites** in one Firebase project:
> - `app` → user-facing Flutter Web app (`apps/mobile/build/web`) → `app.agrovercity.in`
> - `admin` → admin console (`apps/admin/build/web`) → `admin.agrovercity.in`

---

## 1. One-time setup

```bash
npm install -g firebase-tools
firebase login
firebase use $PROJECT_ID   # e.g. agrovercity-prod

# Create the second site (the default site hosts the user app)
firebase hosting:sites:create agrovercity-admin --project $PROJECT_ID
```

## 2. `firebase.json` (repo root)

```json
{
  "hosting": [
    {
      "target": "app",
      "public": "apps/mobile/build/web",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }],
      "headers": [
        {
          "source": "**/*.@(js|css|wasm|png|jpg|jpeg|svg|woff2|mp4)",
          "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
        },
        {
          "source": "/index.html",
          "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }]
        },
        {
          "source": "/flutter_service_worker.js",
          "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
        },
        {
          "source": "/version.json",
          "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
        }
      ]
    },
    {
      "target": "admin",
      "public": "apps/admin/build/web",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [{ "source": "**", "destination": "/index.html" }],
      "headers": [
        {
          "source": "**/*.@(js|css|wasm|png|jpg|jpeg|svg|woff2)",
          "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
        },
        {
          "source": "/index.html",
          "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }]
        }
      ]
    }
  ]
}
```

`.firebaserc` (repo root) maps targets to sites:

```json
{
  "projects": { "default": "agrovercity-prod" },
  "targets": {
    "agrovercity-prod": {
      "hosting": {
        "app":   ["agrovercity-prod"],
        "admin": ["agrovercity-admin"]
      }
    }
  }
}
```

If targets are not yet applied: `firebase target:apply hosting app agrovercity-prod && firebase target:apply hosting admin agrovercity-admin`.

**SPA rewrite:** the `rewrites` rule above is required — the Flutter app uses client-side navigation; every unknown path must serve `index.html`.

**Cache headers rationale:** Flutter web emits content-hashed asset filenames (safe to cache forever); `index.html`, `version.json` and the service worker must never be cached or releases won't roll out.

## 3. API base URL per environment

Both apps read the backend URL from a compile-time define (`lib/config.dart`):

```dart
const String apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:8000');
```

| Environment | Build command |
|---|---|
| Local dev | `flutter run -d chrome` (default `http://localhost:8000`) |
| Staging | `flutter build web --release --dart-define=API_BASE_URL=https://api-staging.agrovercity.in` |
| Production | `flutter build web --release --dart-define=API_BASE_URL=https://api.agrovercity.in` |

## 4. Deploy

```bash
# Build both apps
cd apps/mobile && flutter build web --release --dart-define=API_BASE_URL=https://api.agrovercity.in && cd ../..
cd apps/admin  && flutter build web --release --dart-define=API_BASE_URL=https://api.agrovercity.in && cd ../..

# Deploy both sites (or one at a time: --only hosting:app)
firebase deploy --only hosting:app,hosting:admin --project $PROJECT_ID
```

Default URLs: `https://agrovercity-prod.web.app` and `https://agrovercity-admin.web.app`.

## 5. Custom domains

Firebase console → Hosting → each site → "Add custom domain":

- `app.agrovercity.in` → user app site
- `admin.agrovercity.in` → admin site

Add the verification TXT + A records shown by the console; Firebase provisions managed TLS automatically.

## 6. Verify

```bash
curl -I https://app.agrovercity.in            # 200
curl -I https://app.agrovercity.in/mandi      # 200 (SPA rewrite serves index.html)
curl -I https://admin.agrovercity.in          # 200
```

Manual: open user site → login → dashboard loads data from `https://api.agrovercity.in` (check DevTools Network — no `localhost:8000` calls, i.e. the dart-define took effect). Open admin site → login with an admin-claimed account → analytics cards populate.

## 7. Rollback

Firebase console → Hosting → site → Release history → ⋯ → **Rollback** (instant, keeps prior build). Or redeploy the previous git tag's `build/web`.
