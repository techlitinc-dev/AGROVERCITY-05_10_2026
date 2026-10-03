import '../models/climate_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class ClimateApi {
  ClimateApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<CarbonPotential> carbonPotential({double? lat, double? lng}) async {
    final res = await _client.get(pathClimateCarbonPotential, query: {
      'lat': ?lat,
      'lng': ?lng,
    });
    return CarbonPotential.fromJson(res);
  }

  Future<List<ResilientVariety>> resilientVarieties({String? crop}) async {
    final res = await _client.get(pathClimateResilientVarieties, query: {
      'crop': ?crop,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) =>
            ResilientVariety.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }
}
