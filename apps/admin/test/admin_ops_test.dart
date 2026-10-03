import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu_admin/views/broadcast_view.dart';
import 'package:kisan_setu_admin/views/kyc_queue_view.dart';
import 'package:kisan_setu_admin/views/reports_view.dart';
import 'package:kisan_setu_admin/views/settlements_view.dart';

import 'helpers.dart';

void main() {
  testWidgets('kyc queue renders and verify removes row', (tester) async {
    final api = FakeAdminApi()
      ..kycResponse = envelope(const [
        {
          'entityId': 'veh1',
          'entityKind': 'vehicle',
          'ownerId': 'u9',
          'ownerName': 'राम पाटिल',
          'docs': [
            {'docType': 'RC', 'url': 'https://example.com/rc.jpg'},
          ],
        },
      ]);
    await pumpAdminScreen(tester, const KycQueueView(), api);
    expect(find.text('राम पाटिल'), findsOneWidget);
    await tester.tap(find.text('सत्यापित करें'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(api.verifyKycCalls, ['veh1']);
    expect(find.text('कोई लंबित KYC नहीं'), findsOneWidget);
  });

  testWidgets('broadcast dry run shows count', (tester) async {
    final api = FakeAdminApi()
      ..broadcastDryRunResponse = const {'targetedCount': 42};
    await pumpAdminScreen(tester, const BroadcastView(), api);
    await tester.tap(find.text('गिनती देखें'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('लक्षित: 42'), findsOneWidget);
    expect(api.broadcastCalls.single['dryRun'], true);
  });

  testWidgets('settlements mark paid flow', (tester) async {
    final api = FakeAdminApi()
      ..settlementsResponse = envelope(const [
        {
          'id': 'st1',
          'role': 'transport',
          'periodStart': '2026-09-01',
          'periodEnd': '2026-09-15',
          'grossRupees': 10000,
          'commissionRupees': 500,
          'netRupees': 9500,
          'status': 'approved',
        },
      ]);
    await pumpAdminScreen(tester, const SettlementsView(), api);
    await tester.tap(find.widgetWithText(ChoiceChip, 'स्वीकृत'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('भुगतान चिह्नित करें'), findsOneWidget);
    await tester.tap(find.text('भुगतान चिह्नित करें'));
    await tester.pump(const Duration(milliseconds: 500));
    expect(api.settleActionCalls.single,
        {'id': 'st1', 'action': 'mark_paid'});
  });

  testWidgets('reports block action', (tester) async {
    final api = FakeAdminApi()
      ..reportsResponse = envelope(const [
        {
          'id': 'rep1',
          'reporterId': 'u1',
          'reportedId': 'u2',
          'reason': 'गाली-गलौज',
          'status': 'open',
          'createdAt': '2026-09-16',
        },
      ]);
    await pumpAdminScreen(tester, const ReportsView(), api);
    expect(find.text('गाली-गलौज'), findsOneWidget);
    await tester.tap(find.text('ब्लॉक करें'));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.tap(find.text('ब्लॉक करें').last);
    await tester.pump(const Duration(milliseconds: 500));
    expect(api.resolveReportCalls.single['id'], 'rep1');
    expect(api.resolveReportCalls.single['action'], 'block');
    expect(find.text('कोई खुली रिपोर्ट नहीं'), findsOneWidget);
  });
}
