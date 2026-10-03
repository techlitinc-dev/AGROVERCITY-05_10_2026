import '../core/session_store.dart';
import 'api_client.dart';
import 'endpoints.dart';

class AuthApi {
  AuthApi({ApiClient? client, SessionStore? sessionStore})
      : _client = client ?? ApiClient(),
        _sessionStore = sessionStore ?? SessionStore();

  final ApiClient _client;
  final SessionStore _sessionStore;

  Future<Map<String, dynamic>> firebaseVerify(String idToken) async {
    final data = await _client.post(
      pathAuthFirebaseVerify,
      body: {'idToken': idToken},
    );
    await _saveTokenPair(data);
    return data;
  }

  Future<Map<String, dynamic>> loginWithPhoneMpin(String phone, String mpin) async {
    final data = await _client.post(
      pathAuthLogin,
      body: {'phone': phone, 'mpin': mpin},
    );
    await _saveTokenPair(data);
    return data;
  }

  Future<Map<String, dynamic>> register({
    required String idToken,
    required String name,
    required String phone,
    required String state,
    required String district,
    required String tehsil,
    required String village,
    required double landAreaAcres,
    required String soilType,
    required String irrigationType,
    required List<String> crops,
    required String mpin,
    required List<String> profiles,
    required String primaryProfile,
    String? referralCode,
    Map<String, Map<String, dynamic>>? roleProfiles,
    String? language,
    String? preferredLanguage,
  }) async {
    final body = <String, dynamic>{
      'idToken': idToken,
      'name': name,
      'phone': phone,
      'state': state,
      'district': district,
      'tehsil': tehsil,
      'village': village,
      'landAreaAcres': landAreaAcres,
      'soilType': soilType,
      'irrigationType': irrigationType,
      'crops': crops,
      'mpin': mpin,
      'profiles': profiles,
      'primaryProfile': primaryProfile,
      'language': language ?? 'en',
      'preferredLanguage': preferredLanguage ?? language ?? 'en',
    };
    if (referralCode != null && referralCode.trim().isNotEmpty) {
      body['referralCode'] = referralCode.trim();
    }
    if (roleProfiles != null && roleProfiles.isNotEmpty) {
      body['roleProfiles'] = roleProfiles;
    }
    final data = await _client.post(pathAuthRegister, body: body);
    await _saveTokenPair(data);
    return data;
  }

  Future<Map<String, dynamic>> mpinSet(String mpin) =>
      _client.post(pathAuthMpinSet, body: {'mpin': mpin});

  Future<Map<String, dynamic>> mpinVerify(String mpin) =>
      _client.post(pathAuthMpinVerify, body: {'mpin': mpin});

  Future<Map<String, dynamic>> mpinReset(String idToken, String newMpin) =>
      _client.post(
        pathAuthMpinReset,
        body: {'idToken': idToken, 'newMpin': newMpin},
      );

  Future<Map<String, dynamic>> refresh(String refreshToken) async {
    final data = await _client.post(
      pathAuthRefresh,
      body: {'refreshToken': refreshToken},
    );
    await _saveTokenPair(data);
    return data;
  }

  Future<void> _saveTokenPair(Map<String, dynamic> data) async {
    final access = data['accessToken'] as String?;
    final refresh = data['refreshToken'] as String?;
    if (access != null && refresh != null) {
      await _sessionStore.saveTokens(access, refresh);
    }
  }
}
