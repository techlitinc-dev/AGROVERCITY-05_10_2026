# kisan_setu

AGROVERCITY user app (Android + Web).

## Web build notes (Day 14, Tasks B2/B6)

- **Build:** `flutter build web --release --dart-define=API_BASE_URL=https://api.agrovercity.in`
- **API base URL** lives in `lib/config.dart` (`apiBaseUrl`), overridable with
  `--dart-define=API_BASE_URL=...`. Defaults: web → `http://localhost:8000/v1`,
  Android emulator → `http://10.0.2.2:8000/v1` (physical device: pass the PC LAN IP).
- **No URL routes in v1:** the app is a state-machine router (`AppState.currentRoute`),
  so browser URLs do NOT reflect in-app navigation and deep links are not supported.
- **Legal-route exception (X18):** on web only, `Uri.base.path` is checked at startup;
  `/legal/privacy`, `/legal/terms`, `/legal/refunds`, `/legal/community` render
  `LegalPageView` standalone (bundled markdown from `assets/legal/`, no login gate).
  All other paths behave as today. These 4 URLs are the Play Store listing links —
  they must return 200 on the production hosting domain before submission.
- **Web guards:** Crashlytics handlers and camera-capture pickers are skipped on
  `kIsWeb` (Crashlytics has no web implementation; camera falls back to the file
  picker). The splash screen already uses static logo images on all platforms
  (the `splash.mp4` asset is unused).
- **Responsive:** wide windows (>900px) constrain the UI to a centered 480px column;
  `MediaQuery.textScaler` is clamped to max 1.3 so browser zoom doesn't break layouts.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
