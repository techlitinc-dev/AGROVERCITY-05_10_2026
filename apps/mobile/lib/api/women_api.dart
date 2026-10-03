import '../models/women_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class WomenApi {
  WomenApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<ShgProfile> getShg() async {
    final res = await _client.get(pathWomenShg);
    return ShgProfile.fromJson(res);
  }

  // 201 { deposited, newCorpus }; 409 DUPLICATE_DEPOSIT_MONTH when the
  // month is already deposited.
  Future<Map<String, dynamic>> deposit({
    required double amount,
    required String month,
  }) =>
      _client.post(pathWomenShgDeposit, body: {
        'amount': amount,
        'month': month,
      });

  Future<HomeEnterpriseSummary> getHomeEnterprise() async {
    final res = await _client.get(pathWomenHomeEnterprise);
    return HomeEnterpriseSummary.fromJson(res);
  }

  Future<List<GardenPlan>> getGardenPlans() async {
    final res = await _client.get(pathWomenGardenPlans);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => GardenPlan.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<BackyardLivestock>> getBackyardLivestock() async {
    final res = await _client.get(pathWomenBackyardLivestock);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) =>
            BackyardLivestock.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }
}
