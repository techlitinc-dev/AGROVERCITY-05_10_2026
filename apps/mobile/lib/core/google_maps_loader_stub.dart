// Non-web fallback for the Google Maps loader. See google_maps_loader.dart.

bool get googleMapsLoaded => false;

/// Returns false — the real map is only available on web (and only when an
/// API key was provided via --dart-define).
Future<bool> ensureGoogleMapsLoaded(String apiKey) async => false;
