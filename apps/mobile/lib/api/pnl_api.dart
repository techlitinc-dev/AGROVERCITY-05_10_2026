import '../models/crop_pnl.dart';
import 'api_client.dart';
import 'endpoints.dart';

class PnlApi {
  PnlApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  // {grossIncome, productionCost, netProfit}
  Future<Map<String, dynamic>> getSummary() => _client.get(pathPnlSummary);

  Future<List<CropPandL>> getCrops() async {
    final res = await _client.get(pathPnlCrops);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => CropPandL.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<CropPandL> addExpense(
    String cropId,
    String category,
    double amount,
  ) async {
    final res = await _client.post(
      pnlCropExpensesPath(cropId),
      body: {'category': category, 'amount': amount},
    );
    return CropPandL.fromJson(res);
  }

  Future<double> breakEven(
    double totalCost,
    double expectedYieldQuintals,
  ) async {
    final res = await _client.post(pathPnlBreakEven, body: {
      'totalCost': totalCost,
      'expectedYieldQuintals': expectedYieldQuintals,
    });
    return (res['minSafePricePerQuintal'] as num?)?.toDouble() ?? 0;
  }
}
