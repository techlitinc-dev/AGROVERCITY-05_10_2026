import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu_admin/api/admin_api.dart';
import 'package:kisan_setu_admin/views/dashboard_view.dart';
import 'package:kisan_setu_admin/views/login_view.dart';
import 'package:provider/provider.dart';

import 'helpers.dart';

void main() {
  testWidgets('login view renders', (tester) async {
    tester.view.physicalSize = const Size(1400, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      Provider<AdminApi>.value(
        value: FakeAdminApi(),
        child: MaterialApp(
          home: LoginView(auth: FakeAdminAuth(), onLoggedIn: () {}),
        ),
      ),
    );
    await tester.pump();
    expect(find.widgetWithText(TextField, 'ईमेल'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'पासवर्ड'), findsOneWidget);
    expect(find.text('लॉगिन'), findsOneWidget);
  });

  testWidgets('dashboard renders 6 analytics cards', (tester) async {
    final api = FakeAdminApi()
      ..analyticsResponse = const {
        'totalUsers': 12500,
        'usersByPersona': {'farmer': 9000},
        'bookings': {'equipment': 100, 'vet': 50, 'transport': 75},
        'orders': {'count': 300, 'gmv': 1234567},
        'claimsByStatus': {'intimated': 4, 'disbursed': 10},
        'pendingRates': 7,
      };
    await pumpAdminScreen(tester, const DashboardView(), api);
    expect(find.byType(Card), findsNWidgets(6));
    expect(find.text('कुल उपयोगकर्ता'), findsOneWidget);
    expect(find.text('12,500'), findsOneWidget);
    expect(find.text('₹12,34,567'), findsOneWidget);
    expect(find.text('लंबित दरें'), findsOneWidget);
  });
}
