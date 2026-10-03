// Refer & Earn models (रेफर आणि कमवा) — backed by GET/POST /referrals.

class ReferralStats {
  final int invited;
  final int joined;
  final int totalEarnedCoins;

  const ReferralStats({
    this.invited = 0,
    this.joined = 0,
    this.totalEarnedCoins = 0,
  });

  factory ReferralStats.fromJson(Map<String, dynamic> json) => ReferralStats(
        invited: (json['invited'] as num?)?.toInt() ?? 0,
        joined: (json['joined'] as num?)?.toInt() ?? 0,
        totalEarnedCoins: (json['totalEarnedCoins'] as num?)?.toInt() ?? 0,
      );
}

class ReferralMilestone {
  final int count;
  final int rewardCoins;
  final bool achieved;

  const ReferralMilestone({
    this.count = 0,
    this.rewardCoins = 0,
    this.achieved = false,
  });

  factory ReferralMilestone.fromJson(Map<String, dynamic> json) =>
      ReferralMilestone(
        count: (json['count'] as num?)?.toInt() ?? 0,
        rewardCoins: (json['rewardCoins'] as num?)?.toInt() ?? 0,
        achieved: json['achieved'] as bool? ?? false,
      );
}

class ReferredContact {
  final String name;
  final String phone;
  final String status; // invited | joined
  final String invitedAt;
  final String? joinedAt;
  final int rewardCoins;

  const ReferredContact({
    this.name = '',
    this.phone = '',
    this.status = 'invited',
    this.invitedAt = '',
    this.joinedAt,
    this.rewardCoins = 0,
  });

  bool get isJoined => status == 'joined';

  factory ReferredContact.fromJson(Map<String, dynamic> json) => ReferredContact(
        name: json['name'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        status: json['status'] as String? ?? 'invited',
        invitedAt: json['invitedAt'] as String? ?? '',
        joinedAt: json['joinedAt'] as String?,
        rewardCoins: (json['rewardCoins'] as num?)?.toInt() ?? 0,
      );
}

class ReferralLeaderboardEntry {
  final int rank;
  final String userId;
  final String name;
  final String village;
  final int referralCount;
  final bool isMe;

  const ReferralLeaderboardEntry({
    this.rank = 0,
    this.userId = '',
    this.name = '',
    this.village = '',
    this.referralCount = 0,
    this.isMe = false,
  });

  factory ReferralLeaderboardEntry.fromJson(Map<String, dynamic> json) =>
      ReferralLeaderboardEntry(
        rank: (json['rank'] as num?)?.toInt() ?? 0,
        userId: json['userId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        village: json['village'] as String? ?? '',
        referralCount: (json['referralCount'] as num?)?.toInt() ?? 0,
        isMe: json['isMe'] as bool? ?? false,
      );
}

class ReferralMyRank {
  final int rank;
  final int referralCount;

  const ReferralMyRank({this.rank = 0, this.referralCount = 0});

  factory ReferralMyRank.fromJson(Map<String, dynamic> json) => ReferralMyRank(
        rank: (json['rank'] as num?)?.toInt() ?? 0,
        referralCount: (json['referralCount'] as num?)?.toInt() ?? 0,
      );
}

class ReferralSummary {
  final String referralCode;
  final String shareLink;
  final String shareMessage;
  final ReferralStats stats;
  final List<ReferralMilestone> milestones;
  final List<ReferredContact> referred;
  final List<ReferralLeaderboardEntry> leaderboard;
  final ReferralMyRank? myRank;

  const ReferralSummary({
    this.referralCode = '',
    this.shareLink = '',
    this.shareMessage = '',
    this.stats = const ReferralStats(),
    this.milestones = const [],
    this.referred = const [],
    this.leaderboard = const [],
    this.myRank,
  });

  factory ReferralSummary.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic> asMap(dynamic v) =>
        v is Map ? v.cast<String, dynamic>() : const <String, dynamic>{};
    List<Map<String, dynamic>> asList(dynamic v) => v is List
        ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
        : const <Map<String, dynamic>>[];
    return ReferralSummary(
      referralCode: json['referralCode'] as String? ?? '',
      shareLink: json['shareLink'] as String? ?? '',
      shareMessage: json['shareMessage'] as String? ?? '',
      stats: ReferralStats.fromJson(asMap(json['stats'])),
      milestones: asList(json['milestones'])
          .map(ReferralMilestone.fromJson)
          .toList(),
      referred:
          asList(json['referred']).map(ReferredContact.fromJson).toList(),
      leaderboard: asList(json['leaderboard'])
          .map(ReferralLeaderboardEntry.fromJson)
          .toList(),
      myRank: json['myRank'] is Map
          ? ReferralMyRank.fromJson(asMap(json['myRank']))
          : null,
    );
  }
}

// Result of POST /referrals/invite — the backend returns a partial payload:
// fresh stats/milestones plus the newly created invite. The view merges it
// into the cached ReferralSummary.
class InviteResult {
  final ReferredContact? invite;
  final String referralCode;
  final String shareLink;
  final String shareMessage;
  final int agriCoinsEarned;
  final ReferralStats? stats;
  final List<ReferralMilestone> milestones;

  const InviteResult({
    this.invite,
    this.referralCode = '',
    this.shareLink = '',
    this.shareMessage = '',
    this.agriCoinsEarned = 0,
    this.stats,
    this.milestones = const [],
  });

  factory InviteResult.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic> asMap(dynamic v) =>
        v is Map ? v.cast<String, dynamic>() : const <String, dynamic>{};
    List<Map<String, dynamic>> asList(dynamic v) => v is List
        ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
        : const <Map<String, dynamic>>[];
    return InviteResult(
      invite: json['invite'] is Map
          ? ReferredContact.fromJson(asMap(json['invite']))
          : null,
      referralCode: json['referralCode'] as String? ?? '',
      shareLink: json['shareLink'] as String? ?? '',
      shareMessage: json['shareMessage'] as String? ?? '',
      agriCoinsEarned: (json['agriCoinsEarned'] as num?)?.toInt() ?? 0,
      stats: json['stats'] is Map
          ? ReferralStats.fromJson(asMap(json['stats']))
          : null,
      milestones: asList(json['milestones'])
          .map(ReferralMilestone.fromJson)
          .toList(),
    );
  }
}
