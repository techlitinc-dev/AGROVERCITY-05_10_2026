import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/models/land_models.dart';
import 'package:kisan_setu/views/landlord/lease_manage_view.dart';
import 'package:kisan_setu/views/landlord/plot_manage_view.dart';
import 'package:kisan_setu/views/landlord/rent_tracking_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';
import 'land_fakes.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('plot manage renders plots with status chips', (tester) async {
    final api = FakeLandApi()
      ..plotsResponse = [
        const LandPlot(
          id: 'p1',
          name: 'खेत एक',
          village: 'निफाड',
          district: 'नाशिक',
          areaAcres: 2.5,
          status: 'leased',
        ),
        const LandPlot(
          id: 'p2',
          name: 'खेत दो',
          village: 'देवळाली',
          district: 'नाशिक',
          areaAcres: 1.0,
          status: 'vacant',
        ),
      ];

    await pumpScreen(
        tester, PlotManageView(state: TestAppState(), landApi: api));

    expect(find.text('खेत एक'), findsOneWidget);
    expect(find.text('खेत दो'), findsOneWidget);
    expect(find.text('पट्टे पर'), findsOneWidget);
    expect(find.text('खाली'), findsOneWidget);
  });

  testWidgets('rent tracking shows total collected and pending months',
      (tester) async {
    const lease = LandLease(
      id: 'l1',
      plotId: 'p1',
      tenantName: 'रमेश पाटिल',
      tenantPhone: '9876543210',
      monthlyRentRupees: 8000,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: 'active',
      verified: false,
    );
    final api = FakeLandApi()
      ..paymentsResponse = const LeasePayments(
        payments: [
          RentPayment(
            id: 'pay1',
            leaseId: 'l1',
            amountRupees: 8000,
            month: '2026-07',
            method: 'cash',
            paidAt: '2026-07-05',
          ),
        ],
        totalCollectedRupees: 16000,
        pendingMonths: ['2026-08'],
      );

    await pumpScreen(
      tester,
      RentTrackingView(state: TestAppState(), landApi: api, lease: lease),
    );

    expect(find.text('रमेश पाटिल — किराया'), findsOneWidget);
    expect(find.textContaining('कुल संग्रह'), findsOneWidget);
    expect(find.textContaining('16,000'), findsOneWidget);
    expect(find.text('लंबित महीने'), findsOneWidget);
    expect(find.text('2026-08'), findsOneWidget);
    expect(find.text('2026-07'), findsOneWidget);
  });

  testWidgets('lease manage shows filter chips and lease cards',
      (tester) async {
    final api = FakeLandApi()
      ..plotsResponse = [
        const LandPlot(
          id: 'p1',
          name: 'खेत एक',
          village: 'निफाड',
          district: 'नाशिक',
          areaAcres: 2.5,
          status: 'leased',
        ),
      ]
      ..leasesResponse = [
        const LandLease(
          id: 'l1',
          plotId: 'p1',
          tenantName: 'रमेश पाटिल',
          tenantPhone: '9876543210',
          monthlyRentRupees: 8000,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          status: 'active',
          verified: true,
        ),
      ];

    await pumpScreen(
        tester, LeaseManageView(state: TestAppState(), landApi: api));

    expect(find.text('सक्रिय'), findsOneWidget);
    expect(find.text('समाप्त'), findsOneWidget);
    expect(find.text('रमेश पाटिल'), findsOneWidget);
    expect(find.text('सत्यापित'), findsOneWidget);
    expect(find.textContaining('खेत एक'), findsWidgets);
  });
}
