import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/api/referral_api.dart';
import 'package:kisan_setu/models/referral.dart';
import 'package:kisan_setu/views/refer_earn_view.dart';

import 'helpers.dart';

class FakeReferralApi extends ReferralApi {
  ReferralSummary summary = const ReferralSummary();
  InviteResult inviteResult = const InviteResult();
  Object? inviteError;
  int getCalls = 0;
  final List<Map<String, String>> inviteCalls = [];

  @override
  Future<ReferralSummary> get() async {
    getCalls++;
    return summary;
  }

  @override
  Future<InviteResult> invite({
    required String name,
    required String phone,
  }) async {
    inviteCalls.add({'name': name, 'phone': phone});
    final err = inviteError;
    if (err != null) throw err;
    return inviteResult;
  }
}

const _summaryJson = {
  'referralCode': 'REFABC123',
  'shareLink': 'https://agrovercity.in/r/REFABC',
  'shareMessage': 'AGROVERCITY मध्ये सामील व्हा!',
  'stats': {'invited': 2, 'joined': 1, 'totalEarnedCoins': 250},
  'milestones': [
    {'count': 1, 'rewardCoins': 50, 'achieved': true},
    {'count': 5, 'rewardCoins': 200, 'achieved': false},
    {'count': 10, 'rewardCoins': 500, 'achieved': false},
  ],
  'referred': [
    {
      'name': 'राम पाटील',
      'phone': '+919876543210',
      'status': 'joined',
      'invitedAt': '2026-09-10T10:00:00.000Z',
      'joinedAt': '2026-09-20T10:00:00.000Z',
      'rewardCoins': 100,
    },
    {
      'name': 'शाम जाधव',
      'phone': '+919812345670',
      'status': 'invited',
      'invitedAt': '2026-09-22T09:00:00.000Z',
      'joinedAt': null,
      'rewardCoins': 0,
    },
  ],
  'leaderboard': [
    {
      'rank': 1,
      'userId': 'u1',
      'name': 'गणेश मोरे',
      'village': 'वडगाव',
      'referralCount': 5,
      'isMe': false,
    },
    {
      'rank': 2,
      'userId': 'u2',
      'name': 'विठू कदम',
      'village': 'कोल्हापूर',
      'referralCount': 3,
      'isMe': false,
    },
    {
      'rank': 3,
      'userId': 'me',
      'name': 'मी',
      'village': 'सातारा',
      'referralCount': 2,
      'isMe': true,
    },
    {
      'rank': 4,
      'userId': 'u4',
      'name': 'सुनीता भोसले',
      'village': 'नगर',
      'referralCount': 1,
      'isMe': false,
    },
  ],
  'myRank': {'rank': 3, 'referralCount': 2},
};

const _inviteJson = {
  'invite': {
    'name': 'किशन कुमार',
    'phone': '+919876543210',
    'status': 'invited',
    'invitedAt': '2026-09-26T08:00:00.000Z',
    'joinedAt': null,
    'rewardCoins': 0,
  },
  'referralCode': 'REFABC123',
  'shareLink': 'https://agrovercity.in/r/REFABC',
  'shareMessage': 'AGROVERCITY मध्ये सामील व्हा!',
  'agriCoinsEarned': 100,
  'stats': {'invited': 3, 'joined': 1, 'totalEarnedCoins': 250},
  'milestones': [
    {'count': 1, 'rewardCoins': 50, 'achieved': true},
    {'count': 5, 'rewardCoins': 200, 'achieved': false},
  ],
};

Future<void> _openInviteDialog(WidgetTester tester) async {
  await tester.tap(find.text('WhatsApp शेअर'));
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
  expect(find.text('मित्राचे नाव व मोबाइल जोडा'), findsOneWidget);
}

