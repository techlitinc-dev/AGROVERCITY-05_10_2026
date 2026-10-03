import '../models/land_record.dart';
import 'api_client.dart';
import 'endpoints.dart';

class LandRecordsApi {
  LandRecordsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<LandRecord712>> search({
    String? gatNumber,
    String? village,
    String? district,
    String type = '712',
  }) async {
    final res = await _client.get(pathLandRecordsSearch, query: {
      'gatNumber': ?gatNumber,
      'village': ?village,
      'district': ?district,
      'type': type,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => LandRecord712.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<String> getPdfUrl(String recordId) async {
    final res = await _client.get(landRecordPdfPath(recordId));
    return res['pdfUrl'] as String? ?? '';
  }

  Future<Map<String, dynamic>> importRecord(String recordId) =>
      _client.post(landRecordImportPath(recordId));
}
