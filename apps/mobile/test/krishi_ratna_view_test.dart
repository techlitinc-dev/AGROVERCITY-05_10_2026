import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/gamification_api.dart';
import 'package:kisan_setu/models/gamification.dart';
import 'package:kisan_setu/views/krishi_ratna_view.dart';

import 'helpers.dart';

class FakeGamificationApi extends GamificationApi {
  GamificationStatus statusData = const GamificationStatus();
  LedgerPage ledgerData = const LedgerPage();
  List<Reward> rewardsData = const [];
  CoinsLeaderboard leaderboardData = const CoinsLeaderboard();
  RedeemResult redeemResult = const RedeemResult();
  Object? redeemError;

  int statusCalls = 0;
  int ledgerCalls = 0;
  final List<String> leaderboardPeriods = [];
  final List<Map<String, Object>> redeemCalls = [];

  @override
  Future<GamificationStatus> status() async {
    statusCalls++;
    return statusData;
  }

  @override
  Future<LedgerPage> ledger({int page = 1, int pageSize = 20}) async {
    ledgerCalls++;
    return ledgerData;
  }

  @override
  Future<List<Reward>> rewards() async => rewardsData;

  @override
  Future<CoinsLeaderboard> leaderboard({String period = 'all'}) async {
    leaderboardPeriods.add(period);
    return leaderboardData;
  }

  @override
  Future<RedeemResult> redeem({
    required String rewardType,
    required int coins,
  }) async {
    redeemCalls.add({'rewardType': rewardType, 'coins': coins});
    final err = redeemError;
    if (err != null) throw err;
    return redeemResult;
  }
}

const _statusJson = {
  'userId': 'u1',
  'agriCoins': 250,
  'level': {
    'tier': 'silver',
    'title': 'रुपेरी',
    'minCoins': 250,
    'nextTier': 'gold',
    'coinsToNextTier': 250,
    'progressPct': 35.0,
  },
  'dailyStreak': {'current': 3, 'longest': 5},
  'stats': {
    'coinsEarnedTotal': 400,
    'diaryEntries': 12,
    'referrals': 2,
    'redeems': 1,
  },
  'badges': [
    {
      'id': 'first_entry',
      'title': 'पहला कदम',
      'description': 'पहिली डायरी एंट्री',
      'icon': '🌱',
      'earned': true,
      'earnedAt': '2026-09-01T10:00:00.000Z',
      'progress': 1,
      'target': 1,
    },
    {
      'id': 'diary_regular',
      'title': 'नियमित नोंदी',
      'description': '७ दिवस लगातार नोंदी',
      'icon': '📓',
      'earned': true,
      'earnedAt': null,
      'progress': 7,
      'target': 7,
    },
    {
      'id': 'sharer',
      'title': 'शेअर करणारा',
      'description': '५ वेळा शेअर',
      'icon': '📣',
      'earned': false,
      'earnedAt': null,
      'progress': 2,
      'target': 5,
    },
    {
      'id': 'referral_star',
      'title': 'रेफरल स्टार',
      'description': '३ रेफरल',
      'icon': '⭐',
      'earned': false,
      'earnedAt': null,
      'progress': 1,
      'target': 3,
    },
    {
      'id': 'coin_collector',
      'title': 'नाणी संग्राहक',
      'description': '५०० नाणी',
      'icon': '🪙',
      'earned': false,
      'earnedAt': null,
      'progress': 250,
      'target': 500,
    },
    {
      'id': 'big_earner',
      'title': 'मोठी कमाई',
      'description': '१००० नाणी',
      'icon': '💰',
      'earned': false,
      'earnedAt': null,
      'progress': 400,
      'target': 1000,
    },
    {
      'id': 'redeemer',
      'title': 'रिडीमर',
      'description': 'पहिले रिडीम',
      'icon': '🎟️',
      'earned': false,
      'earnedAt': null,
      'progress': 0,
      'target': 1,
    },
    {
      'id': 'consistent',
      'title': 'सातत्य',
      'description': '१४ दिवस स्ट्रीक',
      'icon': '🔥',
      'earned': false,
      'earnedAt': null,
      'progress': 3,
      'target': 14,
    },
  ],
  'availableRewards': [
    {
      'type': 'voucher',
      'title': 'खाद वाउचर',
      'coinsCost': 300,
      'icon': '🎟️',
      'available': true,
      'description': '₹200 सूट वाउचर',
    },
    {
      'type': 'soil_test',
      'title': 'माती परीक्षण',
      'coinsCost': 500,
      'icon': '🧪',
      'available': true,
      'description': 'मोफत लॅब टेस्ट',
    },
    {
      'type': 'expert_call',
      'title': 'तज्ज्ञ कॉल',
      'coinsCost': 800,
      'icon': '📞',
      'available': true,
      'description': '30 मिनिटे व्हिडिओ कॉल',
    },
    {
      'type': 'workshop',
      'title': 'कार्यशाळा',
      'coinsCost': 1000,
      'icon': '🎓',
      'available': true,
      'description': 'प्रत्यक्ष प्रशिक्षण',
    },
  ],
};

