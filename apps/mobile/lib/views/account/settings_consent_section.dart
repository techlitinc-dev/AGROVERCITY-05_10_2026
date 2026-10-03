// Settings → privacy & consent section (X17) — PUT /v1/users/me/consents.

import 'package:flutter/material.dart';

import '../../api/user_api.dart';
import '../../data/translations.dart';
import '../../state/app_state.dart';

class ConsentSection extends StatefulWidget {
  final UserApi? userApi;
  final AppState? state;
  const ConsentSection({super.key, this.userApi, this.state});

  @override
  State<ConsentSection> createState() => ConsentSectionState();
}

class ConsentSectionState extends State<ConsentSection> {
  late final UserApi _api = widget.userApi ?? UserApi();

  String _tr(String key) => widget.state?.tr(key) ?? AppTranslations.get(key, 'en');

  bool _dataSharing = false;
  bool _location = false;
  bool _marketing = false;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.getConsents();
      if (!mounted) return;
      setState(() {
        _dataSharing = res['dataSharing'] as bool? ?? false;
        _location = res['location'] as bool? ?? false;
        _marketing = res['marketing'] as bool? ?? false;
        _loaded = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loaded = true);
    }
  }

  Future<void> _toggle(String flag, bool value) async {
    final prev = (_dataSharing, _location, _marketing);
    setState(() {
      if (flag == 'dataSharing') _dataSharing = value;
      if (flag == 'location') _location = value;
      if (flag == 'marketing') _marketing = value;
    });
    try {
      await _api.putConsents(
        dataSharing: _dataSharing,
        location: _location,
        marketing: _marketing,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _dataSharing = prev.$1;
        _location = prev.$2;
        _marketing = prev.$3;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_tr('account.consentSaveFailed'))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(_tr('privacyConsent'),
            style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                color: Color(0xFF263238))),
        const SizedBox(height: 6),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(_tr('account.consentDataSharing'),
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          subtitle: Text(
            _tr('account.consentDataSharingSub'),
            style: const TextStyle(fontSize: 11),
          ),
          value: _dataSharing,
          onChanged: _loaded ? (v) => _toggle('dataSharing', v) : null,
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(_tr('account.consentLocation'),
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          value: _location,
          onChanged: _loaded ? (v) => _toggle('location', v) : null,
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(_tr('account.consentMarketing'),
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          value: _marketing,
          onChanged: _loaded ? (v) => _toggle('marketing', v) : null,
        ),
        Text(
          _tr('account.consentOffWarning'),
          style: const TextStyle(
              fontSize: 11,
              fontStyle: FontStyle.italic,
              color: Colors.grey),
        ),
      ],
    );
  }
}
