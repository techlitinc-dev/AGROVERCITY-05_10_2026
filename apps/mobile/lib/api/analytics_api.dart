import '../models/emarket_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class AnalyticsApi {
  AnalyticsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<CustomerAnalytics> getCustomer() async {
    final res = await _client.get(pathAnalyticsCustomer);
    return CustomerAnalytics.fromJson(res);
  }

  Future<SellerAnalytics> getSeller() async {
    final res = await _client.get(pathAnalyticsSeller);
    return SellerAnalytics.fromJson(res);
  }
}
