import 'api_client.dart';
import 'endpoints.dart';
import '../models/direct_buyer_models.dart';

class DirectBuyerApi {
  DirectBuyerApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> getProfile() =>
      _client.get(pathDirectBuyerProfile);

  Future<DirectBuyerAnalytics> getAnalytics() async {
    final res = await _client.get(pathDirectBuyerAnalytics);
    return DirectBuyerAnalytics.fromJson(res);
  }

  Future<List<SavedFarmer>> getSavedFarmers() async {
    final res = await _client.get(pathDirectBuyerSavedFarmers);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => SavedFarmer.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<void> saveFarmer(String farmerId) =>
      _client.post(pathDirectBuyerSavedFarmers, body: {'farmerId': farmerId});

  Future<void> removeSavedFarmer(String farmerId) =>
      _client.delete(directBuyerSavedFarmerPath(farmerId));

  Future<List<FeedLot>> getFeed({int limit = 20}) async {
    final res =
        await _client.get(pathDirectBuyerFeed, query: {'limit': limit});
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => FeedLot.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }
}
