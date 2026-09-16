import 'api_client.dart';
import 'endpoints.dart';

class WeatherApi {
  WeatherApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> getWeather(double lat, double lng) =>
      _client.get(pathWeather, query: {'lat': lat, 'lng': lng});
}
