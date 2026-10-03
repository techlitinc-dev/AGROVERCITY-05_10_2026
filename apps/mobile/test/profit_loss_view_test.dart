import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/pnl_api.dart';
import 'package:kisan_setu/models/crop_pnl.dart';
import 'package:kisan_setu/views/profit_loss_view.dart';

import 'helpers.dart';

class FakePnlApi extends PnlApi {
  Map<String, dynamic> summaryResponse = const {
    'grossIncome': 145000,
    'productionCost': 62000,
    'netProfit': 83000,
  };
  List<CropPandL> cropsResponse = [];
  double breakEvenResult = 2500;

  int breakEvenCalls = 0;
  final List<Map<String, dynamic>> addExpenseCalls = [];

  @override
  Future<Map<String, dynamic>> getSummary() async => summaryResponse;

  @override
  Future<List<CropPandL>> getCrops() async => cropsResponse;

  @override
  Future<CropPandL> addExpense(
    String cropId,
    String category,
    double amount,
  ) async {
    addExpenseCalls.add({'cropId': cropId, 'category': category, 'amount': amount});
    final crop = cropsResponse.firstWhere((c) => c.id == cropId);
    return CropPandL(
      id: crop.id,
      name: crop.name,
      season: crop.season,
      area: crop.area,
      yieldQuintals: crop.yieldQuintals,
      marketAvgRate: crop.marketAvgRate,
      grossRevenue: crop.grossRevenue,
      totalExpenses: crop.totalExpenses + amount,
      netProfit: crop.grossRevenue - crop.totalExpenses - amount,
      roiPercent: crop.roiPercent,
      expensesBreakdown: [
        ...crop.expensesBreakdown,
        {'category': category, 'amount': amount},
      ],
    );
  }

  @override
  Future<double> breakEven(
    double totalCost,
    double expectedYieldQuintals,
  ) async {
    breakEvenCalls++;
    return breakEvenResult;
  }
}

const _wheat = {
  'id': 'crop-wheat',
  'name': 'Wheat - Sharbati PBW-343 (गेहूं)',
  'season': 'Rabi 2025-26',
  'area': 4.0,
  'yieldQuintals': 40,
  'marketAvgRate': 2275,
  'grossRevenue': 91000,
  'totalExpenses': 30000,
  'netProfit': 61000,
  'roiPercent': 203.3,
  'expensesBreakdown': [
    {'category': 'Certified Seeds (बीज)', 'amount': 6400},
    {'category': 'DAP & Urea (उर्वरक)', 'amount': 9200},
  ],
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('pnl renders 3 KPI cards', (tester) async {
    final api = FakePnlApi();
    api.cropsResponse = [CropPandL.fromJson(_wheat)];

    await pumpScreen(tester, Scaffold(body: ProfitLossView(state: TestAppState(), pnlApi: api)));

    expect(find.text('₹145k'), findsOneWidget);
    expect(find.text('₹62k'), findsOneWidget);
    expect(find.text('₹83k'), findsOneWidget);
    expect(find.text('सकल आय (Gross)'), findsOneWidget);
    expect(find.text('उत्पादन लागत'), findsWidgets);
    expect(find.text('शुद्ध लाभ (Net)'), findsOneWidget);
  });

  testWidgets('break even shows result', (tester) async {
    final api = FakePnlApi();
    api.cropsResponse = [CropPandL.fromJson(_wheat)];

    await pumpScreen(tester, Scaffold(body: ProfitLossView(state: TestAppState(), pnlApi: api)));

    expect(find.textContaining('2,500'), findsNothing);

    await tester.drag(find.byType(Slider).first, const Offset(300, 0));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.breakEvenCalls, greaterThan(0));
    expect(find.textContaining('2,500'), findsOneWidget);
  });
}
