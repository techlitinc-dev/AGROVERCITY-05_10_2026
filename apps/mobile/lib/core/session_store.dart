import 'package:shared_preferences/shared_preferences.dart';

class SessionStore {
  static const String kAccessToken = 'kAccessToken';
  static const String kRefreshToken = 'kRefreshToken';

  Future<void> saveTokens(String access, String refresh) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(kAccessToken, access);
    await prefs.setString(kRefreshToken, refresh);
  }

  Future<String?> get accessToken async =>
      (await SharedPreferences.getInstance()).getString(kAccessToken);

  Future<String?> get refreshToken async =>
      (await SharedPreferences.getInstance()).getString(kRefreshToken);

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(kAccessToken);
    await prefs.remove(kRefreshToken);
  }
}
