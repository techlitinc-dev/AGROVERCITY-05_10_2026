import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/views/equipment_owner/slot_calendar_manage_view.dart';
import 'package:kisan_setu/views/equipment_view.dart';

import 'helpers.dart';
import 'equipment_fakes.dart';

const _machine = {'id': 'eq-2', 'name': 'Shaktiman Rotavator'};

const _pendingRow = {
  'bookingId': 'bkeq-1',
  'equipmentId': 'eq-2',
  'equipmentName': 'Shaktiman Rotavator',
  'farmerName': 'Ram Singh',
  'date': '2026-09-17',
  'slotName': '6:00 AM – 10:00 AM',
  'priceRupees': 800,
  'createdAt': '2026-09-16T08:00:00+05:30',
};

Map<String, dynamic> _templateSlot(String id) => {
      'id': id,
      'equipmentId': 'eq-2',
      'date': '2026-09-17',
      'slotName': '6:00 AM – 10:00 AM',
      'duration': '4 hours',
      'status': 'available',
      'bookedByName': null,
      'priceRupees': 800,
      'recommendedTask': 'Ploughing, tilling (जुताई)',
    };

FakeEquipmentApi _ownerApi({List<Map<String, dynamic>> pending = const [_pendingRow]}) {
  final api = FakeEquipmentApi();
  api.pendingResponse = {'data': pending};
  api.slotsResponse = {'data': [_templateSlot('s-1')]};
  return api;
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('pending bookings listed with farmer and slot', (tester) async {
    await pumpScreen(
      tester,
      Scaffold(
        body: SlotCalendarManageView(
          state: TestAppState(),
          equipmentApi: _ownerApi(),
          machine: _machine,
        ),
      ),
    );

    expect(find.text('लंबित बुकिंग'), findsOneWidget);
    expect(find.text('Ram Singh'), findsOneWidget);
    expect(find.textContaining('Shaktiman Rotavator'), findsWidgets);
    expect(find.textContaining('6:00 AM – 10:00 AM'), findsWidgets);
    expect(find.text('₹800'), findsOneWidget);
  });

  testWidgets('approve records call and removes row', (tester) async {
    final api = _ownerApi();
    await pumpScreen(
      tester,
      Scaffold(
        body: SlotCalendarManageView(
          state: TestAppState(),
          equipmentApi: api,
          machine: _machine,
        ),
      ),
    );

    await tester.tap(find.widgetWithText(ElevatedButton, 'स्वीकारें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.approveCalls, ['bkeq-1']);
    expect(find.text('Ram Singh'), findsNothing);
    expect(find.text('बुकिंग स्वीकृत'), findsOneWidget);
  });

  testWidgets('reject blocked without reason, chip fills it', (tester) async {
    final api = _ownerApi();
    await pumpScreen(
      tester,
      Scaffold(
        body: SlotCalendarManageView(
          state: TestAppState(),
          equipmentApi: api,
          machine: _machine,
        ),
      ),
    );

    await tester.tap(find.widgetWithText(OutlinedButton, 'अस्वीकारें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.widgetWithText(ElevatedButton, 'अस्वीकारें'));
    await tester.pump();
    expect(find.text('कम से कम 3 अक्षर लिखें'), findsOneWidget);
    expect(api.rejectCalls, isEmpty);

    await tester.tap(find.text('मशीन खराब'));
    await tester.pump();
    await tester.tap(find.widgetWithText(ElevatedButton, 'अस्वीकारें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.rejectCalls.length, 1);
    expect(api.rejectCalls.first['id'], 'bkeq-1');
    expect(api.rejectCalls.first['reason'], 'मशीन खराब');
    expect(find.text('Ram Singh'), findsNothing);
  });

  testWidgets('farmer booking card shows rejection reason', (tester) async {
    final api = FakeEquipmentApi();
    await pumpScreen(
      tester,
      Scaffold(
        body: EquipmentView(
          state: TestAppState(),
          equipmentApi: api,
          myBookings: const [
            {
              'bookingId': 'bkeq-9',
              'slotId': 's-1',
              'equipmentName': 'Shaktiman Rotavator',
              'date': '2026-09-17',
              'slotName': '6:00 AM – 10:00 AM',
              'priceRupees': 800,
              'status': 'rejected',
              'rejectionReason': 'मशीन खराब',
            },
          ],
        ),
      ),
    );

    expect(find.text('अस्वीकृत'), findsOneWidget);
    expect(find.textContaining('मशीन खराब'), findsOneWidget);
    expect(find.text('फिर से बुक करें'), findsOneWidget);
  });
}
