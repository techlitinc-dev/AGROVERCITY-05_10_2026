import 'api_client.dart';
import 'endpoints.dart';

class WaterApi {
  WaterApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<Map<String, dynamic>>> getSchedule() async {
    final res = await _client.get(pathWaterSchedule);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => (e as Map).cast<String, dynamic>())
        .toList();
  }

  Future<Map<String, dynamic>> getGroundwater(String district) =>
      _client.get(pathWaterGroundwater, query: {'district': district});

  Future<List<Map<String, dynamic>>> getCanalRotation({String? canal}) async {
    final res =
        await _client.get(pathWaterCanalRotation, query: {'canal': ?canal});
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => (e as Map).cast<String, dynamic>())
        .toList();
  }

  Future<Map<String, dynamic>> pmksyCalc(double acres) =>
      _client.post(pathWaterPmksyCalculator, body: {'acres': acres});
}
