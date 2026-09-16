import 'package:flutter/material.dart';

import '../../api/app_config_api.dart';
import '../../components/common/force_update_dialog.dart';

// Returns true when onboarding may proceed. Fails open on any error:
// a down backend must never brick the app.
Future<bool> checkAppConfigGate(
  BuildContext context,
  AppConfigApi api, {
  required VoidCallback onRetry,
}) async {
  try {
    final config = await api.getAppConfig();
    if (!context.mounted) return false;
    if (config['forceUpdate'] == true) {
      ForceUpdateDialog.show(context);
      return false;
    }
    if (config['maintenanceMode'] == true) {
      ForceUpdateDialog.show(
        context,
        maintenance: true,
        onRetry: () {
          Navigator.of(context, rootNavigator: true).pop();
          onRetry();
        },
      );
      return false;
    }
    return true;
  } catch (e) {
    debugPrint('app-config check failed, continuing: $e');
    return true;
  }
}