const _ledgerJson = {
  'data': [
    {
      'id': 'l1',
      'amount': 150,
      'reason': 'referral',
      'refId': 'ref-1',
      'balanceAfter': 400,
      'at': '2026-09-25T10:30:00.000Z',
    },
    {
      'id': 'l2',
      'amount': -300,
      'reason': 'redeem',
      'refId': null,
      'balanceAfter': 100,
      'at': '2026-09-24T18:05:00.000Z',
    },
    {
      'id': 'l3',
      'amount': 20,
      'reason': 'spin_wheel',
      'refId': null,
      'balanceAfter': 420,
      'at': '2026-09-23T08:00:00.000Z',
    },
  ],
  'page': 1,
  'pageSize': 20,
  'total': 3,
};

const _leaderboardJson = {
  'data': [
    {
      'rank': 1,
      'userId': 'u1',
      'name': 'सुनीता देशमुख',
      'village': 'पुणे',
      'coinsEarned': 1200,
      'isMe': false,
    },
    {
      'rank': 2,
      'userId': 'me',
      'name': 'मी',
      'village': 'सातारा',
      'coinsEarned': 400,
      'isMe': true,
    },
    {
      'rank': 3,
      'userId': 'u3',
      'name': 'अनिल गायकवाड',
      'village': 'नाशिक',
      'coinsEarned': 350,
      'isMe': false,
    },
  ],
  'myRank': {'rank': 2, 'coinsEarned': 400},
  'period': 'all',
};

const _redeemJson = {
  'voucherCode': 'AGRI-Voucher-1234',
  'coins': 500,
  'balance': 700,
  'reward': {
    'type': 'soil_test',
    'title': 'माती परीक्षण',
    'coinsCost': 500,
    'icon': '🧪',
    'available': true,
    'description': 'मोफत लॅब टेस्ट',
  },
  'redeemedAt': '2026-09-26T06:00:00.000Z',
};

GamificationStatus _richStatus() =>
    GamificationStatus.fromJson(_statusJson);

GamificationStatus _richStatusWithCoins(int coins) {
  final json = Map<String, dynamic>.from(_statusJson);
  json['agriCoins'] = coins;
  return GamificationStatus.fromJson(json);
}

FakeGamificationApi _fakeApi() => FakeGamificationApi()
  ..statusData = _richStatus()
  ..ledgerData = LedgerPage.fromJson(_ledgerJson)
  ..rewardsData = (_statusJson['availableRewards'] as List)
      .map((e) => Reward.fromJson((e as Map).cast<String, dynamic>()))
      .toList()
  ..leaderboardData = CoinsLeaderboard.fromJson(_leaderboardJson)
  ..redeemResult = RedeemResult.fromJson(_redeemJson);

