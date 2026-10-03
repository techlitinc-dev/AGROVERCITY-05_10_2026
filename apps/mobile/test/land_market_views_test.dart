import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/models/land_market_models.dart';
import 'package:kisan_setu/models/land_models.dart';
import 'package:kisan_setu/views/land_legal_view.dart';
import 'package:kisan_setu/views/landlord/lease_manage_view.dart';
import 'package:kisan_setu/views/landlord/lease_requests_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';
import 'land_fakes.dart';

LandListing _listing({String id = 'lst1', String village = 'निफाड'}) =>
    LandListing(
      id: id,
      village: village,
      district: 'नाशिक',
      lat: 20.1,
      lng: 74.2,
      areaAcres: 2.0,
      expectedRentRupees: 8000,
      soilType: 'काली मिट्टी',
      waterSource: 'बोरवेल',
      landlordId: 'u-landlord',
      landlordName: 'दत्ता राव',
      status: 'open',
      createdAt: '2026-09-10',
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('rent browse tab shows listings with rent', (tester) async {
    final api = FakeLandMarketApi()
      ..listingsResponse = [
        _listing(id: 'lst1', village: 'निफाड'),
        _listing(id: 'lst2', village: 'देवळाली'),
      ];

    await pumpScreen(
        tester,
        Scaffold(
            body: LandLegalView(
                state: TestAppState(), landMarketApi: api)));

    await tester.tap(find.text('किराए की ज़मीन'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('निफाड, नाशिक'), findsOneWidget);
    expect(find.text('देवळाली, नाशिक'), findsOneWidget);
    expect(find.text('₹8,000/माह'), findsNWidgets(2));
  });

  testWidgets('request lease sends request and confirms', (tester) async {
    final api = FakeLandMarketApi()..listingsResponse = [_listing()];

    await pumpScreen(
        tester,
        Scaffold(
            body: LandLegalView(
                state: TestAppState(), landMarketApi: api)));

    await tester.tap(find.text('किराए की ज़मीन'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.text('पट्टा अनुरोध करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.text('अनुरोध भेजें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.requestLeaseCalls.length, 1);
    expect(api.requestLeaseCalls.first['listingId'], 'lst1');
    expect(api.requestLeaseCalls.first['durationMonths'], 12);
    expect(find.text('अनुरोध भेजा गया'), findsOneWidget);
  });

  testWidgets('inbox accept confirms and calls acceptRequest', (tester) async {
    final api = FakeLandMarketApi()
      ..requestsResponse = [
        const LeaseRequest(
          id: 'req1',
          listingId: 'lst1',
          message: 'गेहूं की खेती के लिए चाहिए',
          durationMonths: 12,
          farmerId: 'u-farmer',
          farmerName: 'संजय शिंदे',
          farmerPhone: '9876543210',
          landlordId: 'u-landlord',
          status: 'pending',
          createdAt: '2026-09-12',
        ),
      ];
    final listing = _listing();

    await pumpScreen(
      tester,
      LeaseRequestsView(
        state: TestAppState(),
        landMarketApi: api,
        listing: listing,
      ),
    );

    expect(find.text('संजय शिंदे'), findsOneWidget);

    await tester.tap(find.text('स्वीकारें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('पट्टा बनाया जाएगा'), findsOneWidget);

    await tester.tap(find.text('पुष्टि करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.acceptCalls, ['req1']);
  });

  testWidgets('lease overflow menu offers agreement PDF', (tester) async {
    final land = FakeLandApi()
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
          verified: false,
        ),
      ];
    final market = FakeLandMarketApi();

    await pumpScreen(
      tester,
      LeaseManageView(
        state: TestAppState(),
        landApi: land,
        landMarketApi: market,
      ),
    );

    await tester.tap(find.byIcon(Icons.more_vert));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('अनुबंध PDF'), findsOneWidget);
    expect(find.text('पट्टा समाप्त करें'), findsOneWidget);
  });
}
