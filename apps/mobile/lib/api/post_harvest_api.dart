import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

import '../models/post_harvest_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class PostHarvestApi {
  PostHarvestApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<ColdStorageFacility>> listColdStorage({
    double? lat,
    double? lng,
  }) async {
    final res = await _client.get(pathPostHarvestColdStorage, query: {
      'lat': ?lat,
      'lng': ?lng,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) =>
            ColdStorageFacility.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  // Multipart 1–3 images (jpeg/png ≤ 5 MB) → stub grader result.
  Future<GradeResult> grade(List<XFile> images) async {
    final form = FormData();
    for (final image in images) {
      form.files.add(MapEntry(
        'images',
        MultipartFile.fromBytes(
          await image.readAsBytes(),
          filename: image.name,
        ),
      ));
    }
    final res = await _client.postMultipart(pathPostHarvestGrade, form);
    return GradeResult.fromJson(res);
  }

  // 201 with the booking; 409 INSUFFICIENT_CAPACITY when the facility
  // cannot take the quantity.
  Future<Map<String, dynamic>> bookColdStorage(
    String facilityId, {
    required double quantityQuintals,
    required String fromDate,
    required int months,
  }) =>
      _client.post(coldStorageBookPath(facilityId), body: {
        'quantityQuintals': quantityQuintals,
        'fromDate': fromDate,
        'months': months,
      });
}
