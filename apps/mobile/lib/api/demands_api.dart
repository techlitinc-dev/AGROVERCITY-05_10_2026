import 'api_client.dart';
import 'endpoints.dart';
import '../models/direct_buyer_models.dart';

class DemandsApi {
  DemandsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Demand> createDemand(Map<String, dynamic> fields) async {
    final res = await _client.post(pathDemands, body: fields);
    return Demand.fromJson(res);
  }

  Future<Map<String, dynamic>> listDemands({
    String? crop,
    String? state,
    String status = 'open',
    int page = 1,
    int pageSize = 20,
  }) =>
      _client.get(pathDemands, query: {
        'crop': ?crop,
        'state': ?state,
        'status': status,
        'page': page,
        'pageSize': pageSize,
      });

  Future<Demand> getDemand(String id) async {
    final res = await _client.get(demandPath(id));
    return Demand.fromJson(res);
  }

  Future<Demand> updateDemand(String id, Map<String, dynamic> fields) async {
    final res = await _client.put(demandPath(id), body: fields);
    return Demand.fromJson(res);
  }

  Future<Demand> closeDemand(String id) async {
    final res = await _client.post(demandClosePath(id));
    return Demand.fromJson(res);
  }

  Future<Demand> reopenDemand(String id) async {
    final res = await _client.post(demandReopenPath(id));
    return Demand.fromJson(res);
  }

  Future<void> deleteDemand(String id) => _client.delete(demandPath(id));
}
