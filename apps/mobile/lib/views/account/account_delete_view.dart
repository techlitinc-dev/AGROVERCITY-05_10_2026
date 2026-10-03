// Account: permanent account deletion (Play Store requirement) — MPIN gate,
// DELETE /v1/users/me, local session wipe.

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../api/api_exception.dart';
import '../../api/user_api.dart';
import '../../core/session_store.dart';
import '../../state/app_state.dart';

class AccountDeleteView extends StatefulWidget {
  final AppState state;
  final UserApi? userApi;

  const AccountDeleteView({super.key, required this.state, this.userApi});

  @override
  State<AccountDeleteView> createState() => _AccountDeleteViewState();
}

class _AccountDeleteViewState extends State<AccountDeleteView> {
  late final UserApi _api = widget.userApi ?? UserApi();

  final _mpinController = TextEditingController();
  String? _error;
  bool _deleting = false;

  @override
  void dispose() {
    _mpinController.dispose();
    super.dispose();
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _delete() async {
    final mpin = _mpinController.text.trim();
    if (mpin.length != 4) {
      setState(() => _error = widget.state.tr('account.enter4DigitMpin'));
      return;
    }
    setState(() {
      _error = null;
      _deleting = true;
    });
    try {
      await _api.deleteAccount(mpin);
      await SessionStore().clear();
      final prefs = await SharedPreferences.getInstance();
      await prefs.clear();
      if (!mounted) return;
      widget.state.restartOnboarding();
      _snack(widget.state.tr('account.accountDeleted'));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _deleting = false;
        if (e.code == 'WRONG_MPIN' || e.statusCode == 401) {
          _error = widget.state.tr('account.wrongMpin');
        } else if (e.statusCode == 429) {
          _error = widget.state.tr('account.tooManyAttempts');
        } else {
          _error = e.message.isNotEmpty
              ? e.message
              : widget.state.tr('account.deleteFailed');
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _deleting = false;
        _error = widget.state.tr('account.deleteFailedRetry');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.state.tr('deleteAccount'),
              style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF263238))),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFEE2E2),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFFCA5A5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded,
                        color: Color(0xFFDC2626), size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        widget.state.tr('account.cannotUndo'),
                        style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF991B1B)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  widget.state.tr('account.dataWillBeDeleted'),
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF7F1D1D)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          ...[
            'account.dataProfileInfo',
            'docVault',
            'account.dataFarmDiary',
            'account.dataLeaseRecords',
          ].map(
            (k) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  const Icon(Icons.remove_circle_outline,
                      size: 14, color: Color(0xFFDC2626)),
                  const SizedBox(width: 6),
                  Text(widget.state.tr(k),
                      style: const TextStyle(fontSize: 12.5)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _mpinController,
            keyboardType: TextInputType.number,
            obscureText: true,
            maxLength: 4,
            decoration: InputDecoration(
              labelText: widget.state.tr('account.enterMpin'),
              hintText: widget.state.tr('account.fourDigits'),
              errorText: _error,
              counterText: '',
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: _deleting ? null : _delete,
            icon: const Icon(Icons.delete_forever_rounded, size: 18),
            label: Text(
              _deleting
                  ? widget.state.tr('account.deleting')
                  : widget.state.tr('account.deletePermanently'),
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 46),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ],
      ),
    );
  }
}
