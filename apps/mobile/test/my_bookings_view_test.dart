import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/bookings_api.dart';
import 'package:kisan_setu/api/ratings_api.dart';
import 'package:kisan_setu/models/booking.dart';
import 'package:kisan_setu/views/my_bookings_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeBookingsApi extends BookingsApi {
  MyBookings response = const MyBookings();
  String? lastStatus;
  final List<String> cancelled = [];

  @override
  Future<MyBookings> getMyBookings({String? status}) async {
    lastStatus = status;
    return response;
  }

  @override
  Future<void> cancelEquipmentBooking(String id) async {
    cancelled.add(id);
  }
}

class FakeRatingsApi extends RatingsApi {
  final List<Map<String, dynamic>> postRatingCalls = [];

  @override
  Future<Map<String, dynamic>> postRating({
    required String bookingKind,
    required String bookingId,
    required int stars,
    String comment = '',
  }) async {
    postRatingCalls.add({
      'bookingKind': bookingKind,
      'bookingId': bookingId,
      'stars': stars,
      'comment': comment,
    });
    return {
      'id': 'rat_1',
      'bookingKind': bookingKind,
      'bookingId': bookingId,
      'stars': stars,
      'comment': comment,
      'providerId': 'prov_1',
      'createdAt': '2026-09-17T10:00:00.000Z',
    };
  }
}

Booking equipmentBooking() => const Booking(
      id: 'bkeq_1',
      kind: 'equipment',
      status: 'booked',
      date: '2026-09-15',
      slotName: 'सुबह 7-10 स्लॉट',
      priceRupees: 500,
    );

Booking transportBooking() => const Booking(
      id: 'bkt_1',
      kind: 'transport',
      status: 'requested',
      date: '2026-09-16',
      vehicleType: 'Tata Ace',
      pickup: 'Ozarkhed',
      drop: 'Nashik APMC',
      fare: 850,
    );

Future<void> pumpBookingsView(
  WidgetTester tester,
  FakeBookingsApi api, {
  FakeRatingsApi? ratingsApi,
}) async {
  await pumpScreen(
    tester,
    Scaffold(
      body: MyBookingsView(
        state: TestAppState(),
        bookingsApi: api,
        ratingsApi: ratingsApi,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('bookings renders 4 tabs', (tester) async {
    await pumpBookingsView(tester, FakeBookingsApi());
    expect(find.text('उपकरण'), findsOneWidget);
    expect(find.text('पशु चिकित्सक'), findsOneWidget);
    expect(find.text('परिवहन'), findsOneWidget);
    expect(find.text('कोल्ड स्टोरेज'), findsOneWidget);
  });

  testWidgets('equipment booking card renders', (tester) async {
    final api = FakeBookingsApi()
      ..response = MyBookings(equipment: [equipmentBooking()]);
    await pumpBookingsView(tester, api);
    expect(find.textContaining('सुबह 7-10 स्लॉट'), findsOneWidget);
    expect(find.text('पुष्ट'), findsWidgets);
  });

  testWidgets('empty vet tab shows placeholder', (tester) async {
    final api = FakeBookingsApi()
      ..response = MyBookings(equipment: [equipmentBooking()]);
    await pumpBookingsView(tester, api);
    await tester.tap(find.text('पशु चिकित्सक'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('कोई पशु चिकित्सक बुकिंग नहीं'), findsOneWidget);
  });

  testWidgets('transport card renders fare and route', (tester) async {
    final api = FakeBookingsApi()
      ..response = MyBookings(transport: [transportBooking()]);
    await pumpBookingsView(tester, api);
    await tester.tap(find.text('परिवहन'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('₹850'), findsOneWidget);
    expect(find.text('Ozarkhed → Nashik APMC'), findsOneWidget);
  });

  testWidgets('global empty state', (tester) async {
    await pumpBookingsView(tester, FakeBookingsApi());
    expect(find.text('अभी तक कोई बुकिंग नहीं'), findsOneWidget);
    expect(find.text('उपकरण बुक करें'), findsOneWidget);
  });

  testWidgets('status filter chip refetches', (tester) async {
    final api = FakeBookingsApi()
      ..response = MyBookings(equipment: [equipmentBooking()]);
    await pumpBookingsView(tester, api);
    await tester.tap(find.text('पुष्ट').first);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(api.lastStatus, 'booked');
  });

  testWidgets('completed booking shows rate button', (tester) async {
    final api = FakeBookingsApi()
      ..response = MyBookings(transport: [
        const Booking(
          id: 'bkt_1',
          kind: 'transport',
          status: 'delivered',
          date: '2026-09-16',
          vehicleType: 'Tata Ace',
          pickup: 'Ozarkhed',
          drop: 'Nashik APMC',
          fare: 850,
        ),
      ]);
    await pumpBookingsView(tester, api, ratingsApi: FakeRatingsApi());
    await tester.tap(find.text('परिवहन'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('रेटिंग दें'), findsOneWidget);
  });

  testWidgets('rate submit shows thank-you snackbar', (tester) async {
    final api = FakeBookingsApi()
      ..response = MyBookings(transport: [
        const Booking(
          id: 'bkt_1',
          kind: 'transport',
          status: 'delivered',
          date: '2026-09-16',
          vehicleType: 'Tata Ace',
          pickup: 'Ozarkhed',
          drop: 'Nashik APMC',
          fare: 850,
        ),
      ]);
    final ratingsApi = FakeRatingsApi();
    await pumpBookingsView(tester, api, ratingsApi: ratingsApi);
    await tester.tap(find.text('परिवहन'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.text('रेटिंग दें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.byIcon(Icons.star_outline_rounded).last);
    await tester.pump();
    await tester.tap(find.text('भेजें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(ratingsApi.postRatingCalls, hasLength(1));
    expect(ratingsApi.postRatingCalls.first['bookingKind'], 'transport');
    expect(ratingsApi.postRatingCalls.first['bookingId'], 'bkt_1');
    expect(ratingsApi.postRatingCalls.first['stars'], 5);
    expect(find.text('धन्यवाद! रेटिंग दर्ज हुई'), findsOneWidget);
    expect(find.text('रेटेड ✓'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('cold storage tab renders booking', (tester) async {
    final api = FakeBookingsApi()
      ..response = const MyBookings(coldStorage: [
        Booking(
          id: 'csb_1',
          kind: 'coldStorage',
          status: 'booked',
          date: '2026-09-17',
          facilityName: 'Sahyadri Mega Agro Cold Chain Ltd.',
          quantityQuintals: 20,
          fromDate: '2026-09-20',
          months: 3,
        ),
      ]);
    await pumpBookingsView(tester, api);

    await tester.tap(find.text('कोल्ड स्टोरेज'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Sahyadri Mega Agro Cold Chain Ltd.'), findsOneWidget);
    expect(find.textContaining('क्विंटल'), findsOneWidget);
    expect(find.text('बुक्ड'), findsOneWidget);
  });
}
