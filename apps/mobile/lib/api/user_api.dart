import 'api_client.dart';
import 'endpoints.dart';

class UserApi {
  UserApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> getMe() => _client.get(pathUsersMe);

  Future<Map<String, dynamic>> updateMe(Map<String, dynamic> fields) =>
      _client.put(pathUsersMe, body: fields);

  Future<Map<String, dynamic>> saveFarmBoundary(
    List<Map<String, double>> points,
    double landAreaAcres,
    String? khasraNumber,
  ) =>
      _client.put(
        pathUsersMeFarmBoundary,
        body: {
          'farmBoundaryPoints': points,
          'landAreaAcres': landAreaAcres,
          'khasraNumber': ?khasraNumber,
        },
      );

  Future<Map<String, dynamic>> linkProfile(String profileType) =>
      _client.post(pathUsersMeProfiles, body: {'profileType': profileType});

  Future<Map<String, dynamic>> unlinkProfile(String profileType) =>
      _client.delete(userProfilePath(profileType));

  Future<Map<String, dynamic>> activateProfile(String profileType) =>
      _client.post(userProfileActivatePath(profileType));

  Future<Map<String, dynamic>> setPrimaryProfile(String profileType) =>
      _client.put(userProfilePrimaryPath(profileType));

  Future<Map<String, dynamic>> updateSettings(Map<String, dynamic> settings) =>
      _client.put(pathUsersMeSettings, body: settings);

  Future<Map<String, dynamic>> updateLanguage(String lang) =>
      _client.put(pathUsersMeSettings, body: {'language': lang, 'preferredLanguage': lang});

  Future<Map<String, dynamic>> getSettings() =>
      _client.get(pathUsersMeSettings);

  Future<Map<String, dynamic>> getConsents() =>
      _client.get(pathUsersMeConsents);

  Future<Map<String, dynamic>> putConsents({
    required bool dataSharing,
    required bool location,
    required bool marketing,
  }) =>
      _client.put(pathUsersMeConsents, body: {
        'dataSharing': dataSharing,
        'location': location,
        'marketing': marketing,
      });

  Future<Map<String, dynamic>> deleteAccount(String mpin) =>
      _client.delete(pathUsersMe, body: {'mpin': mpin});

  Future<Map<String, dynamic>> registerDevice({
    required String fcmToken,
    required String platform,
    String locale = 'en',
  }) =>
      _client.post(pathDevices, body: {
        'fcmToken': fcmToken,
        'platform': platform,
        'locale': locale,
      });

  Future<void> deleteDevice(String tokenHash) =>
      _client.delete(devicePath(tokenHash));
}
