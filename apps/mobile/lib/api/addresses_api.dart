import 'api_client.dart';
import 'endpoints.dart';

class AddressesApi {
  AddressesApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> getAddresses() => _client.get(pathAddresses);

  Future<Map<String, dynamic>> createAddress(Map<String, dynamic> fields) =>
      _client.post(pathAddresses, body: fields);

  Future<Map<String, dynamic>> updateAddress(
    String id,
    Map<String, dynamic> fields,
  ) =>
      _client.put(addressPath(id), body: fields);

  Future<void> deleteAddress(String id) => _client.delete(addressPath(id));
}
