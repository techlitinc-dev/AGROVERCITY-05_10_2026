import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/views/marketplace_view.dart';

import 'helpers.dart';

const _product1 = {
  'id': 'prod-1',
  'title': 'Tomato Seeds Hybrid',
  'vernacularTitle': 'हाइब्रिड टमाटर बीज',
  'category': 'Seeds',
  'brand': 'Mahyco',
  'rating': 4.5,
  'reviewsCount': 120,
  'dealerName': 'Shree Agro Center',
  'distanceKm': 2.1,
  'mrp': 450,
  'discountedPrice': 380,
  'bnplAvailable': true,
  'batchNo': 'BATCH-TS-01',
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('category chips filter products', (tester) async {
    final api = FakeMarketplaceApi();
    api.productsResponse = const {
      'data': [_product1],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    };
    final state = TestAppState(marketplaceApi: api);

    await pumpScreen(
      tester,
      Scaffold(body: MarketplaceView(state: state, marketplaceApi: api)),
    );
    expect(api.lastCategory, isNull);

    await tester.tap(find.text('Fertilizers'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.lastCategory, 'Fertilizer');

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('certificate dialog shows verified badge', (tester) async {
    final api = FakeMarketplaceApi();
    api.productsResponse = const {
      'data': [_product1],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    };
    api.certificateResponse = const {
      'batchNo': 'BATCH-TS-01',
      'certifier': 'AGMARK / Ministry of Agriculture',
      'certificateNo': 'AGM-2026-0001',
      'valid': true,
      'verifiedAt': '2026-09-15T10:00:00Z',
    };
    final state = TestAppState(marketplaceApi: api);

    await pumpScreen(
      tester,
      Scaffold(body: MarketplaceView(state: state, marketplaceApi: api)),
    );

    await tester.tap(find.text('🌾'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.textContaining('AGMARK'), findsOneWidget);
    expect(find.text('Verified'), findsOneWidget);
    expect(find.textContaining('Add to Cart'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('cart bar shows total', (tester) async {
    final api = FakeMarketplaceApi();
    api.productsResponse = const {
      'data': [_product1],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    };
    api.cartResponse = const {
      'data': [
        {'productId': 'prod-1', 'quantity': 2, 'product': _product1},
      ],
      'cartTotal': 1230,
    };
    final state = TestAppState(marketplaceApi: api);

    await pumpScreen(
      tester,
      Scaffold(body: MarketplaceView(state: state, marketplaceApi: api)),
    );

    expect(find.textContaining('₹1,230'), findsOneWidget);
    expect(find.text('Cart: 2 items'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
  });
}
