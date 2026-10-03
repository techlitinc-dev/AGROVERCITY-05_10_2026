// Account: Help & Support — static Hindi FAQ, helpline, WhatsApp, Kisan Mitra.

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../components/voice/kisan_mitra_chatbot_sheet.dart';
import '../../state/app_state.dart';
import '../legal_page_view.dart';

class HelpSupportView extends StatelessWidget {
  final AppState state;

  const HelpSupportView({super.key, required this.state});

  List<(String, String)> _faqItems() => [
        (
          state.tr('account.faqLangQ'),
          state.tr('account.faqLangA'),
        ),
        (
          state.tr('account.faqMandiQ'),
          state.tr('account.faqMandiA'),
        ),
        (
          state.tr('account.faqSchemeQ'),
          state.tr('account.faqSchemeA'),
        ),
        (
          state.tr('account.faqCoinsQ'),
          state.tr('account.faqCoinsA'),
        ),
        (
          state.tr('account.faqDeleteQ'),
          state.tr('account.faqDeleteA'),
        ),
      ];

  Future<void> _open(String url) async {
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.tr('help'),
              style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF263238))),
          const SizedBox(height: 12),
          ..._faqItems().map(
            (f) => Card(
              color: Colors.white,
              margin: const EdgeInsets.only(bottom: 8),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
              child: ExpansionTile(
                title: Text(f.$1,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w800)),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                    child: Text(f.$2,
                        style: const TextStyle(
                            fontSize: 12, color: Colors.black87)),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          ElevatedButton.icon(
            onPressed: () => _open('tel:1800123456'),
            icon: const Icon(Icons.call_rounded, size: 18),
            label: Text(state.tr('account.callHelpline'),
                style: const TextStyle(fontWeight: FontWeight.w800)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1B4332),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 46),
            ),
          ),
          const SizedBox(height: 8),
          ElevatedButton.icon(
            onPressed: () => _open('https://wa.me/919999999999'),
            icon: const Icon(Icons.chat_rounded, size: 18),
            label: Text(state.tr('account.whatsappSupport'),
                style: const TextStyle(fontWeight: FontWeight.w800)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF25D366),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 46),
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              builder: (ctx) => KisanMitraChatbotSheet(state: state),
            ),
            icon: const Icon(Icons.smart_toy_rounded, size: 18),
            label: Text(state.tr('account.askKisanMitra'),
                style: const TextStyle(fontWeight: FontWeight.w800)),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF2E7D32),
              minimumSize: const Size(double.infinity, 46),
            ),
          ),
          const SizedBox(height: 16),
          const Divider(height: 24),
          const LegalLinksSection(),
        ],
      ),
    );
  }
}
