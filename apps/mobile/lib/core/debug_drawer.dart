import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class DebugDrawer extends StatelessWidget {
  const DebugDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    if (!kDebugMode) return const SizedBox.shrink();
    return Drawer(
      child: SafeArea(
        child: ListView(
          children: [
            const ListTile(
              title: Text('Debug tools'),
              subtitle: Text('Debug builds only'),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.bug_report_outlined),
              title: const Text('Test crash (Crashlytics)'),
              onTap: () => FirebaseCrashlytics.instance.crash(),
            ),
          ],
        ),
      ),
    );
  }
}
