import '../models/emarket_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class MyProductsApi {
  MyProductsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<UserProduct>> list() async {
    final res = await _client.get(pathMyProducts);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => UserProduct.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<UserProduct> create(UserProductInput input) async {
    final res = await _client.post(pathMyProducts, body: input.toJson());
    return UserProduct.fromJson(res);
  }

  Future<UserProduct> update(String id, Map<String, dynamic> fields) async {
    final res = await _client.put(myProductPath(id), body: fields);
    return UserProduct.fromJson(res);
  }

  Future<void> delete(String id) async {
    await _client.delete(myProductPath(id));
  }
}
