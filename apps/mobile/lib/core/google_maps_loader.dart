// Loads the Google Maps JavaScript API on web before the map widget is built.
// Conditionally imported: the web implementation injects the Maps script with
// the API key from --dart-define; other platforms fall back to the stub.

export 'google_maps_loader_stub.dart'
    if (dart.library.js_interop) 'google_maps_loader_web.dart';
