// Krishi Ratna gamification models — backed by /gamification/* endpoints.

class LevelInfo {
  final String tier; // bronze | silver | gold | diamond
  final String title;
  final int minCoins;
  final String? nextTier; // null when max tier reached
  final int coinsToNextTier;
  final double progressPct; // 0..100

  const LevelInfo({
    this.tier = 'bronze',
    this.title = '',
    this.minCoins = 0,
    this.nextTier,
    this.coinsToNextTier = 0,
    this.progressPct = 0,
  });

  factory LevelInfo.fromJson(Map<String, dynamic> json) => LevelInfo(
        tier: json['tier'] as String? ?? 'bronze',
        title: json['title'] as String? ?? '',
        minCoins: (json['minCoins'] as num?)?.toInt() ?? 0,
        nextTier: json['nextTier'] as String?,
        coinsToNextTier: (json['coinsToNextTier'] as num?)?.toInt() ?? 0,
        progressPct: (json['progressPct'] as num?)?.toDouble() ?? 0,
      );
}

class StreakInfo {
  final int current;
  final int longest;

  const StreakInfo({this.current = 0, this.longest = 0});

  factory StreakInfo.fromJson(Map<String, dynamic> json) => StreakInfo(
        current: (json['current'] as num?)?.toInt() ?? 0,
        longest: (json['longest'] as num?)?.toInt() ?? 0,
      );
}

class GamificationStats {
  final int coinsEarnedTotal;
  final int diaryEntries;
  final int referrals;
  final int redeems;

  const GamificationStats({
    this.coinsEarnedTotal = 0,
    this.diaryEntries = 0,
    this.referrals = 0,
    this.redeems = 0,
  });

  factory GamificationStats.fromJson(Map<String, dynamic> json) =>
      GamificationStats(
        coinsEarnedTotal: (json['coinsEarnedTotal'] as num?)?.toInt() ?? 0,
        diaryEntries: (json['diaryEntries'] as num?)?.toInt() ?? 0,
        referrals: (json['referrals'] as num?)?.toInt() ?? 0,
        redeems: (json['redeems'] as num?)?.toInt() ?? 0,
      );
}

class Badge {
  final String id;
  final String title;
  final String description;
  final String icon;
  final bool earned;
  final String? earnedAt; // ISO or null
  final int progress;
  final int target;

  const Badge({
    this.id = '',
    this.title = '',
    this.description = '',
    this.icon = '🏅',
    this.earned = false,
    this.earnedAt,
    this.progress = 0,
    this.target = 1,
  });

  factory Badge.fromJson(Map<String, dynamic> json) => Badge(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        description: json['description'] as String? ?? '',
        icon: json['icon'] as String? ?? '🏅',
        earned: json['earned'] as bool? ?? false,
        earnedAt: json['earnedAt'] as String?,
        progress: (json['progress'] as num?)?.toInt() ?? 0,
        target: (json['target'] as num?)?.toInt() ?? 1,
      );
}

class Reward {
  final String type; // voucher | soil_test | expert_call | workshop
  final String title;
  final int coinsCost;
  final String icon;
  final bool available;
  final String description;

  const Reward({
    this.type = '',
    this.title = '',
    this.coinsCost = 0,
    this.icon = '🎁',
    this.available = false,
    this.description = '',
  });

  factory Reward.fromJson(Map<String, dynamic> json) => Reward(
        type: json['type'] as String? ?? '',
        title: json['title'] as String? ?? '',
        coinsCost: (json['coinsCost'] as num?)?.toInt() ?? 0,
        icon: json['icon'] as String? ?? '🎁',
        available: json['available'] as bool? ?? false,
        description: json['description'] as String? ?? '',
      );
}

class GamificationStatus {
  final String userId;
  final int agriCoins;
  final LevelInfo level;
  final StreakInfo dailyStreak;
  final GamificationStats stats;
  final List<Badge> badges;
  final List<Reward> availableRewards;

  const GamificationStatus({
    this.userId = '',
    this.agriCoins = 0,
    this.level = const LevelInfo(),
    this.dailyStreak = const StreakInfo(),
    this.stats = const GamificationStats(),
    this.badges = const [],
    this.availableRewards = const [],
  });

  factory GamificationStatus.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic> asMap(dynamic v) =>
        v is Map ? v.cast<String, dynamic>() : const <String, dynamic>{};
    List<Map<String, dynamic>> asList(dynamic v) => v is List
        ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
        : const <Map<String, dynamic>>[];
    return GamificationStatus(
      userId: json['userId'] as String? ?? '',
      agriCoins: (json['agriCoins'] as num?)?.toInt() ?? 0,
      level: LevelInfo.fromJson(asMap(json['level'])),
      dailyStreak: StreakInfo.fromJson(asMap(json['dailyStreak'])),
      stats: GamificationStats.fromJson(asMap(json['stats'])),
      badges: asList(json['badges']).map(Badge.fromJson).toList(),
      availableRewards: asList(json['availableRewards'])
          .map(Reward.fromJson)
          .toList(),
    );
  }
}

