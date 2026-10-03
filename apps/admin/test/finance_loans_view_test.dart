import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu_admin/api/api_exception.dart';
import 'package:kisan_setu_admin/views/finance_loans_view.dart';

import 'helpers.dart';

void main() {
  final loan = <String, dynamic>{
    'applicationId': 'ln1',
    'applicationNumber': 'LN-2026-0007',
    'farmerName': 'राम पाटिल',
    'farmerPhone': '+919812345678',
    'amount': 30000,
    'tenureMonths': 6,
    'purpose': 'बीज खरीद',
    'status': 'submitted',
    'createdAt': '2026-09-20T00:00:00+00:00',
    'timeline': const [
      {
        'status': 'submitted',
        'statusText': 'ऋण आवेदन जमा हुआ',
        'at': '2026-09-20',
        'note': '',
      },
    ],
  };

  testWidgets('loans table renders application numbers', (tester) async {
    final api = FakeAdminApi()..financeLoansResponse = envelope([loan]);
    await pumpAdminScreen(tester, const FinanceLoansView(), api);
    expect(find.text('LN-2026-0007'), findsOneWidget);
    expect(find.text('राम पाटिल'), findsOneWidget);
    expect(find.text('₹30000'), findsOneWidget);
  });

  testWidgets('advance calls updateFinanceLoanStatus with note',
      (tester) async {
    final api = FakeAdminApi()..financeLoansResponse = envelope([loan]);
    await pumpAdminScreen(tester, const FinanceLoansView(), api);
    await tester.dragUntilVisible(
      find.text('विवरण'),
      find.byType(SingleChildScrollView).last,
      const Offset(-100, 0),
    );
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('विवरण'));
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('टिप्पणी'), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextField, 'टिप्पणी'),
      'जांच पूर्ण',
    );
    await tester.tap(find.text('आगे बढ़ाएं'));
    await tester.pump(const Duration(milliseconds: 500));

    expect(api.updateFinanceLoanStatusCalls, hasLength(1));
    expect(api.updateFinanceLoanStatusCalls.single['applicationId'], 'ln1');
    expect(api.updateFinanceLoanStatusCalls.single['status'], 'underReview');
    expect(api.updateFinanceLoanStatusCalls.single['note'], 'जांच पूर्ण');
  });

  testWidgets('409 error surfaces snackbar with error code', (tester) async {
    final api = FakeAdminApi()
      ..financeLoansResponse = envelope([loan])
      ..updateFinanceLoanStatusError =
          ApiException(code: 'LOAN_INVALID_TRANSITION');
    await pumpAdminScreen(tester, const FinanceLoansView(), api);
    await tester.dragUntilVisible(
      find.text('विवरण'),
      find.byType(SingleChildScrollView).last,
      const Offset(-100, 0),
    );
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('विवरण'));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text('आगे बढ़ाएं'));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.textContaining('LOAN_INVALID_TRANSITION'), findsOneWidget);
  });
}
