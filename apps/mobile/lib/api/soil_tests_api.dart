import 'api_client.dart';
import 'endpoints.dart';

class SoilTestsApi {
  SoilTestsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> bookSoilTest({
    String? plotId,
    required String address,
    required String slot,
  }) =>
      _client.post(pathSoilTestsBook, body: {
        'plotId': ?plotId,
        'address': address,
        'slot': slot,
      });

  Future<List<Map<String, dynamic>>> listSoilTests() async {
    final res = await _client.get(pathSoilTests);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => (e as Map).cast<String, dynamic>())
        .toList();
  }
}
