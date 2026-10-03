# Digital Farm Geofencing — Google Maps Setup

This guide gets you a Google Maps API key and connects it to the AGROVERCITY
farm-geofencing step (onboarding → *Digital Farm Geofencing*).

Without a key the app still works: the farm-map step falls back to a sample
boundary UI. With a key (web builds), farmers get a real Google Map where they
tap to drop boundary pins, see live acreage/boundary length, locate the farm
via GPS, and save real coordinates to the backend.

---

## 1. Create a Google Cloud project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with a Google account.
3. Click the project dropdown at the top → **New Project**.
4. Name it (e.g. `agrovercity`) and click **Create**.
5. Select the new project from the dropdown.

## 2. Enable billing

Google Maps Platform requires a billing account (Google gives **$200/month
free credit** — light development usage is typically free).

1. In the console: ☰ menu → **Billing** → **Link a billing account**.
2. Follow the prompts (a credit/debit card is required; nothing is charged
   while you stay within the monthly free tier).

## 3. Enable the required APIs

Enable each API your platforms need:

| Platform | API to enable |
|---|---|
| Web (Chrome) | **Maps JavaScript API** |
| Android app | **Maps SDK for Android** |
| iOS app | **Maps SDK for iOS** |

Steps:

1. ☰ menu → **APIs & Services** → **Library**.
2. Search for the API name (e.g. "Maps JavaScript API").
3. Click it → **Enable**. Repeat for the others.

For local development on Chrome you only need **Maps JavaScript API**.

## 4. Create the API key

1. ☰ menu → **APIs & Services** → **Credentials**.
2. **+ Create Credentials** → **API key**.
3. Copy the key (a long string like `AIzaSyB...`). **Keep it private.**

### Restrict the key (important)

An unrestricted key that leaks can be abused and billed to you. Click the key
in the Credentials list and set **Application restrictions**:

- **Web**: *HTTP referrers* — add
  - `http://localhost:5174/*`  (run.sh prebuilt web bundle)
  - `http://localhost:*/*`     (flutter run dev server, any port)
  - your production domain(s), e.g. `https://app.agrovercity.in/*`
- **Android**: *Android apps* — add your package name
  (`com.techlitinc.kisansetu` — check `android/app/build.gradle` →
  `applicationId`) plus a debug SHA-1 (see step 6).
- **API restrictions**: restrict the key to only the Maps APIs you enabled
  (Maps JavaScript API, Maps SDK for Android, Maps SDK for iOS).

## 5. Use the key in this project

The key is passed at build/run time and is **never committed to the repo**.

### Option A — `./run.sh` (recommended)

```bash
export GOOGLE_MAPS_API_KEY=AIzaSyB...
./run.sh
```

`run.sh` forwards the key to both `flutter build web` (prebuilt bundle) and
`flutter run` (dev mode). Rebuilding is automatic when sources change.

### Option B — manual flutter commands

```bash
cd apps/mobile
flutter run -d chrome \
  --dart-define=GOOGLE_MAPS_API_KEY=AIzaSyB...
# or a release build:
flutter build web \
  --dart-define=GOOGLE_MAPS_API_KEY=AIzaSyB...
```

The app reads the key in `lib/core/google_maps_key.dart` via
`String.fromEnvironment('GOOGLE_MAPS_API_KEY')`. On web, the Maps JavaScript
API is injected at runtime from that key (`google_maps_loader_web.dart`) —
nothing is written into `web/index.html`.

## 6. Android / iOS (native apps)

The geofencing UI currently activates the real map on **web** builds. For
native builds you additionally embed the key in the platform projects:

**Android** — `android/app/src/main/AndroidManifest.xml`, inside `<application>`:

```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="YOUR_KEY_HERE"/>
```

Also add location permissions (for *Find by GPS*):

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
```

The debug SHA-1 for the key restriction:

```bash
cd android && ./gradlew signingReport   # copy the debug SHA-1
```

**iOS** — `ios/Runner/AppDelegate.swift`, before `GeneratedPluginRegistrant.register`:

```swift
import GoogleMaps
GMSServices.provideAPIKey("YOUR_KEY_HERE")
```

and in `ios/Runner/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Used to centre the map on your farm.</string>
```

Then enable the real-map branch in `farm_map_marker_view.dart` for non-web
platforms (currently gated on `kIsWeb`).

## 7. Verify it works

1. Start the app with the key set: `./run.sh` (or manual command above).
2. Register/login and reach onboarding step 4 (*Digital Farm Geofencing*).
3. You should see a real map centred on your GPS location (grant the
   browser's location prompt), with **Undo / Clear / Confirm** controls and a
   live area readout as you drop pins.
4. Confirm saves `farmBoundaryPoints` + `landAreaAcres` via
   `PUT /v1/users/me/farm-boundary` (check `.run-logs/backend.log`).

## 8. Pricing notes (as of 2026 — verify current rates)

- Maps JavaScript API is billed per map load (roughly **$7 per 1,000 loads**).
- The **$200 monthly credit** covers ~28,000 map loads/month free.
- Geolocation (browser GPS) is free; it does not use Google's Geolocation API.
- Set [budget alerts](https://console.cloud.google.com/billing/budgets) on
  the billing account to catch unexpected usage.

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Toast "Could not load Google Maps" | Key missing (`--dart-define` not passed) or key restricted to wrong referrers. Browser console shows the exact error. |
| Console: `RefererNotAllowedMapError` | Add the app's origin (e.g. `http://localhost:5174/*`) to the key's HTTP referrer restriction. |
| Console: `ApiNotActivatedMapError` | Enable **Maps JavaScript API** in the library (step 3). |
| Console: `BillingNotEnabledMapError` | Link/enable billing on the Google Cloud project (step 2). |
| Map grey, "For development purposes only" | Invalid or over-quota key — check the console errors and quotas page. |
| GPS button does nothing | Browser denied location permission — allow it in the address-bar site settings. Geolocation also requires `localhost` or HTTPS. |
| Key works locally but not in production | Add the production origin to the referrer restriction. |

---

**Security reminder:** treat the key like a password. Restricted keys are safe
to ship in client apps (they are visible in the browser), but never commit an
*unrestricted* key to the repository, and rotate the key immediately if you
suspect it leaked.