// pumpScreen leaves the data-driven widgets mid entrance-animation (their
// timers start when the loaded content mounts), which breaks hit tests and
// leaves pending timers; advance past the stagger before interacting.
Future<void> pumpReferView(WidgetTester tester, Widget view) async {
  await pumpScreen(tester, Scaffold(body: view));
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const urlLauncherChannel = MethodChannel('plugins.flutter.io/url_launcher');
  final messenger = TestDefaultBinaryMessengerBinding
      .instance.defaultBinaryMessenger;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    // Pretend WhatsApp/SMS intents launch successfully.
    messenger.setMockMethodCallHandler(urlLauncherChannel, (call) async => true);
  });

  tearDown(() {
    messenger.setMockMethodCallHandler(urlLauncherChannel, null);
  });

  testWidgets('renders referral code, stats row and leaderboard',
      (tester) async {
    final api = FakeReferralApi()
      ..summary = ReferralSummary.fromJson(_summaryJson);

    await pumpReferView(
      tester,
      ReferEarnView(state: TestAppState(), api: api),
    );

    expect(find.text('REFABC123'), findsOneWidget);
    expect(find.text('एकूण नाणी: 250 🪙'), findsOneWidget);
    expect(find.text('आमंत्रित'), findsWidgets);
    expect(find.text('सामील'), findsWidgets);
    expect(find.text('कमाई'), findsOneWidget);
    // Milestone progress of the next (5-referral) milestone: 1 joined of 5.
    expect(find.text('प्रगती: 1/5'), findsOneWidget);
    // Referred contacts.
    expect(find.text('राम पाटील'), findsOneWidget);
    expect(find.text('शाम जाधव'), findsOneWidget);
    // Leaderboard: medals for the top-3 plus numeric ranks after that.
    expect(find.text('🥇'), findsOneWidget);
    expect(find.text('🥉'), findsOneWidget);
    expect(find.text('#4'), findsOneWidget);
    expect(find.text('तुमचा क्रमांक: #3'), findsOneWidget);
  });

  testWidgets('copying the referral code shows snackbar', (tester) async {
    final api = FakeReferralApi()
      ..summary = ReferralSummary.fromJson(_summaryJson);
    messenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async => null,
    );
    addTearDown(
      () => messenger.setMockMethodCallHandler(SystemChannels.platform, null),
    );

    await pumpReferView(
      tester,
      ReferEarnView(state: TestAppState(), api: api),
    );

    await tester.tap(find.byIcon(Icons.copy_rounded));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.textContaining('कोड कॉपी झाला'), findsOneWidget);
  });

  testWidgets('invite dialog normalizes phone and awards coins',
      (tester) async {
    final api = FakeReferralApi()
      ..summary = ReferralSummary.fromJson(_summaryJson)
      ..inviteResult = InviteResult.fromJson(_inviteJson);

    await pumpReferView(
      tester,
      ReferEarnView(state: TestAppState(), api: api),
    );

    await _openInviteDialog(tester);

    await tester.enterText(find.byType(TextField).at(0), 'किशन कुमार');
    await tester.enterText(find.byType(TextField).at(1), '9876543210');
    await tester.tap(find.text('आमंत्रण पाठवा (+100 नाणी)'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.inviteCalls.single, {
      'name': 'किशन कुमार',
      'phone': '+919876543210',
    });
    expect(find.text('+100 शेती नाणी मिळाली! 🎉'), findsOneWidget);
    // Merged into the list without a refetch.
    expect(api.getCalls, 1);
    expect(find.text('माझे रेफरल्स (3)'), findsOneWidget);
  });

  testWidgets('already invited phone shows conflict snackbar', (tester) async {
    final api = FakeReferralApi()
      ..summary = ReferralSummary.fromJson(_summaryJson)
      ..inviteError = const ApiException(code: 'ALREADY_INVITED');

    await pumpReferView(
      tester,
      ReferEarnView(state: TestAppState(), api: api),
    );

    await _openInviteDialog(tester);

    await tester.enterText(find.byType(TextField).at(0), 'राम पाटील');
    await tester.enterText(find.byType(TextField).at(1), '919876543210');
    await tester.tap(find.text('आमंत्रण पाठवा (+100 नाणी)'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.inviteCalls.single['phone'], '+919876543210');
    expect(find.text('ही संख्या आधीच आमंत्रित आहे'), findsOneWidget);
  });

  testWidgets('invalid phone is rejected before calling the api',
      (tester) async {
    final api = FakeReferralApi()
      ..summary = ReferralSummary.fromJson(_summaryJson);

    await pumpReferView(
      tester,
      ReferEarnView(state: TestAppState(), api: api),
    );

    await _openInviteDialog(tester);

    await tester.enterText(find.byType(TextField).at(0), 'किशन कुमार');
    await tester.enterText(find.byType(TextField).at(1), '12345');
    await tester.tap(find.text('आमंत्रण पाठवा (+100 नाणी)'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(api.inviteCalls, isEmpty);
    expect(find.text('वैध १० अंकी मोबाइल क्रमांक टाका'), findsOneWidget);
  });
}
