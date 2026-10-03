import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/settlements_api.dart';
import 'package:kisan_setu/models/settlement.dart';
import 'package:kisan_setu/views/settlements_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeSettlementsApi extends SettlementsApi {
  List<Settlement> settlements = [];
  Object? error;

  @override
  Future<List<Settlement>> listMySettlements() async {
    final e = error;
    if (e != null) throw e;
    return settlements;
  }
}

Settlement _settlement({
  String id = 's1',
  String status = 'pending',
  int gross = 2000,
  int commission = 200,
  int net = 1800,
}) =>
    Settlement(
      id: id,
      role: 'transport',
      entityId: 'veh1',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-07',
      grossRupees: gross,
      commissionRupees: commission,
      netRupees: net,
      status: status,
      createdAt: '2026-09-08',
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('renders settlement row with gross/commission/net',
      (tester) async {
    final api = FakeSettlementsApi()..settlements = [_settlement()];

    await pumpScreen(
        tester, SettlementsView(state: TestAppState(), settlementsApi: api));

    expect(find.text('2026-09-01 – 2026-09-07'), findsOneWidget);
    expect(find.textContaining('₹2,000'), findsOneWidget);
    expect(find.textContaining('कमीशन ₹200'), findsOneWidget);
    expect(find.text('शुद्ध ₹1,800'), findsOneWidget);
  });

  testWidgets('shows status chip for pending settlement', (tester) async {
    final api = FakeSettlementsApi()
      ..settlements = [_settlement(status: 'pending')];

    await pumpScreen(
        tester, SettlementsView(state: TestAppState(), settlementsApi: api));

    expect(find.text('लंबित'), findsOneWidget);
  });

  testWidgets('shows empty state when no settlements', (tester) async {
    final api = FakeSettlementsApi();

    await pumpScreen(
        tester, SettlementsView(state: TestAppState(), settlementsApi: api));

    expect(find.text('अभी कोई निपटान नहीं'), findsOneWidget);
  });
}