class LedgerEntry {
  final String id;
  final int amount; // signed
  final String reason;
  final String? refId;
  final int balanceAfter;
  final String at; // ISO

  const LedgerEntry({
    this.id = '',
    this.amount = 0,
    this.reason = '',
    this.refId,
    this.balanceAfter = 0,
    this.at = '',
  });

  factory LedgerEntry.fromJson(Map<String, dynamic> json) => LedgerEntry(
        id: json['id'] as String? ?? '',
        amount: (json['amount'] as num?)?.toInt() ?? 0,
        reason: json['reason'] as String? ?? '',
        refId: json['refId'] as String?,
        balanceAfter: (json['balanceAfter'] as num?)?.toInt() ?? 0,
        at: json['at'] as String? ?? '',
      );
}

class LedgerPage {
  final List<LedgerEntry> data;
  final int page;
  final int pageSize;
  final int total;

  const LedgerPage({
    this.data = const [],
    this.page = 1,
    this.pageSize = 20,
    this.total = 0,
  });

  factory LedgerPage.fromJson(Map<String, dynamic> json) {
    final raw = json['data'];
    return LedgerPage(
      data: raw is List
          ? raw
              .whereType<Map>()
              .map((e) => LedgerEntry.fromJson(e.cast<String, dynamic>()))
              .toList()
          : const [],
      page: (json['page'] as num?)?.toInt() ?? 1,
      pageSize: (json['pageSize'] as num?)?.toInt() ?? 20,
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

class CoinsLeaderboardEntry {
  final int rank;
  final String userId;
  final String name;
  final String village;
  final int coinsEarned;
  final bool isMe;

  const CoinsLeaderboardEntry({
    this.rank = 0,
    this.userId = '',
    this.name = '',
    this.village = '',
    this.coinsEarned = 0,
    this.isMe = false,
  });

  factory CoinsLeaderboardEntry.fromJson(Map<String, dynamic> json) =>
      CoinsLeaderboardEntry(
        rank: (json['rank'] as num?)?.toInt() ?? 0,
        userId: json['userId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        village: json['village'] as String? ?? '',
        coinsEarned: (json['coinsEarned'] as num?)?.toInt() ?? 0,
        isMe: json['isMe'] as bool? ?? false,
      );
}

class CoinsMyRank {
  final int rank;
  final int coinsEarned;

  const CoinsMyRank({this.rank = 0, this.coinsEarned = 0});

  factory CoinsMyRank.fromJson(Map<String, dynamic> json) => CoinsMyRank(
        rank: (json['rank'] as num?)?.toInt() ?? 0,
        coinsEarned: (json['coinsEarned'] as num?)?.toInt() ?? 0,
      );
}

class CoinsLeaderboard {
  final List<CoinsLeaderboardEntry> data;
  final CoinsMyRank? myRank;
  final String period; // all | month

  const CoinsLeaderboard({
    this.data = const [],
    this.myRank,
    this.period = 'all',
  });

  factory CoinsLeaderboard.fromJson(Map<String, dynamic> json) {
    final raw = json['data'];
    final rawMyRank = json['myRank'];
    return CoinsLeaderboard(
      data: raw is List
          ? raw
              .whereType<Map>()
              .map((e) =>
                  CoinsLeaderboardEntry.fromJson(e.cast<String, dynamic>()))
              .toList()
          : const [],
      myRank: rawMyRank is Map
          ? CoinsMyRank.fromJson(rawMyRank.cast<String, dynamic>())
          : null,
      period: json['period'] as String? ?? 'all',
    );
  }
}

class RedeemResult {
  final String voucherCode;
  final int coins;
  final int balance;
  final Reward? reward;
  final String redeemedAt; // ISO

  const RedeemResult({
    this.voucherCode = '',
    this.coins = 0,
    this.balance = 0,
    this.reward,
    this.redeemedAt = '',
  });

  factory RedeemResult.fromJson(Map<String, dynamic> json) => RedeemResult(
        voucherCode: json['voucherCode'] as String? ?? '',
        coins: (json['coins'] as num?)?.toInt() ?? 0,
        balance: (json['balance'] as num?)?.toInt() ?? 0,
        reward: json['reward'] is Map
            ? Reward.fromJson(
                (json['reward'] as Map).cast<String, dynamic>(),
              )
            : null,
        redeemedAt: json['redeemedAt'] as String? ?? '',
      );
}
