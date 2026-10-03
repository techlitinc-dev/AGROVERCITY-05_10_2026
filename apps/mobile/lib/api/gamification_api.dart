import '../models/gamification.dart';
import 'api_client.dart';

class GamificationApi {
  static const String pathGamificationStatus = '/gamification/status';
  static const String pathGamificationLedger = '/gamification/ledger';
  static const String pathGamificationRewards = '/gamification/rewards';
  static const String pathGamificationRedeem = '/gamification/redeem';
  static const String pathGamificationLeaderboard = '/gamification/leaderboard';

  GamificationApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<GamificationStatus> status() async {
    final res = await _client.get(pathGamificationStatus);
    return GamificationStatus.fromJson(res);
  }

  Future<LedgerPage> ledger({int page = 1, int pageSize = 20}) async {
    final res = await _client.get(
      pathGamificationLedger,
      query: {'page': page, 'pageSize': pageSize},
    );
    return LedgerPage.fromJson(res);
  }

  Future<List<Reward>> rewards() async {
    final res = await _client.get(pathGamificationRewards);
    final raw = res['data'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => Reward.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  // Throws ApiException (400 INSUFFICIENT_COINS / VALIDATION_ERROR).
  Future<RedeemResult> redeem({
    required String rewardType,
    required int coins,
  }) async {
    final res = await _client.post(
      pathGamificationRedeem,
      body: {'rewardType': rewardType, 'coins': coins},
    );
    return RedeemResult.fromJson(res);
  }

  Future<CoinsLeaderboard> leaderboard({String period = 'all'}) async {
    final res = await _client.get(
      pathGamificationLeaderboard,
      query: {'period': period},
    );
    return CoinsLeaderboard.fromJson(res);
  }
}
