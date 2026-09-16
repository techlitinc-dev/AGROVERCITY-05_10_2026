import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/views/checkout_sheet.dart';
import 'package:kisan_setu/views/order_tracking_view.dart';

import 'helpers.dart';

Map<String, dynamic> _order(String id, String status,
        {String refundStatus = 'none'}) =>
    {
      'id': id,
      'userId': 'u1',
      'items': [
        {'productId': 'prod-1', 'quantity': 2},
      ],
      'paymentMethod': 'cod',
      'deliveryAddress': 'शिवडी, नासिक',
      'total': 760,
      'status': status,
      'refundStatus': refundStatus,
      'createdAt': '2026-09-15T10:00:00Z',
    };

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('order tracking lists orders with status chips', (tester) async {
    final api = FakeOrdersApi();
    api.ordersResponse = {
      'data': [_order('ord_1', 'placed'), _order('ord_2', 'paid')],
      'page': 1,
      'pageSize': 20,
      'total': 2,
    };

    await pumpScreen(
      tester,
      Scaffold(body: OrderTrackingView(state: TestAppState(), ordersApi: api)),
    );

    expect(find.text('#ord_1'), findsOneWidget);
    expect(find.text('#ord_2'), findsOneWidget);
    expect(find.text('Placed'), findsOneWidget);
    expect(find.text('Paid'), findsOneWidget);
  });

  testWidgets('idempotency key stable per checkout', (tester) async {
    final marketplace = FakeMarketplaceApi();
    marketplace.cartResponse = const {
      'data': [
        {
          'productId': 'prod-1',
          'quantity': 2,
          'product': {'discountedPrice': 615},
        },
      ],
      'cartTotal': 1230,
    };
    final orders = FakeOrdersApi();
    final state = TestAppState(marketplaceApi: marketplace);
    await state.refreshCart();

    await openCheckoutSheet(
      tester,
      state,
      buildSheet: () => CheckoutSheet(state: state, ordersApi: orders),
    );

    await tester.tap(find.textContaining('Pay ₹'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.textContaining('Pay ₹'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(orders.placeOrderCalls.length, 2);
    expect(orders.idempotencyKeys[0], orders.idempotencyKeys[1]);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('cancel button hidden for shipped order', (tester) async {
    final api = FakeOrdersApi();
    api.ordersResponse = {
      'data': [_order('ord_3', 'shipped')],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    };

    await pumpScreen(
      tester,
      Scaffold(body: OrderTrackingView(state: TestAppState(), ordersApi: api)),
    );

    await tester.tap(find.text('#ord_3'));
    await tester.pump();

    expect(find.text('ऑर्डर रद्द करें'), findsNothing);
  });

  testWidgets('cancel button visible for placed, confirm calls api',
      (tester) async {
    final api = FakeOrdersApi();
    api.ordersResponse = {
      'data': [_order('ord_1', 'placed')],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    };

    await pumpScreen(
      tester,
      Scaffold(body: OrderTrackingView(state: TestAppState(), ordersApi: api)),
    );

    await tester.tap(find.text('#ord_1'));
    await tester.pump();

    expect(find.text('ऑर्डर रद्द करें'), findsOneWidget);

    await tester.tap(find.text('ऑर्डर रद्द करें'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    await tester.tap(find.widgetWithText(ElevatedButton, 'ऑर्डर रद्द करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.cancelledIds, ['ord_1']);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('refund chip renders requested/processed states', (tester) async {
    final api = FakeOrdersApi();
    api.ordersResponse = {
      'data': [
        _order('ord_1', 'cancelled', refundStatus: 'requested'),
        _order('ord_2', 'cancelled', refundStatus: 'processed'),
      ],
      'page': 1,
      'pageSize': 20,
      'total': 2,
    };

    await pumpScreen(
      tester,
      Scaffold(body: OrderTrackingView(state: TestAppState(), ordersApi: api)),
    );

    expect(find.text('रिफंड प्रक्रिया में'), findsOneWidget);
    expect(find.text('रिफंड हो गया'), findsOneWidget);
  });
}
