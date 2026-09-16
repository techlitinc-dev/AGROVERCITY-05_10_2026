import 'api_client.dart';
import 'endpoints.dart';

class LotsApi {
  LotsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> createLot(Map<String, dynamic> fields) =>
      _client.post(pathMarketLots, body: fields);

  Future<Map<String, dynamic>> getMyLots({String? status, int page = 1}) =>
      _client.get(pathMarketLots, query: {'status': ?status, 'page': page});

  Future<Map<String, dynamic>> updateLot(
    String id,
    Map<String, dynamic> fields,
  ) =>
      _client.put(marketLotPath(id), body: fields);

  Future<Map<String, dynamic>> withdrawLot(String id) =>
      _client.delete(marketLotPath(id));
}
