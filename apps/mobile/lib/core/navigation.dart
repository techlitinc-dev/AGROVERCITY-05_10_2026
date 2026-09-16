import 'package:flutter/material.dart';

// The app uses AppState + AnimatedSwitcher instead of routes, so this key is
// the only way non-widget code (the 401 interceptor) can reach a Navigator
// context to present modal sheets.
final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();
