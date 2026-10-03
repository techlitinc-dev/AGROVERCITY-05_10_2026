import 'api_client.dart';
import 'endpoints.dart';

/// Platform Advertisements API client.
class AdsApi {
  AdsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  static List<Map<String, dynamic>> _data(Map<String, dynamic> res) =>
      (res['data'] as List?)?.cast<Map<String, dynamic>>() ?? const [];

  Future<List<Map<String, dynamic>>> getActiveAds({String? placement}) async {
    final query = <String, dynamic>{
      if (placement != null && placement.isNotEmpty) 'placement': placement,
    };
    final res = await _client.get(pathAdsActive, query: query);
    return _data(res);
  }

  Future<void> recordImpression(String adId) async {
    try {
      await _client.post(adImpressionPath(adId));
    } catch (_) {}
  }

  Future<void> recordClick(String adId) async {
    try {
      await _client.post(adClickPath(adId));
    } catch (_) {}
  }

  Future<Map<String, dynamic>> createAd({
    required String title,
    required String targetUrl,
    required String imageUrl,
    String? subtitle,
    String? ctaText,
    String placement = 'home_hero',
    double budgetRupees = 500,
    int durationDays = 7,
  }) async {
    final res = await _client.post(
      pathAds,
      body: {
        'title': title,
        'targetUrl': targetUrl,
        'imageUrl': imageUrl,
        if (subtitle != null) 'subtitle': subtitle,
        if (ctaText != null) 'ctaText': ctaText,
        'placement': placement,
        'budgetRupees': budgetRupees,
        'durationDays': durationDays,
      },
    );
    return res;
  }

  Future<List<Map<String, dynamic>>> getMyAds() async {
    final res = await _client.get(pathAdsMine);
    return _data(res);
  }

  Future<Map<String, dynamic>> updateAdStatus(String adId, String status) async {
    final res = await _client.put(adPath(adId), body: {'status': status});
    return res;
  }
}
