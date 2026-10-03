// Account: Settings — language, accessibility toggles, consent (X17),
// account deletion entry point.

import 'package:flutter/material.dart';

import '../../api/user_api.dart';
import '../../data/translations.dart';
import '../../state/app_state.dart';
import '../legal_page_view.dart';
import 'settings_consent_section.dart';

class SettingsView extends StatefulWidget {
  final AppState state;
  final UserApi? userApi;

  const SettingsView({super.key, required this.state, this.userApi});

  @override
  State<SettingsView> createState() => _SettingsViewState();
}

class _SettingsViewState extends State<SettingsView> {
  late final UserApi _api = widget.userApi ?? UserApi();

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _pushSettings() async {
    final s = widget.state;
    try {
      await _api.updateSettings({
        'language': s.language,
        'preferredLanguage': s.language,
        'womenMode': s.isWomenMode,
        'highContrast': s.isHighContrast,
        'darkMode': s.isDarkMode,
      });
    } catch (_) {
      _snack(s.tr('settingsSaveFailed'));
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.state,
      builder: (context, _) {
        final s = widget.state;
        return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(s.tr('settings'),
              style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF263238))),
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(
            key: ValueKey('settings_lang_${s.language}'),
            initialValue: s.language,
            decoration: InputDecoration(
              labelText: s.tr('language'),
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              isDense: true,
            ),
            items: AppTranslations.languageNames.entries
                .map((e) =>
                    DropdownMenuItem(value: e.key, child: Text(e.value)))
                .toList(),
            onChanged: (v) {
              if (v == null) return;
              s.setLanguage(v);
              _pushSettings();
            },
          ),
          const SizedBox(height: 8),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(s.tr('womenMode'),
                style:
                    const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
            value: s.isWomenMode,
            onChanged: (_) {
              s.toggleWomenMode();
              _pushSettings();
            },
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(s.tr('highContrast'),
                style:
                    const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
            value: s.isHighContrast,
            onChanged: (_) {
              s.toggleHighContrast();
              _pushSettings();
            },
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(s.tr('darkMode'),
                style:
                    const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
            value: s.isDarkMode,
            onChanged: (_) {
              s.toggleDarkMode();
              _pushSettings();
            },
          ),
          const Divider(height: 24),
          ConsentSection(userApi: _api, state: widget.state),
          const Divider(height: 24),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.delete_forever_rounded,
                color: Color(0xFFDC2626)),
            title: Text(s.tr('deleteAccount'),
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFFDC2626))),
            subtitle: Text(s.tr('deleteWarning'),
                style: const TextStyle(fontSize: 11)),
            onTap: () => s.navigateTo('accountDelete'),
          ),
          const SizedBox(height: 20),
          const LegalLinksSection(),
          const SizedBox(height: 12),
          Center(
            child: Text(s.tr('appVersion'),
                style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ),
        ],
      ),
    );
      },
    );
  }
}
