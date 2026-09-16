import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/views/fpo_engine_view.dart';

import 'helpers.dart';
import 'equipment_fakes.dart';

const _pool = {
  'id': 'pool-1',
  'item': 'Nano Urea (500 ml)',
  'bookedUnits': 380,
  'targetUnits': 500,
  'discountPercent': 18,
  'deadline': '2026-09-26',
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('fpo banner shows name and members', (tester) async {
    final api = FakeFpoApi();

    await pumpScreen(
      tester,
      Scaffold(body: FpoEngineView(state: TestAppState(), fpoApi: api)),
    );

    expect(find.text('Sahyadri Shetkari FPO'), findsOneWidget);
    expect(find.textContaining('214'), findsOneWidget);
    expect(find.textContaining('Nashik'), findsOneWidget);
  });

  testWidgets('pool progress bar and join dialog', (tester) async {
    final api = FakeFpoApi();
    api.poolsResponse = const {'data': [_pool]};

    await pumpScreen(
      tester,
      Scaffold(body: FpoEngineView(state: TestAppState(), fpoApi: api)),
    );

    expect(find.textContaining('380/500'), findsOneWidget);
    final progress = tester.widget<LinearProgressIndicator>(
      find.byType(LinearProgressIndicator),
    );
    expect(progress.value, closeTo(0.76, 0.001));

    await tester.tap(find.text('ग्रुप पूल में यूनिट जोड़ें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    for (var i = 0; i < 4; i++) {
      await tester.tap(find.byKey(const Key('join-units-plus')));
      await tester.pump();
    }
    expect(find.text('5 यूनिट'), findsOneWidget);

    await tester.tap(find.text('पुष्टि करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.joinCalls.length, 1);
    expect(api.joinCalls.first['id'], 'pool-1');
    expect(api.joinCalls.first['units'], 5);
    expect(find.textContaining('385/500'), findsOneWidget);
  });
}
