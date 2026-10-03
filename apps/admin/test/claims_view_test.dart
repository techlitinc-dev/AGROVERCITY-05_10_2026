import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu_admin/views/claims_view.dart';

import 'helpers.dart';

void main() {
  final claim = <String, dynamic>{
    'id': 'clm1',
    'userId': 'u1',
    'claimNumber': 'CLM-2026-MH-0001',
    'cropName': 'गेहूं',
    'village': 'शिवगांव',
    'status': 'dbtApproved',
    'requestedAmount': 25000,
    'timeline': const [
      {'status': 'intimated', 'at': '2026-09-10', 'note': ''},
    ],
  };

  testWidgets('claims table renders claim numbers', (tester) async {
    final api = FakeAdminApi()..claimsResponse = envelope([claim]);
    await pumpAdminScreen(tester, const ClaimsView(), api);
    expect(find.text('CLM-2026-MH-0001'), findsOneWidget);
  });

  testWidgets('disbursed requires amount fields', (tester) async {
    final api = FakeAdminApi()..claimsResponse = envelope([claim]);
    await pumpAdminScreen(tester, const ClaimsView(), api);
    await tester.tap(find.text('विवरण'));
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('स्वीकृत राशि'), findsOneWidget);
    expect(find.text('DBT लेनदेन आईडी'), findsOneWidget);

    await tester.tap(find.text('नई स्थिति'));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text('सर्वेयर नियुक्त').last);
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('स्वीकृत राशि'), findsNothing);
    expect(find.text('DBT लेनदेन आईडी'), findsNothing);

    await tester.tap(find.text('नई स्थिति'));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text('वितरित').last);
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('स्वीकृत राशि'), findsOneWidget);
    expect(find.byType(AlertDialog), findsOneWidget);
  });
}
