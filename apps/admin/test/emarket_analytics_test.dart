import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu_admin/views/emarket_analytics_view.dart';

import 'helpers.dart';

Map<String, dynamic> _payload() => {
      'gmv': 125000,
      'totalOrders': 40,
      'totalCustomers': 12,
      'totalSellers': 3,
      'aov': 3125.0,
      'returnRate': 0.05,
      'monthlyGmv': [
        {'month': '2026-09', 'amount': 50000},
        {'month': '2026-08', 'amount': 25000},
      ],
      'ordersByStatus': {'delivered': 30, 'cancelled': 10},
      'categoryShare': [
        {'category': 'बीज', 'revenue': 80000},
        {'category': 'उर्वरक', 'revenue': 45000},
      ],
      'topProducts': [
        {'id': 'p1', 'title': 'हाइब्रिड बीज', 'revenue': 60000, 'orders': 15},
      ],
      'topSellers': [
        {'sellerId': 's1', 'name': 'राम ट्रेडर्स', 'revenue': 90000, 'orders': 20},
      ],
      'couponUsage': {'issued': 8, 'used': 5},
    };

void main() {
  testWidgets('renders KPI cards and analytics sections', (tester) async {
    final api = FakeAdminApi()..emarketResponse = _payload();
    await pumpAdminScreen(tester, const EmarketAnalyticsView(), api);

    expect(find.text('कुल बिक्री (GMV)'), findsOneWidget);
    expect(find.text('₹1,25,000'), findsOneWidget);
    expect(find.text('कूपन उपयोग'), findsOneWidget);
    expect(find.text('5'), findsOneWidget);
    expect(find.text('मासिक बिक्री (12 माह)'), findsOneWidget);
    expect(find.text('ऑर्डर स्थिति'), findsOneWidget);
    expect(find.text('श्रेणी हिस्सा'), findsOneWidget);
    expect(find.text('शीर्ष उत्पाद'), findsOneWidget);
    expect(find.text('हाइब्रिड बीज'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('राम ट्रेडर्स'), 200,
        scrollable: find.byType(Scrollable).last);
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('शीर्ष विक्रेता'), findsOneWidget);
    expect(find.text('राम ट्रेडर्स'), findsOneWidget);
    expect(find.text('5.0%'), findsNothing);
  });

  testWidgets('shows empty state when lists are unpopulated', (tester) async {
    final api = FakeAdminApi()
      ..emarketResponse = {
        'gmv': 0,
        'totalOrders': 0,
        'monthlyGmv': const [],
        'ordersByStatus': const {},
        'categoryShare': const [],
        'topProducts': const [],
        'topSellers': const [],
        'couponUsage': const {'issued': 0, 'used': 0},
      };
    await pumpAdminScreen(tester, const EmarketAnalyticsView(), api);

    expect(find.text('डेटा उपलब्ध नहीं'), findsNWidgets(5));
  });
}
