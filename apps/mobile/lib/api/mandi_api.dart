import 'api_client.dart';
import 'endpoints.dart';

class MandiApi {
  MandiApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> getPrices({String? crop, int page = 1}) =>
      _client.get(pathMandiPrices, query: {'crop': ?crop, 'page': page});

  Future<Map<String, dynamic>> getMandiList() => _client.get(pathMandiList);

  Future<Map<String, dynamic>> getVyapariRates({List<String>? crops}) =>
      _client.get(pathMandiVyapariRates, query: {
        if (crops != null && crops.isNotEmpty) 'crops': crops.join(','),
      });

  Future<Map<String, dynamic>> compare(
    String crop,
    double quantityQuintals,
    double lat,
    double lng,
  ) =>
      _client.get(pathMandiCompare, query: {
        'crop': crop,
        'quantityQuintals': quantityQuintals,
        'lat': lat,
        'lng': lng,
      });

  Future<Map<String, dynamic>> getPriceHistory(
    String crop,
    String mandi, {
    int months = 3,
  }) =>
      _client.get(pathMandiPriceHistory, query: {
        'crop': crop,
        'mandi': mandi,
        'months': months,
      });
}
