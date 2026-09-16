import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/views/checkout_sheet.dart';
import 'package:kisan_setu/views/common/address_book_view.dart';

import 'helpers.dart';

const _addr1 = {
  'id': 'addr_1',
  'userId': 'u1',
  'label': 'घर',
  'line1': 'प्लॉट 12',
  'village': 'शिवडी',
  'district': 'नासिक',
  'state': 'महाराष्ट्र',
  'pincode': '422001',
  'isDefault': true,
  'createdAt': '2026-09-01T08:00:00Z',
};

const _addr2 = {
  'id': 'addr_2',
  'userId': 'u1',
  'label': 'खेत',
  'line1': 'सर्वे 45',
  'village': 'पिंपळगांव',
  'district': 'नासिक',
  'state': 'महाराष्ट्र',
  'pincode': '422209',
  'isDefault': false,
  'createdAt': '2026-09-05T08:00:00Z',
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('address list renders with default first', (tester) async {
    final api = FakeAddressesApi();
    api.addressesResponse = const {
      'data': [_addr1, _addr2],
    };

    await pumpScreen(
      tester,
      AddressBookView(state: TestAppState(), addressesApi: api),
    );

    expect(find.text('घर'), findsOneWidget);
    expect(find.text('खेत'), findsOneWidget);
    expect(find.textContaining('डिफ़ॉल्ट'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('घर')).dy,
      lessThan(tester.getTopLeft(find.text('खेत')).dy),
    );
  });

  testWidgets('add form validates 6-digit pincode', (tester) async {
    final api = FakeAddressesApi();
    api.addressesResponse = const {'data': [_addr1]};

    await pumpScreen(
      tester,
      AddressBookView(state: TestAppState(), addressesApi: api),
    );

    await tester.tap(find.text('पता जोड़ें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.enterText(
      find.widgetWithText(TextField, 'पिनकोड (6 अंक)'),
      '123',
    );
    await tester.tap(find.text('पता सहेजें'));
    await tester.pump();

    expect(find.text('पिनकोड ठीक 6 अंकों का होना चाहिए'), findsOneWidget);
    expect(api.lastCreateFields, isNull);
  });

  testWidgets('checkout picker selection fills address card and sends addressId',
      (tester) async {
    final addresses = FakeAddressesApi();
    addresses.addressesResponse = const {
      'data': [_addr1, _addr2],
    };
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
      buildSheet: () => CheckoutSheet(
        state: state,
        ordersApi: orders,
        addressesApi: addresses,
      ),
    );

    // Default address preselected.
    expect(find.textContaining('घर:'), findsOneWidget);

    // Open the picker and select the second address.
    await tester.tap(find.textContaining('घर:'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.text('खेत — सर्वे 45'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.textContaining('खेत:'), findsOneWidget);

    await tester.tap(find.textContaining('Pay ₹'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(orders.lastAddressId, 'addr_2');

    await tester.pump(const Duration(seconds: 5));
  });
}