// pumpScreen leaves the data-driven widgets mid entrance-animation (their
// timers start when the loaded content mounts), which breaks hit tests and
// leaves pending timers; advance past the stagger before interacting.
Future<void> pumpKrishiView(WidgetTester tester, Widget view) async {
  await pumpScreen(tester, Scaffold(body: view));
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('renders balance, level, streak, stats, badges, ledger and leaderboard',
      (tester) async {
    final api = _fakeApi();

    await pumpKrishiView(
      tester,
      KrishiRatnaView(state: TestAppState(), api: api),
    );

    // Balance hero + level line.
    expect(find.text('250'), findsOneWidget);
    expect(find.text('स्तर: रुपेरी'), findsOneWidget);
    expect(find.textContaining('आणखी 250 नाणी पुढील स्तरासाठी'), findsOneWidget);
    // Streak card.
    expect(find.text('3 दिवस'), findsOneWidget);
    expect(find.text('5 दिवस'), findsOneWidget);
    // Stats row.
    expect(find.text('400'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    // Badge grid: 8 badges, 2 earned.
    final grid = tester.widget<GridView>(
      find.byKey(const ValueKey('krishiBadgeGrid')),
    );
    final gridDelegate = grid.childrenDelegate;
    expect(gridDelegate, isA<SliverChildListDelegate>());
    expect((gridDelegate as SliverChildListDelegate).children.length, 8);
    expect(find.text('पहला कदम'), findsOneWidget);
    expect(find.text('2/5'), findsOneWidget);
    // Ledger rows with Marathi reason labels.
    expect(find.text('+150'), findsOneWidget);
    expect(find.text('-300'), findsOneWidget);
    expect(find.text('रेफरल'), findsOneWidget);
    expect(find.text('रिडीम'), findsWidgets);
    expect(find.text('इतर'), findsOneWidget);
    // Leaderboard.
    expect(find.text('🥇'), findsOneWidget);
    expect(find.text('तुमचा क्रमांक: #2'), findsOneWidget);
    // Rewards store.
    expect(find.text('खाद वाउचर'), findsOneWidget);
    expect(find.text('कार्यशाळा'), findsOneWidget);
  });

  testWidgets('redeem button is disabled when balance is below cost',
      (tester) async {
    final api = _fakeApi(); // balance 250 < 300/500/800/1000

    await pumpKrishiView(
      tester,
      KrishiRatnaView(state: TestAppState(), api: api),
    );

    final voucherButton = tester.widget<ElevatedButton>(
      find.widgetWithText(ElevatedButton, '300 🪙 रिडीम करा'),
    );
    expect(voucherButton.onPressed, isNull);
    final workshopButton = tester.widget<ElevatedButton>(
      find.widgetWithText(ElevatedButton, '1000 🪙 रिडीम करा'),
    );
    expect(workshopButton.onPressed, isNull);
  });

  testWidgets('redeem flow confirms, calls api and shows voucher code',
      (tester) async {
    final api = _fakeApi()..statusData = _richStatusWithCoins(1200);

    await pumpKrishiView(
      tester,
      KrishiRatnaView(state: TestAppState(), api: api),
    );

    await tester.ensureVisible(
      find.widgetWithText(ElevatedButton, '500 🪙 रिडीम करा'),
    );
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(
      find.widgetWithText(ElevatedButton, '500 🪙 रिडीम करा'),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('होय, रिडीम करा'), findsOneWidget);
    await tester.tap(find.text('होय, रिडीम करा'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.redeemCalls.single, {
      'rewardType': 'soil_test',
      'coins': 500,
    });
    expect(find.text('AGRI-Voucher-1234'), findsOneWidget);
    expect(find.text('नवीन शिल्लक: 700 🪙'), findsOneWidget);

    // Closing the success dialog triggers the silent status/ledger refresh.
    await tester.tap(find.text('ठीक आहे'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(api.statusCalls, greaterThan(1));
    expect(api.ledgerCalls, greaterThan(2));
  });

  testWidgets('period toggle refetches leaderboard with month period',
      (tester) async {
    final api = _fakeApi();

    await pumpKrishiView(
      tester,
      KrishiRatnaView(state: TestAppState(), api: api),
    );

    expect(api.leaderboardPeriods, ['all']);
    await tester.ensureVisible(find.text('या महिन्यात'));
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.text('या महिन्यात'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.leaderboardPeriods, ['all', 'month']);
  });
}
