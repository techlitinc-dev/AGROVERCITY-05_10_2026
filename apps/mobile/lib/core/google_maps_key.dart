// Google Maps API key for digital farm geofencing.
//
// The key is NEVER committed to the repo. Provide it at run/build time:
//   flutter run -d chrome --dart-define=GOOGLE_MAPS_API_KEY=YOUR_KEY
//   ./run.sh                      # with GOOGLE_MAPS_API_KEY set in the env
// See geofence.md for how to obtain a key.

const String kGoogleMapsApiKey = String.fromEnvironment('GOOGLE_MAPS_API_KEY');

bool get hasGoogleMapsApiKey => kGoogleMapsApiKey.isNotEmpty;
