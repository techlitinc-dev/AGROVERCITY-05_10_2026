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
    final state = TestAppState(marketplaceApi: api, initialLanguage: 'en');

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
    final state = TestAppState(marketplaceApi: api, initialLanguage: 'en');

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
    final state = TestAppState(marketplaceApi: api, initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: MarketplaceView(state: state, marketplaceApi: api)),
    );

    expect(find.textContaining('₹1,230'), findsOneWidget);
    expect(find.text('Cart: 2 items'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('review form posts and refreshes aggregate', (tester) async {
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
    final state = TestAppState(marketplaceApi: api, initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: MarketplaceView(state: state, marketplaceApi: api)),
    );

    await tester.tap(find.text('🌾'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    final star = find.byIcon(Icons.star_outline_rounded).last;
    await tester.ensureVisible(star);
    await tester.pump();
    await tester.tap(star);
    await tester.pump();

    api.productResponse = const {
      ..._product1,
      'ratingAvg': 4.5,
      'ratingCount': 2,
    };

    final submit = find.text('भेजें');
    await tester.ensureVisible(submit);
    await tester.pump();
    await tester.tap(submit);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.postReviewCalls, hasLength(1));
    expect(api.postReviewCalls.first['productId'], 'prod-1');
    expect(api.postReviewCalls.first['rating'], 5);
    expect(find.text('समीक्षा दर्ज हुई'), findsOneWidget);
    expect(find.textContaining('2 समीक्षाएं'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('reviews list renders in certificate dialog', (tester) async {
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
    api.reviewsResponse = const {
      'data': [
        {
          'id': 'rev-1',
          'productId': 'prod-1',
          'userId': 'u1',
          'userName': 'रमेश पाटील',
          'rating': 5,
          'comment': 'उगवण खूप चांगली झाली',
          'createdAt': '2026-09-10T10:00:00.000Z',
          'updatedAt': '2026-09-10T10:00:00.000Z',
        },
        {
          'id': 'rev-2',
          'productId': 'prod-1',
          'userId': 'u2',
          'userName': 'सुनीता देशमुख',
          'rating': 4,
          'comment': 'किंमत थोडी जास्त पण दर्जा चांगला',
          'createdAt': '2026-09-08T10:00:00.000Z',
          'updatedAt': '2026-09-08T10:00:00.000Z',
        },
      ],
      'page': 1,
      'pageSize': 20,
      'total': 2,
    };
    final state = TestAppState(marketplaceApi: api, initialLanguage: 'en');

    await pumpScreen(
      tester,
      Scaffold(body: MarketplaceView(state: state, marketplaceApi: api)),
    );

    await tester.tap(find.text('🌾'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    final comment1 = find.text('उगवण खूप चांगली झाली');
    await tester.ensureVisible(comment1);
    await tester.pump();
    expect(comment1, findsOneWidget);
    expect(find.text('किंमत थोडी जास्त पण दर्जा चांगला'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
  });
}
