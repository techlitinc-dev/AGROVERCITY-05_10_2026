// Push notification scaffold (Day 11 Task B3). Only the claim deep-link
// routing hook exists today.
// TODO(day-13): FCM token registration + foreground/background handlers.

import '../state/app_state.dart';

class PushService {
  PushService(this._state);

  final AppState _state;

  void handleNotificationTap(Map<String, dynamic> data) {
    if (data['type'] == 'claim') {
      _state.openClaimTracker();
    }
  }
}
