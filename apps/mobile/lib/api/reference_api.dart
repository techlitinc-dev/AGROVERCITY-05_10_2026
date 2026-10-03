import 'api_client.dart';
import 'endpoints.dart';

// District crop reference — GET /v1/regions/crops?district=<name> returns
// {district, kharif: [], rabi: [], suggested: []}.
class RegionCrops {
  const RegionCrops({
    required this.district,
    required this.kharif,
    required this.rabi,
    required this.suggested,
  });

  final String district;
  final List<String> kharif;
  final List<String> rabi;
  final List<String> suggested;

  factory RegionCrops.fromJson(Map<String, dynamic> json) => RegionCrops(
        district: json['district'] as String? ?? '',
        kharif: ((json['kharif'] as List?) ?? const <dynamic>[])
            .map((e) => e.toString())
            .toList(),
        rabi: ((json['rabi'] as List?) ?? const <dynamic>[])
            .map((e) => e.toString())
            .toList(),
        suggested: ((json['suggested'] as List?) ?? const <dynamic>[])
            .map((e) => e.toString())
            .toList(),
      );
}

class ReferenceApi {
  ReferenceApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<RegionCrops> getRegionCrops(String district) async {
    final res = await _client.get(
      pathRegionsCrops,
      query: {'district': district},
    );
    return RegionCrops.fromJson(res);
  }
}
