import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/views/buyers_view.dart';

import 'helpers.dart';

const _contract1 = {
  'id': 'contract-1',
  'buyerCompany': 'ITC Agri Business (e-Choupal)',
  'buyerRating': 4.9,
  'crop': 'Wheat - Sharbati (शरबती गेहूं)',
  'lockedRateQuintal': 2650,
  'mspCurrentRate': 2425,
  'premiumAboveMSP': 225,
  'minQuantityQuintals': 30,
  'deliveryLocation': 'ITC Choupal Sagar, Niphad Hub',
  'paymentTerms': '100% Instant Bank DBT within 24 hours of weighing',
  'status': 'open',
  'contractDuration': 'Pre-Harvest Lock (Delivery: Oct 2026)',
};

const _contract2 = {
  'id': 'contract-2',
  'buyerCompany': 'Reliance Fresh / JioKrishi Retail',
  'buyerRating': 4.8,
  'crop': 'Tomato - Grade A (टमाटर)',
  'lockedRateQuintal': 2300,
  'mspCurrentRate': 1800,
  'premiumAboveMSP': 500,
  'minQuantityQuintals': 50,
  'deliveryLocation': 'Reliance Fresh Collection Center, Pimpalgaon',
  'paymentTerms': 'Daily digital settlement via UPI/NEFT',
  'status': 'open',
  'contractDuration': 'Weekly Harvest Supply',
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('contract cards render from API', (tester) async {
    final contracts = FakeContractsApi();
    contracts.contractsResponse = const {
      'data': [_contract1, _contract2],
      'page': 1,
      'pageSize': 20,
      'total': 2,
    };

    await pumpScreen(
      tester,
      Scaffold(body: BuyersView(state: TestAppState(), contractsApi: contracts)),
    );

    expect(find.text('ITC Agri Business (e-Choupal)'), findsOneWidget);
    expect(find.text('Reliance Fresh / JioKrishi Retail'), findsOneWidget);
    expect(find.textContaining('/quintal'), findsNWidgets(2));
  });

  testWidgets('e-sign wrong mpin shows error', (tester) async {
    final contracts = FakeContractsApi();
    contracts.contractsResponse = const {
      'data': [_contract1],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    };
    contracts.acceptError = const ApiException(code: 'WRONG_MPIN', statusCode: 401);

    await pumpScreen(
      tester,
      Scaffold(body: BuyersView(state: TestAppState(), contractsApi: contracts)),
    );

    await tester.tap(find.text('भाव लॉक करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.byType(CheckboxListTile));
    await tester.pump();
    await tester.enterText(find.byType(TextField), '0000');
    await tester.pump();

    await tester.tap(find.text('हस्ताक्षर जमा करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('गलत MPIN'), findsOneWidget);
    expect(contracts.lastAcceptedId, 'contract-1');

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('fare estimate updates on slider', (tester) async {
    final transport = FakeTransportApi();
    final mandi = FakeMandiApi();

    await pumpScreen(
      tester,
      Scaffold(
        body: BuyersView(
          state: TestAppState(),
          contractsApi: FakeContractsApi(),
          transportApi: transport,
          mandiApi: mandi,
        ),
      ),
    );

    await tester.tap(find.text('🚚 कृषि वाहन बुकिंग (Logistics)'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    await tester.drag(find.byType(Slider), const Offset(80, 0));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('₹1,200'), findsOneWidget);
  });
}
