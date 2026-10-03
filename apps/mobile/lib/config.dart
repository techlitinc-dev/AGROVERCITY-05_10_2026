// Central build-time configuration.
//
// Override the API base URL at run/build time:
//   flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8000/v1
//   flutter build web --release --dart-define=API_BASE_URL=https://api.agrovercity.in
import 'package:flutter/foundation.dart' show kIsWeb;

/// Base URL the API layer talks to. Endpoint paths in
/// `lib/api/endpoints.dart` are relative to this root (including `/v1`).
///
/// Per-platform defaults: web builds reach the backend on localhost; the
/// Android emulator reaches the host machine via 10.0.2.2. A physical
/// device must pass the PC's LAN IP via `--dart-define`.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue:
      kIsWeb ? 'http://localhost:8000/v1' : 'http://10.0.2.2:8000/v1',
);
