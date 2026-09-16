import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class ForceUpdateDialog extends StatelessWidget {
  const ForceUpdateDialog({super.key})
      : _isMaintenance = false,
        onRetry = null;

  const ForceUpdateDialog.maintenance({super.key, required this.onRetry})
      : _isMaintenance = true;

  final bool _isMaintenance;
  final VoidCallback? onRetry;

  static Future<void> show(
    BuildContext context, {
    bool maintenance = false,
    VoidCallback? onRetry,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => maintenance
          ? ForceUpdateDialog.maintenance(onRetry: onRetry ?? () {})
          : const ForceUpdateDialog(),
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
    return PopScope(
      canPop: false,
      child: AlertDialog(
        title: const Text('अपडेट आवश्यक'),
        content: Text(
          _isMaintenance
              ? 'ऐप रखरखाव में है — थोड़ी देर बाद प्रयास करें'
              : 'ऐप का नया संस्करण उपलब्ध है — कृपया अपडेट करें',
        ),
        actions: [
          if (_isMaintenance)
            FilledButton(
              onPressed: onRetry,
              child: const Text('पुनः प्रयास करें'),
            )
          else
            FilledButton(
              onPressed: _openPlayStore,
              child: const Text('अपडेट करें'),
            ),
        ],
      ),
    );
  }
}
