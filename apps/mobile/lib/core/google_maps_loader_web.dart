// Web implementation: injects the Google Maps JavaScript API <script> with the
// API key from --dart-define, then signals readiness via global callbacks.

import 'dart:async';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:web/web.dart' as web;

const String _readyCallback = '__geofenceMapsReady';

Future<bool>? _loadFuture;

bool get googleMapsLoaded => _mapsPresent();

bool _mapsPresent() {
  final g = (web.window as JSObject).getProperty<JSObject?>('google'.toJS);
  return g != null && g.hasProperty('maps'.toJS).toDart;
}

/// Injects the Maps JS API (once, shared by all callers) and completes when
/// it is usable. Returns false when the key is empty or loading failed —
/// callers should fall back to the non-map geofencing UI in that case.
Future<bool> ensureGoogleMapsLoaded(String apiKey) {
  if (apiKey.isEmpty) return Future.value(false);
  if (_mapsPresent()) return Future.value(true);
  _loadFuture ??= _load(apiKey);
  return _loadFuture!;
}

Future<bool> _load(String apiKey) {
  final completer = Completer<bool>();

  // google.maps calls window.__geofenceMapsReady on success, and
  // window.gm_authFailure when the key is rejected — wire both.
  (web.window as JSObject).setProperty(
    _readyCallback.toJS,
    (() {
      if (!completer.isCompleted) completer.complete(true);
    }).toJS,
  );
  (web.window as JSObject).setProperty(
    'gm_authFailure'.toJS,
    (() {
      if (!completer.isCompleted) completer.complete(false);
    }).toJS,
  );

  final script = web.document.createElement('script') as web.HTMLScriptElement
    ..src =
        'https://maps.googleapis.com/maps/api/js?key=$apiKey&callback=$_readyCallback'
    ..async = true;
  script.onerror = ((web.Event event) {
    if (!completer.isCompleted) completer.complete(false);
  }).toJS;
  web.document.head!.appendChild(script);

  return completer.future.timeout(
    const Duration(seconds: 15),
    onTimeout: () => _mapsPresent(),
  );
}
