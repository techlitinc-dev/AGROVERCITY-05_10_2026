import 'package:dio/dio.dart';

import '../models/advisory_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class AdvisoryApi {
  AdvisoryApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<SaturationAdvisory> checkSaturation({
    required String crop,
    required String district,
    required double lat,
    required double lng,
    int radiusKm = 10,
    bool shareSowingIntent = true,
  }) async {
    final res = await _client.post(
      pathAdvisorySaturation,
      body: {
        'crop': crop,
        'district': district,
        'lat': lat,
        'lng': lng,
        'radiusKm': radiusKm,
        'shareSowingIntent': shareSowingIntent,
      },
    );
    return SaturationAdvisory.fromJson(res);
  }

  Future<SowingIntentResult> submitSowingIntent({
    required String crop,
    String? plotId,
    required String plannedDate,
  }) async {
    final res = await _client.post(
      pathAdvisorySowingIntent,
      body: {
        'crop': crop,
        'plotId': ?plotId,
        'plannedDate': plannedDate,
      },
    );
    return SowingIntentResult.fromJson(res);
  }

  Future<List<DiseaseScanResult>> scanDisease({
    required List<int> imageBytes,
    required String filename,
    String? contentType,
  }) async {
    final form = FormData.fromMap({
      'image': MultipartFile.fromBytes(
        imageBytes,
        filename: filename,
        contentType: contentType == null ? null : DioMediaType.parse(contentType),
      ),
    });
    final res = await _client.postMultipart(pathAdvisoryDiseaseScan, form);
    return ((res['results'] as List?) ?? const <dynamic>[])
        .map((e) => DiseaseScanResult.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<PestRadarItem>> getPestRadar({
    required double lat,
    required double lng,
    int radiusKm = 5,
  }) async {
    final res = await _client.get(
      pathAdvisoryPestRadar,
      query: {'lat': lat, 'lng': lng, 'radiusKm': radiusKm},
    );
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => PestRadarItem.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<NpkRecommendation> getNpkRecommendation({
    required double n,
    required double p,
    required double k,
    required String crop,
    required String soilType,
  }) async {
    final res = await _client.post(
      pathAdvisoryNpk,
      body: {'n': n, 'p': p, 'k': k, 'crop': crop, 'soilType': soilType},
    );
    return NpkRecommendation.fromJson(res);
  }
}
