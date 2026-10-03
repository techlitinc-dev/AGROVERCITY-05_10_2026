// X18 static legal pages — bundled markdown rendered in-app (Android) and
// standalone at /legal/<page> URLs on the web build (see main.dart).

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:url_launcher/url_launcher.dart';

const Map<String, String> legalPageTitles = {
  'privacy': 'गोपनीयता नीति',
  'terms': 'नियम व शर्तें',
  'refunds': 'रिफंड नीति',
  'community': 'समुदाय दिशानिर्देश',
};

/// Returns the legal page key when [path] is a `/legal/<page>` URL, else null.
String? legalPageForPath(String path) {
  final match = RegExp(r'^/legal/(privacy|terms|refunds|community)/?$')
      .firstMatch(path);
  return match?.group(1);
}

/// Opens a legal page: on web navigates the browser to the standalone URL,
/// on mobile pushes [LegalPageView] in-app.
Future<void> openLegalPage(BuildContext context, String page) async {
  if (kIsWeb) {
    await launchUrl(
      Uri.parse('/legal/$page'),
      webOnlyWindowName: '_blank',
    );
    return;
  }
  await Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => LegalPageView(page: page)),
  );
}

class LegalPageView extends StatelessWidget {
  final String page;

  const LegalPageView({super.key, required this.page});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(legalPageTitles[page] ?? page),
        backgroundColor: const Color(0xFF1B4332),
        foregroundColor: Colors.white,
      ),
      body: FutureBuilder<String>(
        future: rootBundle.loadString('assets/legal/$page.md'),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const Center(child: Text('पृष्ठ लोड नहीं हो सका'));
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          return MarkdownBody(
            data: snapshot.data!,
            selectable: true,
            styleSheet: MarkdownStyleSheet(
              h1: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: Color(0xFF1B4332),
              ),
              h2: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: Color(0xFF263238),
              ),
              p: const TextStyle(fontSize: 12.5, height: 1.5),
              listBullet: const TextStyle(fontSize: 12.5),
            ),
          );
        },
      ),
    );
  }
}

/// The 4 legal link tiles shared by Settings and Help & Support.
class LegalLinksSection extends StatelessWidget {
  const LegalLinksSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('कानूनी',
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w900,
                color: Color(0xFF263238))),
        const SizedBox(height: 4),
        for (final entry in legalPageTitles.entries)
          ListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            leading: const Icon(Icons.description_outlined,
                size: 20, color: Color(0xFF2E7D32)),
            title: Text(entry.value,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w700)),
            trailing: const Icon(Icons.open_in_new_rounded,
                size: 16, color: Colors.grey),
            onTap: () => openLegalPage(context, entry.key),
          ),
      ],
    );
  }
}
