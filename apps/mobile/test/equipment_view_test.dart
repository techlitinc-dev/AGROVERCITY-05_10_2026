import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/views/equipment_view.dart';

import 'helpers.dart';
import 'equipment_fakes.dart';

const _machine = {
  'id': 'eq-1',
  'name': 'Mahindra 575 DI Tractor',
  'type': 'tractor',
  'ownerType': 'fpo',
  'hourlyRate': 650,
  'perAcreRate': null,
  'distanceKm': 2.5,
};

Map<String, dynamic> _slot(String id, String status, {String? bookedByName}) => {
      'id': id,
      'equipmentId': 'eq-1',
      'date': '2026-09-16',
      'slotName': '6:00 AM – 10:00 AM',
      'duration': '4 hours',
      'status': status,
      'bookedByName': bookedByName,
      'priceRupees': 800,
      'recommendedTask': 'Ploughing, tilling (जुताई)',
    };

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('slot colors by status', (tester) async {
    final api = FakeEquipmentApi();
    api.equipmentResponse = const {'data': [_machine]};
    api.slotsResponse = {
      'data': [
        _slot('s-1', 'available'),
        _slot('s-2', 'booked', bookedByName: 'Ramesh Patel'),
        _slot('s-3', 'pending', bookedByName: 'Ram Singh'),
      ],
    };

    await pumpScreen(
      tester,
      Scaffold(body: EquipmentView(state: TestAppState(), equipmentApi: api)),
    );

    expect(find.byKey(const Key('slot-dot-available')), findsOneWidget);
    expect(find.byKey(const Key('slot-dot-booked')), findsOneWidget);
    expect(find.byKey(const Key('slot-dot-pending')), findsOneWidget);
    expect(find.text('Ramesh Patel'), findsOneWidget);
    expect(find.text('स्वीकृति लंबित'), findsWidgets);
    expect(find.text('बुक करें'), findsOneWidget);
  });

  testWidgets('max-2 error shows Hindi message', (tester) async {
    final api = FakeEquipmentApi();
    api.equipmentResponse = const {'data': [_machine]};
    api.slotsResponse = {'data': [_slot('s-1', 'available')]};
    api.bookError = const ApiException(
      code: 'MAX_SLOTS_PER_DAY',
      message: 'एक दिन में अधिकतम 2 स्लॉट बुक कर सकते हैं',
    );

    await pumpScreen(
      tester,
      Scaffold(body: EquipmentView(state: TestAppState(), equipmentApi: api)),
    );

    await tester.tap(find.text('बुक करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.text('बुकिंग पक्की करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('एक दिन में अधिकतम 2 स्लॉट बुक कर सकते हैं'), findsOneWidget);
    expect(api.bookSlotCalls.length, 1);
    expect(api.bookSlotCalls.first['slotId'], 's-1');
  });

  testWidgets('waitlist button on full slot', (tester) async {
    final api = FakeEquipmentApi();
    api.equipmentResponse = const {'data': [_machine]};
    api.slotsResponse = {
      'data': [_slot('s-2', 'booked', bookedByName: 'Ramesh Patel')],
    };

    await pumpScreen(
      tester,
      Scaffold(body: EquipmentView(state: TestAppState(), equipmentApi: api)),
    );

    expect(find.text('वेटलिस्ट जोड़ें'), findsOneWidget);

    await tester.tap(find.text('वेटलिस्ट जोड़ें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(api.waitlistCalls, ['s-2']);
  });
}
