import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/cold_storage_api.dart';
import 'package:kisan_setu/models/cold_storage_models.dart';
import 'package:kisan_setu/views/profile_home/cold_storage_home_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class MockColdStorageProviderApi extends ColdStorageApi {
  ColdStorageProviderStats stats = const ColdStorageProviderStats(
    totalCapacityMT: 50.0,
    occupiedMT: 15.0,
    availableMT: 35.0,
    occupancyPercent: 30.0,
    pendingBookingsCount: 1,
    activeStoredLotsCount: 1,
    totalFarmersCount: 12,
    totalAccruedRent: 18000.0,
    totalValuationStored: 220000.0,
  );

  List<ColdStorageBookingRecord> bookings = [
    const ColdStorageBookingRecord(
      id: 'book-001',
      facilityId: 'cs-1',
      facilityName: 'सह्याद्री कोल्ड चेन व गोदाम',
      farmerUid: 'farmer-001',
      farmerName: 'सुभाष पाटिल',
      farmerPhone: '+919822334455',
      cropName: 'Nashik Red Onion',
      variety: 'Garwa',
      quantityQuintals: 30.0,
      packagingType: 'Jute Bags',
      bagsCount: 60,
      fromDate: '2026-10-15',
      months: 3,
      ratePerQuintalMonth: 12.0,
      totalEstimatedRent: 1080.0,
      status: 'pending',
      bookedAt: '2026-09-28T10:00:00Z',
    ),
    const ColdStorageBookingRecord(
      id: 'book-002',
      facilityId: 'cs-1',
      facilityName: 'सह्याद्री कोल्ड चेन व गोदाम',
      farmerUid: 'farmer-002',
      farmerName: 'रविंद्र जाधव',
      farmerPhone: '+919877665544',
      cropName: 'Potato',
      quantityQuintals: 20.0,
      packagingType: 'Mesh Bags',
      bagsCount: 40,
      fromDate: '2026-10-01',
      months: 4,
      status: 'inwarded',
      bookedAt: '2026-09-25T10:00:00Z',
      lotNumber: 'LOT-2026-CH1-089',
      allocatedChamberName: 'कक्ष A (शीतगृह)',
      inwardNetQuintals: 20.0,
      inwardBags: 40,
      qcGrade: 'Grade A',
      receiptNumber: 'NWR-2026-CS1-4412',
      valuationRupees: 60000.0,
      remainingQuintals: 20.0,
    ),
  ];

  List<Map<String, dynamic>> facilities = [
    {
      'id': 'cs-1',
      'name': 'Sahyadri Cold Chain & Agri Logistics',
      'availableMT': 50.0,
      'chambers': [
        {
          'id': 'ch-101',
          'name': 'कक्ष A (आलू / सेब)',
          'capacityMT': 25.0,
          'currentOccupancyMT': 10.0,
          'tempRange': '2-4°C',
        },
        {
          'id': 'ch-102',
          'name': 'कक्ष B (प्याज / लहसुन)',
          'capacityMT': 25.0,
          'currentOccupancyMT': 5.0,
          'tempRange': '10-14°C',
        },
      ],
    }
  ];

  String? reviewedBookingId;
  String? reviewedAction;
  Map<String, dynamic>? createdFacilityPayload;
  Map<String, dynamic>? addedChamberPayload;

  @override
  Future<ColdStorageProviderStats> getProviderStats() async => stats;

  @override
  Future<List<ColdStorageBookingRecord>> listProviderBookings({
    String? status,
    String? q,
    int page = 1,
    int pageSize = 20,
  }) async {
    if (status == null || status == 'all') return bookings;
    return bookings.where((b) => b.status == status).toList();
  }

  @override
  Future<ColdStorageBookingRecord> reviewBooking(
    String bookingId, {
    required String action,
    String? allocatedChamberId,
    String? notes,
    String? rejectionReason,
  }) async {
    reviewedBookingId = bookingId;
    reviewedAction = action;
    final idx = bookings.indexWhere((b) => b.id == bookingId);
    if (idx != -1) {
      final updated = ColdStorageBookingRecord(
        id: bookingId,
        facilityId: bookings[idx].facilityId,
        facilityName: bookings[idx].facilityName,
        farmerName: bookings[idx].farmerName,
        cropName: bookings[idx].cropName,
        quantityQuintals: bookings[idx].quantityQuintals,
        fromDate: bookings[idx].fromDate,
        months: bookings[idx].months,
        status: action == 'approve' ? 'approved' : 'rejected',
        bookedAt: bookings[idx].bookedAt,
      );
      bookings[idx] = updated;
      return updated;
    }
    throw Exception('Booking not found');
  }

  @override
  Future<List<Map<String, dynamic>>> listFacilities() async => facilities;

  @override
  Future<ColdStorageFacilityRecord> createFacility(
      Map<String, dynamic> data) async {
    createdFacilityPayload = data;
    final newFac = {
      'id': 'cs-2',
      'name': data['name'] ?? 'नवीन गोदाम',
      'availableMT': (data['capacityMT'] as num?)?.toDouble() ?? 100.0,
      'totalCapacityMT': (data['capacityMT'] as num?)?.toDouble() ?? 100.0,
      'facilityType': data['facilityType'] ?? 'dry_godown',
      'ratePerQuintalMonth':
          (data['ratePerQuintalMonth'] as num?)?.toDouble() ?? 15.0,
      'district': data['district'] ?? 'Nashik',
      'chambers': [
        {
          'id': 'ch-201',
          'name': '${data['name']} - विंग १',
          'capacityMT': (data['capacityMT'] as num?)?.toDouble() ?? 100.0,
          'currentOccupancyMT': 0.0,
          'tempRange': data['tempRange'] ?? 'Ambient',
        }
      ],
    };
    facilities.add(newFac);
    return ColdStorageFacilityRecord.fromJson(newFac);
  }

  @override
  Future<Map<String, dynamic>> addChamber(
      String facilityId, Map<String, dynamic> data) async {
    addedChamberPayload = data;
    final ch = {
      'id': 'ch-new-99',
      'name': data['name'] ?? 'New Chamber',
      'capacityMT': (data['capacityMT'] as num?)?.toDouble() ?? 30.0,
      'currentOccupancyMT': 0.0,
      'tempRange': data['tempRange'] ?? '2-8°C',
    };
    final fac = facilities.firstWhere((f) => f['id'] == facilityId,
        orElse: () => facilities.first);
    ((fac['chambers'] as List)).add(ch);
    fac['availableMT'] = (fac['availableMT'] as double) +
        ((data['capacityMT'] as num?)?.toDouble() ?? 30.0);
    return {'chamber': ch, 'facility': fac};
  }
}

