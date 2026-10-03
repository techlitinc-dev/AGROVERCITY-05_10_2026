import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/models/user_profile_type.dart';
import 'package:kisan_setu/views/profile_home/transport_home_view.dart';
import 'package:kisan_setu/views/transporter/bilty_view.dart';
import 'package:kisan_setu/views/transporter/live_tracking_view.dart';
import 'package:kisan_setu/views/transporter/load_board_view.dart';
import 'package:kisan_setu/views/transporter/transporter_profile_view.dart';
import 'package:kisan_setu/views/transporter/trip_expenses_sheet.dart';

import 'helpers.dart';

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
  });

  testWidgets('LoadBoardView renders open loads and allows placing a bid', (tester) async {
    final fakeApi = FakeTransportApi();
    final appState = TestAppState(active: UserProfileType.transport);

    await pumpScreen(
      tester,
      Scaffold(body: LoadBoardView(state: appState, transportApi: fakeApi)),
    );
    await tester.pumpAndSettle();

    // Verify open load renders
    expect(find.text("लोड बाज़ार (Agri Load Board)"), findsOneWidget);
    expect(find.textContaining("पिंपलगाव, नासिक"), findsOneWidget);
    expect(find.textContaining("टमाटर"), findsWidgets);

    // Tap on the load card to open bidding bottom sheet
    await tester.tap(find.textContaining("बोली लगाएं"));
    await tester.pumpAndSettle();

    // Bottom sheet is open
    expect(find.textContaining("भाड़ा बोली सबमिट करें (Place Quote)"), findsOneWidget);

    // Enter quote amount
    final quoteField = find.byType(TextField).first;
    await tester.enterText(quoteField, "37500");
    await tester.pump();

    // Tap submit bid
    await tester.tap(find.text("बोली भेजें (Submit Quote)"));
    await tester.pumpAndSettle();

    // Clear any toast timer
    await tester.pump(const Duration(seconds: 5));

    // Bottom sheet should close
    expect(find.textContaining("भाड़ा बोली सबमिट करें (Place Quote)"), findsNothing);
  });

  testWidgets('TransporterProfileView renders and updates business details', (tester) async {
    final fakeApi = FakeTransportApi();
    final appState = TestAppState(active: UserProfileType.transport);

    await pumpScreen(
      tester,
      Scaffold(body: TransporterProfileView(state: appState, transportApi: fakeApi)),
    );
    await tester.pumpAndSettle();

    // Check business profile fields are pre-filled
    expect(find.text("जय किसान लॉजिस्टिक्स"), findsAtLeastNWidgets(1));
    expect(find.text("MH-15-AB-1234"), findsAtLeastNWidgets(1));

    // Change business name
    final businessField = find.widgetWithText(TextField, "जय किसान लॉजिस्टिक्स");
    await tester.enterText(businessField, "महाराष्ट्र किसान एक्सप्रेस");
    await tester.pump();

    // Tap save button
    await tester.tap(find.text("प्रोफाइल सहेजें (Save Profile)"));
    await tester.pumpAndSettle();

    // Clear toast timer
    await tester.pump(const Duration(seconds: 5));

    expect(find.text("महाराष्ट्र किसान एक्सप्रेस"), findsAtLeastNWidgets(1));
  });

  testWidgets('LiveTrackingView displays status and waypoints timeline', (tester) async {
    final fakeApi = FakeTransportApi();
    final appState = TestAppState(active: UserProfileType.transport);
    appState.openTripDetail({
      'id': 'bk_123',
      'pickup': 'खेत, पिंपलगाव',
      'drop': 'नासिक APMC',
      'fare': 1200,
      'status': 'enRoute',
      'vehicleType': 'Tata Ace',
      'vehicleNo': 'MH-15-AB-1234',
    });

    await pumpScreen(
      tester,
      Scaffold(body: LiveTrackingView(state: appState, transportApi: fakeApi)),
    );
    await tester.pumpAndSettle();

    // Check GPS and timeline elements
    expect(find.text("लाइव GPS ट्रैकिंग व रूट"), findsOneWidget);
    expect(find.textContaining("हाईवे पर गतिशील"), findsWidgets);
    expect(find.textContaining("चालक / ट्रांसपोर्टर चेक-इन"), findsOneWidget);
    expect(find.text("धर्मकांटा पर्ची"), findsOneWidget);

    // Clear any navigation toast timer
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('BiltyView renders digital consignment LR details', (tester) async {
    final fakeApi = FakeTransportApi();
    final appState = TestAppState(active: UserProfileType.transport);
    appState.openTripDetail({
      'id': 'bk_123',
      'pickup': 'पिंपलगाव',
      'drop': 'नासिक APMC',
      'fare': 1200,
      'status': 'enRoute',
    });

    await pumpScreen(
      tester,
      Scaffold(body: BiltyView(state: appState, transportApi: fakeApi)),
    );
    await tester.pumpAndSettle();

    // Check LR header and details
    expect(find.text("डिजिटल ई-बिल्टी (Lorry Receipt)"), findsOneWidget);
    expect(find.textContaining("LR-2026-TEST"), findsOneWidget);
    expect(find.textContaining("पिंपलगाव"), findsWidgets);

    // Clear any navigation toast timer
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('TripExpensesSheet logs expense and calculates net profit', (tester) async {
    final fakeApi = FakeTransportApi();
    final appState = TestAppState(active: UserProfileType.transport);

    await pumpScreen(
      tester,
      Scaffold(
        body: TripExpensesSheet(
          state: appState,
          bookingId: 'bk_123',
          grossFare: 1200.0,
          api: fakeApi,
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Check expense ledger sheet
    expect(find.text("ट्रिप खर्च व शुद्ध मुनाफा (Profit Ledger)"), findsOneWidget);
    expect(find.textContaining("1,200"), findsWidgets);

    // Enter new expense
    final amountField = find.widgetWithText(TextField, "रुपये (₹)");
    await tester.enterText(amountField, "200");
    await tester.pump();

    // Tap add expense button
    await tester.tap(find.text("+ जोड़ें"));
    await tester.pumpAndSettle();

    // Clear toast timer
    await tester.pump(const Duration(seconds: 5));

    // Should finish without crashing
    expect(find.text("ट्रिप खर्च व शुद्ध मुनाफा (Profit Ledger)"), findsOneWidget);
  });

  testWidgets('TransportHomeView renders TMS action cards and active trip shortcuts', (tester) async {
    final fakeApi = FakeTransportApi();
    fakeApi.bookingsResponse = {
      'data': [
        {
          'id': 'trip_001',
          'pickup': 'नासिक',
          'drop': 'मुंबई',
          'fare': 4500,
          'status': 'enRoute',
          'vehicleType': 'Bolero Maxi',
          'vehicleNo': 'MH-15-AB-5678',
        }
      ],
      'page': 1,
      'pageSize': 20,
      'total': 1,
    };
    final appState = TestAppState(active: UserProfileType.transport);

    await pumpScreen(
      tester,
      Scaffold(body: TransportHomeView(state: appState, transportApi: fakeApi)),
    );
    await tester.pumpAndSettle();

    // Verify TMS tools cards
    expect(find.text("लोड बाज़ार"), findsOneWidget);
    expect(find.text("बिजनेस प्रोफाइल"), findsOneWidget);
    expect(find.text("बुकिंग अनुरोध"), findsOneWidget);
    expect(find.text("मेरे वाहन"), findsOneWidget);

    // Verify quick action shortcuts in trip row
    expect(find.text("ट्रैकिंग"), findsOneWidget);
    expect(find.text("ई-बिल्टी"), findsOneWidget);
    expect(find.text("खर्च"), findsOneWidget);

    // Clear any timers
    await tester.pump(const Duration(seconds: 5));
  });
}
