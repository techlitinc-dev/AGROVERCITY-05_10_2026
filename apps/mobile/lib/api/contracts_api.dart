import 'api_client.dart';
import 'endpoints.dart';

class ContractsApi {
  ContractsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> getContracts({String? status, int page = 1}) =>
      _client.get(pathContracts, query: {'status': ?status, 'page': page});

  Future<Map<String, dynamic>> getContract(String id) =>
      _client.get(contractPath(id));

  Future<Map<String, dynamic>> acceptContract(
    String id, {
    required String signatureData,
    required String consentTimestamp,
    required String mpin,
  }) =>
      _client.post(contractAcceptPath(id), body: {
        'signatureData': signatureData,
        'consentTimestamp': consentTimestamp,
        'mpin': mpin,
      });
}
