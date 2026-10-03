import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../data/translations.dart';
import '../../state/app_state.dart';

class ForceUpdateDialog extends StatelessWidget {
  const ForceUpdateDialog({super.key, this.state})
      : _isMaintenance = false,
        onRetry = null;

  const ForceUpdateDialog.maintenance({super.key, required this.onRetry, this.state})
      : _isMaintenance = true;

  final bool _isMaintenance;
  final VoidCallback? onRetry;
  final AppState? state;

  static Future<void> show(
    BuildContext context, {
    bool maintenance = false,
    VoidCallback? onRetry,
    AppState? state,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => maintenance
          ? ForceUpdateDialog.maintenance(onRetry: onRetry ?? () {}, state: state)
          : ForceUpdateDialog(state: state),
    );
  }

  Future<void> _openPlayStore() {
    return launchUrl(
      Uri.parse(
        'https://play.google.com/store/apps/details?id=com.agrovercity.kisansetu',
      ),
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = state?.language ?? 'hi';
    return PopScope(
      canPop: false,
      child: AlertDialog(
        title: Text(AppTranslations.get('common.updateRequired', lang)),
        content: Text(
          _isMaintenance
              ? AppTranslations.get('common.maintenanceMessage', lang)
              : AppTranslations.get('common.updateMessage', lang),
        ),
        actions: [
          if (_isMaintenance)
            FilledButton(
              onPressed: onRetry,
              child: Text(AppTranslations.get('retry', lang)),
            )
          else
            FilledButton(
              onPressed: _openPlayStore,
              child: Text(AppTranslations.get('common.updateNow', lang)),
            ),
        ],
      ),
    );
  }
}
