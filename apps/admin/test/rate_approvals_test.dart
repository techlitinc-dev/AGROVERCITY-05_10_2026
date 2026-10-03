import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu_admin/views/rate_approvals_view.dart';

import 'helpers.dart';

void main() {
  final List<Map<String, dynamic>> twoRates = [
    {
      'id': 'r1',
      'sellerId': 'vyapari-1',
      'crop': 'गेहूं',
      'rate': 2400,
      'mandiName': 'नासिक मंडी',
      'status': 'pending',
      'createdAt': '2026-09-17',
    },
    {
      'id': 'r2',
      'sellerId': 'vyapari-2',
      'crop': 'प्याज़',
      'rate': 1800,
      'mandiName': 'लासलगांव',
      'status': 'pending',
      'createdAt': '2026-09-17',
    },
  ];

  testWidgets('pending rates table renders and approve removes row',
      (tester) async {
    final api = FakeAdminApi()..pendingRatesResponse = envelope(twoRates);
    await pumpAdminScreen(tester, const RateApprovalsView(), api);
    expect(find.text('गेहूं'), findsOneWidget);
    expect(find.text('प्याज़'), findsOneWidget);
    await tester.tap(find.text('स्वीकृत').first);
    await tester.pump(const Duration(milliseconds: 500));
    expect(api.approveRateCalls, ['r1']);
    expect(find.text('गेहूं'), findsNothing);
    expect(find.text('प्याज़'), findsOneWidget);
  });

  testWidgets('empty state', (tester) async {
    final api = FakeAdminApi()
      ..pendingRatesResponse = envelope(const []);
    await pumpAdminScreen(tester, const RateApprovalsView(), api);
    expect(find.text('कोई लंबित दर नहीं'), findsOneWidget);
  });
}
