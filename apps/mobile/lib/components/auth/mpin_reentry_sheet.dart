import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../api/endpoints.dart';
import '../../config.dart';
import '../../core/session_store.dart';
import '../../data/translations.dart';
import 'mpin_pad.dart';

// Opens the MPIN re-entry sheet, verifies the MPIN against the backend and
// refreshes the token pair. Uses a bare Dio so these public auth calls never
// recurse into the ApiClient 401 interceptor.
class MpinSessionRestorer extends SessionRestorer {
  MpinSessionRestorer({
    required this.contextProvider,
    Dio? dio,
    SessionStore? sessionStore,
    this.lang = 'hi',
    this.onLogout,
  })  : _dio = dio ?? Dio(BaseOptions(baseUrl: apiBaseUrl)),
        _sessionStore = sessionStore ?? SessionStore();

  final BuildContext? Function() contextProvider;

  /// Language code for the sheet's user-facing strings; defaults to Hindi.
  final String lang;
  final VoidCallback? onLogout;
  final Dio _dio;
  final SessionStore _sessionStore;

  String? _lastFailureReason;

  @override
  Future<bool> restoreSession() async {
    final context = contextProvider();
    if (context == null) return false;
    _lastFailureReason = null;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      isScrollControlled: true,
      builder: (_) => MpinReentrySheet(
        onVerify: _verifyMpinAndRefresh,
        getLastError: () => _lastFailureReason,
        onLogout: onLogout,
        lang: lang,
      ),
    );
    return ok ?? false;
  }

  Future<bool> _verifyMpinAndRefresh(String mpin) async {
    _lastFailureReason = null;
    final refreshToken = await _sessionStore.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) {
      _lastFailureReason = 'session_expired';
      return false;
    }

    final Response<Map<String, dynamic>> response;
    try {
      response = await _dio.post<Map<String, dynamic>>(
        pathAuthRefresh,
        data: {'refreshToken': refreshToken},
      );
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      if (code == 401 || code == 403 || code == 404) {
        _lastFailureReason = 'session_expired';
      } else {
        _lastFailureReason = 'network_error';
      }
      return false;
    }

    final data = response.data ?? {};
    final newAccessToken = data['accessToken'] as String?;
    final newRefreshToken = data['refreshToken'] as String?;
    if (newAccessToken == null || newRefreshToken == null) {
      _lastFailureReason = 'session_expired';
      return false;
    }

    try {
      await _dio.post(
        pathAuthMpinVerify,
        data: {
          'mpin': mpin,
          'refreshToken': refreshToken,
        },
        options: Options(
          headers: {'Authorization': 'Bearer $newAccessToken'},
        ),
      );
    } on DioException catch (e) {
      final res = e.response;
      final code = res?.data is Map
          ? (res?.data['error']?['code'] ?? res?.data['code'])
          : null;
      if (code == 'MPIN_NOT_SET' || res?.statusCode == 409) {
        _lastFailureReason = 'mpin_not_set';
      } else {
        _lastFailureReason = 'wrong_mpin';
      }
      return false;
    }

    await _sessionStore.saveTokens(newAccessToken, newRefreshToken);
    return true;
  }
}

class MpinReentrySheet extends StatefulWidget {
  const MpinReentrySheet({
    super.key,
    required this.onVerify,
    this.getLastError,
    this.onLogout,
    this.lang = 'hi',
  });

  final Future<bool> Function(String mpin) onVerify;
  final String? Function()? getLastError;
  final VoidCallback? onLogout;

  /// Language code for user-facing strings; defaults to Hindi.
  final String lang;

  @override
  State<MpinReentrySheet> createState() => _MpinReentrySheetState();
}

class _MpinReentrySheetState extends State<MpinReentrySheet> {
  final _mpinController = TextEditingController();
  bool _busy = false;
  bool _wrongMpin = false;
  String? _customError;
  bool _isSessionDead = false;

  Future<void> _submit() async {
    if (_mpinController.text.length != 4 || _busy) return;
    setState(() {
      _busy = true;
      _wrongMpin = false;
      _customError = null;
    });
    final ok = await widget.onVerify(_mpinController.text);
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop(true);
    } else {
      final reason = widget.getLastError?.call();
      setState(() {
        _busy = false;
        if (reason == 'session_expired') {
          _isSessionDead = true;
          _customError = widget.lang == 'hi'
              ? 'सत्र समाप्त हो चुका है। कृपया दोबारा लॉगिन करें।'
              : 'Session has fully expired. Please log in again.';
        } else if (reason == 'mpin_not_set') {
          _isSessionDead = true;
          _customError = widget.lang == 'hi'
              ? 'इस खाते का MPIN सेट नहीं है। कृपया OTP से लॉगिन करें।'
              : 'MPIN not set for this account. Please log in with OTP.';
        } else if (reason == 'network_error') {
          _customError = widget.lang == 'hi'
              ? 'नेटवर्क समस्या। कृपया पुनः प्रयास करें।'
              : 'Network error. Please try again.';
        } else {
          _wrongMpin = true;
          _mpinController.clear();
        }
      });
    }
  }

  void _goToLogin() {
    widget.onLogout?.call();
    Navigator.of(context).pop(false);
  }

  @override
  void dispose() {
    _mpinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final defaultHint = widget.lang == 'hi'
        ? 'डिफ़ॉल्ट MPIN: 1234'
        : 'Default MPIN: 1234';
    final loginLabel = widget.lang == 'hi'
        ? 'लॉगिन पेज पर जाएं ➔'
        : 'Go to Login Page ➔';

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
          Text(
            AppTranslations.get('onboarding.sessionExpiredTitle', widget.lang),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 6),
          Text(
            AppTranslations.get('onboarding.sessionExpiredBody', widget.lang),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 6),
          Text(
            defaultHint,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Color(0xFF16A34A),
            ),
          ),
          const SizedBox(height: 14),
          if (!_isSessionDead) ...[
            MpinPad(
              controller: _mpinController,
              errorText: _wrongMpin
                  ? AppTranslations.get('wrongMpin', widget.lang)
                  : _customError,
              onChanged: (_) => setState(() {
                _wrongMpin = false;
                _customError = null;
              }),
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
                  : Text(AppTranslations.get('onboarding.confirm', widget.lang)),
            ),
          ] else ...[
            if (_customError != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  _customError!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFDC2626),
                  ),
                ),
              ),
            FilledButton(
              onPressed: _goToLogin,
              child: Text(loginLabel),
            ),
          ],
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton(
                onPressed: _busy ? null : _goToLogin,
                child: Text(
                  widget.lang == 'hi' ? 'लॉगिन पेज पर जाएं' : 'Go to Login',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ),
              TextButton(
                onPressed: _busy ? null : () => Navigator.of(context).pop(false),
                child: Text(AppTranslations.get('cancel', widget.lang)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}