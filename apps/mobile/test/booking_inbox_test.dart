import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/views/transporter/booking_inbox_view.dart';

import 'helpers.dart';

const _request1 = {
  'id': 'bk-1',
  'vehicleType': 'Tata Ace',
  'vehicleNo': null,
  'pickup': 'पिंपलगाव',
  'drop': 'नासिक APMC',
  'distanceKm': 20,
  'date': '2026-09-17',
  'fare': 1200,
  'status': 'requested',
  'lot': {'crop': 'प्याज', 'quantityQuintals': 10, 'expectedRate': 2100},
};

const _request2 = {
  'id': 'bk-2',
  'vehicleType': 'Bolero Maxi',
  'vehicleNo': null,
  'pickup': 'निफाड',
  'drop': 'मुंबई वाशी',
  'distanceKm': 180,
  'date': '2026-09-18',
  'fare': 8900,
  'status': 'requested',
  'lot': null,
};

const _verifiedVehicle = {
  'id': 'veh-1',
  'vehicleType': 'Tata Ace',
  'registrationNo': 'MH-15-AB-1234',
  'capacityTonnes': 0.75,
  'docStatus': 'verified',
  'active': true,
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('incoming requests render with route and fare', (tester) async {
    final api = FakeTransportApi();
    api.bookingsResponse = const {
      'data': [_request1, _request2],
      'page': 1,
      'pageSize': 20,
      'total': 2,
    };

    await pumpScreen(
      tester,
      Scaffold(body: BookingInboxView(state: TestAppState(), transportApi: api)),
    );

    expect(find.text('पिंपलगाव ➔ नासिक APMC'), findsOneWidget);
    expect(find.text('निफाड ➔ मुंबई वाशी'), findsOneWidget);
    expect(find.text('₹1,200'), findsOneWidget);
    expect(find.text('₹8,900'), findsOneWidget);
    expect(find.textContaining('प्याज — 10 क्विंटल'), findsOneWidget);
  });

  testWidgets('accept records vehicleId', (tester) async {
    final api = FakeTransportApi();
    api.bookingsResponse = const {
      'data': [_request1],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    };
    api.myVehiclesResponse = const {
      'data': [_verifiedVehicle],
    };

    await pumpScreen(
      tester,
      Scaffold(body: BookingInboxView(state: TestAppState(), transportApi: api)),
    );

    await tester.tap(find.widgetWithText(ElevatedButton, 'स्वीकारें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.lastVerifiedOnly, isTrue);

    await tester.tap(find.descendant(
      of: find.byType(BottomSheet),
      matching: find.widgetWithText(ElevatedButton, 'स्वीकारें'),
    ));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.acceptBookingCalls.length, 1);
    expect(api.acceptBookingCalls.first['id'], 'bk-1');
    expect(api.acceptBookingCalls.first['vehicleId'], 'veh-1');
    expect(api.acceptBookingCalls.first['vehicleNo'], 'MH-15-AB-1234');
  });

  testWidgets('reject requires reason', (tester) async {
    final api = FakeTransportApi();
    api.bookingsResponse = const {
      'data': [_request1],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    };

    await pumpScreen(
      tester,
      Scaffold(body: BookingInboxView(state: TestAppState(), transportApi: api)),
    );

    await tester.tap(find.text('अस्वीकारें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.widgetWithText(ElevatedButton, 'अस्वीकारें'));
    await tester.pump();
    expect(find.text('कम से कम 3 अक्षर लिखें'), findsOneWidget);
    expect(api.rejectBookingCalls, isEmpty);

    await tester.tap(find.text('दूरी ज़्यादा'));
    await tester.pump();
    await tester.tap(find.widgetWithText(ElevatedButton, 'अस्वीकारें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.rejectBookingCalls.length, 1);
    expect(api.rejectBookingCalls.first['id'], 'bk-1');
    expect(api.rejectBookingCalls.first['reason'], 'दूरी ज़्यादा');
  });
}
