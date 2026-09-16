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
}