Future<void> pumpColdStorageHome(
  WidgetTester tester, {
  MockColdStorageProviderApi? api,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: ColdStorageHomeView(
        state: TestAppState(),
        coldStorageApi: api ?? MockColdStorageProviderApi(),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('ColdStorageHomeView renders header identity and KPI cards',
      (tester) async {
    await pumpColdStorageHome(tester);

    expect(find.textContaining('सह्याद्री कोल्ड चेन'), findsWidgets);
    expect(find.textContaining('WDRA पंजीकृत शीतगृह'), findsOneWidget);
    expect(find.text('कुल क्षमता'), findsOneWidget);
    expect(find.text('50 MT'), findsOneWidget);
    expect(find.text('उपयोग दर'), findsOneWidget);
    expect(find.text('30%'), findsOneWidget);
    expect(find.text('लंबित आवेदन'), findsOneWidget);
    expect(find.text('1'), findsWidgets);
  });

  testWidgets('ColdStorageHomeView displays pending booking with review buttons',
      (tester) async {
    await pumpColdStorageHome(tester);

    expect(find.textContaining('Nashik Red Onion'), findsOneWidget);
    expect(find.textContaining('सुभाष पाटिल'), findsOneWidget);
    expect(find.textContaining('30.0 क्विंटल'), findsOneWidget);
    expect(find.text('स्वीकृत करें'), findsOneWidget);
    expect(find.text('अस्वीकृत करें'), findsOneWidget);
  });

  testWidgets('ColdStorageHomeView approves booking and updates status',
      (tester) async {
    final api = MockColdStorageProviderApi();
    await pumpColdStorageHome(tester, api: api);

    await tester.tap(find.text('स्वीकृत करें'));
    await tester.pumpAndSettle();

    expect(find.textContaining('आरक्षण स्वीकृति'), findsOneWidget);
    expect(find.textContaining('आवंटित कक्ष'), findsOneWidget);

    // Tap confirm button inside AlertDialog
    await tester.tap(find.descendant(
      of: find.byType(AlertDialog),
      matching: find.widgetWithText(ElevatedButton, 'स्वीकृत करें'),
    ));
    await tester.pumpAndSettle();

    expect(api.reviewedBookingId, 'book-001');
    expect(api.reviewedAction, 'approve');
  });

  testWidgets('ColdStorageHomeView switches to Inward and Lots tab',
      (tester) async {
    await pumpColdStorageHome(tester);

    await tester.tap(find.text('आवक व लॉट'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Potato'), findsOneWidget);
    expect(find.textContaining('रविंद्र जाधव'), findsOneWidget);
    expect(find.textContaining('LOT-2026-CH1-089'), findsOneWidget);
    expect(find.textContaining('Grade A'), findsOneWidget);
    expect(find.textContaining('NWR-2026-CS1-4412'), findsOneWidget);
  });

  testWidgets('ColdStorageHomeView switches to Outward and Dispatch tab',
      (tester) async {
    await pumpColdStorageHome(tester);

    await tester.tap(find.text('निकासी'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Potato (रविंद्र जाधव)'), findsOneWidget);
    expect(find.text('गेट पास जारी करें'), findsOneWidget);
  });

  testWidgets('ColdStorageHomeView switches to Chambers and Capacity tab',
      (tester) async {
    await pumpColdStorageHome(tester);

    await tester.tap(find.text('कक्ष क्षमता'));
    await tester.pumpAndSettle();

    expect(find.text('कक्ष A (आलू / सेब)'), findsOneWidget);
    expect(find.text('2-4°C'), findsOneWidget);
    expect(find.text('कक्ष B (प्याज / लहसुन)'), findsOneWidget);
    expect(find.text('10-14°C'), findsOneWidget);
  });

  testWidgets(
      'ColdStorageHomeView opens dialog and adds new godown with capacity',
      (tester) async {
    final api = MockColdStorageProviderApi();
    await pumpColdStorageHome(tester, api: api);

    await tester.tap(find.text('कक्ष क्षमता'));
    await tester.pumpAndSettle();

    // Tap "नया गोदाम" button
    await tester.tap(find.widgetWithText(ElevatedButton, 'नया गोदाम'));
    await tester.pumpAndSettle();

    expect(find.text('नया गोदाम / स्टोरेज जोड़ें'), findsOneWidget);

    // Enter name
    await tester.enterText(
        find.widgetWithText(TextField, 'गोदाम / शीतगृह का नाम *'),
        'नाशिक किसान मेगा गोदाम');
    await tester.pumpAndSettle();

    // Tap "गोदाम जोड़ें" button in dialog
    await tester.tap(find.descendant(
      of: find.byType(AlertDialog),
      matching: find.widgetWithText(ElevatedButton, 'गोदाम जोड़ें'),
    ));
    await tester.pumpAndSettle();

    expect(api.createdFacilityPayload, isNotNull);
    expect(api.createdFacilityPayload!['name'], 'नाशिक किसान मेगा गोदाम');
    expect(api.createdFacilityPayload!['capacityMT'], 100.0);
  });

  testWidgets(
      'ColdStorageHomeView opens dialog and adds chamber with capacity',
      (tester) async {
    final api = MockColdStorageProviderApi();
    await pumpColdStorageHome(tester, api: api);

    await tester.tap(find.text('कक्ष क्षमता'));
    await tester.pumpAndSettle();

    // Tap "कक्ष जोड़ें" button
    await tester.tap(find.widgetWithText(OutlinedButton, 'कक्ष जोड़ें'));
    await tester.pumpAndSettle();

    expect(find.text('नया कक्ष / ब्लॉक जोड़ें'), findsOneWidget);

    // Enter chamber name
    await tester.enterText(
        find.widgetWithText(TextField, 'कक्ष / ब्लॉक का नाम *'),
        'कक्ष C (द्राक्षे व डाळिंब)');
    await tester.pumpAndSettle();

    // Tap "कक्ष जोड़ें" button in dialog
    await tester.tap(find.descendant(
      of: find.byType(AlertDialog),
      matching: find.widgetWithText(ElevatedButton, 'कक्ष जोड़ें'),
    ));
    await tester.pumpAndSettle();

    expect(api.addedChamberPayload, isNotNull);
    expect(api.addedChamberPayload!['name'], 'कक्ष C (द्राक्षे व डाळिंब)');
    expect(api.addedChamberPayload!['capacityMT'], 30.0);
  });
}
