import '../models/govt_scheme.dart';
import 'api_client.dart';
import 'endpoints.dart';

class SchemesApi {
  SchemesApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<GovtScheme>> listSchemes({
    String? category,
    bool eligibleOnly = false,
  }) async {
    final res = await _client.get(pathSchemes, query: {
      'category': ?category,
      if (eligibleOnly) 'eligibleOnly': 'true',
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => GovtScheme.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, dynamic>> applyScheme(
    String schemeId,
    List<String> documentIds,
  ) =>
      _client.post(schemeApplyPath(schemeId), body: {
        'documentIds': documentIds,
      });

  Future<List<PortalEntry>> getPortals() async {
    final res = await _client.get(pathSchemesPortals);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => PortalEntry.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }
}
