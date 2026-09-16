import 'api_client.dart';
import 'endpoints.dart';

class FpoApi {
  FpoApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> getFpoMe() => _client.get(pathFpoMe);

  Future<Map<String, dynamic>> getPools() => _client.get(pathFpoPools);

  Future<Map<String, dynamic>> joinPool(String id, int units) =>
      _client.post(fpoPoolJoinPath(id), body: {'units': units});

  Future<Map<String, dynamic>> getMachinery({String? week}) =>
      _client.get(pathFpoMachinery, query: {'week': ?week});
}
