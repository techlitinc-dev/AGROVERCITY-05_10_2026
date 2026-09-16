import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/views/transporter/trip_detail_view.dart';
import 'package:kisan_setu/views/transporter/vehicle_manage_view.dart';

import 'helpers.dart';

const _vehicle1 = {
  'id': 'veh-1',
  'vehicleType': 'Tata Ace',
  'registrationNo': 'MH-15-AB-1234',
  'capacityTonnes': 0.75,
  'docStatus': 'verified',
  'active': true,
};

Map<String, dynamic> _booking(String status) => {
      'id': 'bk-1',
      'vehicleType': 'Tata Ace',
      'vehicleNo': null,
      'pickup': 'पिंपलगाव',
      'drop': 'नासिक APMC',
      'distanceKm': 20,
      'date': '2026-09-17',
      'fare': 1200,
      'status': status,
    };

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('vehicle list renders and add form validates', (tester) async {
    final api = FakeTransportApi();
    api.myVehiclesResponse = const {
      'data': [_vehicle1],
    };

    await pumpScreen(
      tester,
      Scaffold(body: VehicleManageView(state: TestAppState(), transportApi: api)),
    );

    expect(find.text('MH-15-AB-1234'), findsOneWidget);

    await tester.tap(find.text('वाहन जोड़ें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.text('सहेजें'));
    await tester.pump();
    expect(find.text('रजिस्ट्रेशन नंबर आवश्यक है'), findsOneWidget);
    expect(api.createVehicleCalls, isEmpty);

    await tester.enterText(
      find.widgetWithText(TextField, 'रजिस्ट्रेशन नंबर'),
      'MH-15-CD-5678',
    );
    await tester.enterText(find.widgetWithText(TextField, 'क्षमता (टन)'), '1.5');
    await tester.tap(find.text('सहेजें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.createVehicleCalls.length, 1);
    expect(api.createVehicleCalls.first['registrationNo'], 'MH-15-CD-5678');
    expect(api.createVehicleCalls.first['vehicleType'], 'Tata Ace');
  });

  testWidgets('trip detail accept assigns vehicle', (tester) async {
    final api = FakeTransportApi();
    api.myVehiclesResponse = const {
      'data': [_vehicle1],
    };
    final state = TestAppState()..openTripDetail(_booking('requested'));

    await pumpScreen(
      tester,
      Scaffold(body: TripDetailView(state: state, transportApi: api)),
    );

    expect(find.text('स्वीकारें'), findsOneWidget);

    await tester.tap(find.text('स्वीकारें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.updateBookingCalls.length, 1);
    expect(api.updateBookingCalls.first['id'], 'bk-1');
    expect(api.updateBookingCalls.first['status'], 'accepted');
    expect(api.updateBookingCalls.first['vehicleId'], 'veh-1');
    expect(api.updateBookingCalls.first['vehicleNo'], 'MH-15-AB-1234');

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('mark delivered blocked without POD, then submits with photo + name',
      (tester) async {
    final api = FakeTransportApi();
    final uploader = FakePhotoUploader();
    final state = TestAppState()..openTripDetail(_booking('enRoute'));

    await pumpScreen(
      tester,
      Scaffold(
        body: TripDetailView(
          state: state,
          transportApi: api,
          photoUploader: uploader,
        ),
      ),
    );

    await tester.tap(find.text('डिलीवरी पूर्ण करें'));
    await tester.pump();

    ElevatedButton submitBtn() => tester.widget<ElevatedButton>(
          find.widgetWithText(ElevatedButton, 'डिलीवरी सबमिट करें'),
        );
    expect(submitBtn().onPressed, isNull);

    await tester.enterText(find.byType(TextField), 'रमेश पटेल');
    await tester.pump();
    expect(submitBtn().onPressed, isNull);

    await tester.tap(find.textContaining('फोटो जोड़ें'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(uploader.requestedPaths.single, startsWith('pod/bk-1/'));
    expect(submitBtn().onPressed, isNotNull);

    await tester.tap(find.text('डिलीवरी सबमिट करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.updateBookingCalls.length, 1);
    expect(api.updateBookingCalls.first['status'], 'delivered');
    expect(api.updateBookingCalls.first['receiverName'], 'रमेश पटेल');
    expect(api.updateBookingCalls.first['podPhotos'],
        ['https://fake.example/photo.jpg']);

    await tester.pump(const Duration(seconds: 5));
  });
}
