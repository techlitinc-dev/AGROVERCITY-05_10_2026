import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../api/endpoints.dart';
import '../../core/constants.dart';
import '../../core/session_store.dart';
import 'mpin_pad.dart';

// Opens the MPIN re-entry sheet, verifies the MPIN against the backend and
// refreshes the token pair. Uses a bare Dio so these public auth calls never
// recurse into the ApiClient 401 interceptor.
class MpinSessionRestorer extends SessionRestorer {
  MpinSessionRestorer({
    required this.contextProvider,
    Dio? dio,
    SessionStore? sessionStore,
  })  : _dio = dio ?? Dio(BaseOptions(baseUrl: kApiBaseUrl)),
        _sessionStore = sessionStore ?? SessionStore();

  final BuildContext? Function() contextProvider;
  final Dio _dio;
  final SessionStore _sessionStore;

  @override
  Future<bool> restoreSession() async {
    final context = contextProvider();
    if (context == null) return false;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      isScrollControlled: true,
      builder: (_) => MpinReentrySheet(onVerify: _verifyMpinAndRefresh),
    );
    return ok ?? false;
  }

  Future<bool> _verifyMpinAndRefresh(String mpin) async {
    try {
      await _dio.post(pathAuthMpinVerify, data: {'mpin': mpin});
    } on DioException {
      return false;
    }
    final refreshToken = await _sessionStore.refreshToken;
    final response = await _dio.post<Map<String, dynamic>>(
      pathAuthRefresh,
      data: {'refreshToken': refreshToken},
    );
    final data = response.data ?? {};
    await _sessionStore.saveTokens(
      data['accessToken'] as String,
      data['refreshToken'] as String,
    );
    return true;
  }
}

class MpinReentrySheet extends StatefulWidget {
  const MpinReentrySheet({super.key, required this.onVerify});

  final Future<bool> Function(String mpin) onVerify;

  @override
  State<MpinReentrySheet> createState() => _MpinReentrySheetState();
}

class _MpinReentrySheetState extends State<MpinReentrySheet> {
  final _mpinController = TextEditingController();
  bool _busy = false;
  bool _wrongMpin = false;

  Future<void> _submit() async {
    if (_mpinController.text.length != 4 || _busy) return;
    setState(() {
      _busy = true;
      _wrongMpin = false;
    });
    final ok = await widget.onVerify(_mpinController.text);
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _busy = false;
        _wrongMpin = true;
      });
    }
  }

  @override
  void dispose() {
    _mpinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'सत्र समाप्त — MPIN दर्ज करें',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 6),
          const Text(
            'आपका सत्र समाप्त हो गया है। जारी रखने के लिए अपना MPIN दर्ज करें।',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 16),
          MpinPad(
            controller: _mpinController,
            errorText: _wrongMpin ? 'गलत MPIN' : null,
            onChanged: (_) => setState(() => _wrongMpin = false),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('पुष्टि करें'),
          ),
          TextButton(
            onPressed: _busy ? null : () => Navigator.of(context).pop(false),
            child: const Text('रद्द करें'),
          ),
        ],
      ),
    );
  }
}