// Dairy + Gaushala management APIs (dairyManager persona consoles).
// Contracts: backend/app/routers/livestock_dairy.py & livestock_gaushala.py.

import '../models/livestock_mgmt_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

List<T> _list<T>(Map<String, dynamic> res, T Function(Map<String, dynamic>) f) =>
    ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => f((e as Map).cast<String, dynamic>()))
        .toList();

class DairyMgmtApi {
  DairyMgmtApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  // --- Members ---

  Future<List<DairyMember>> listMembers({String? status}) async {
    final res = await _client.get(pathDairyMembers, query: {
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return _list(res, DairyMember.fromJson);
  }

  Future<DairyMember> createMember(Map<String, dynamic> body) async {
    final res = await _client.post(pathDairyMembers, body: body);
    return DairyMember.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<DairyMember> updateMember(
    String memberId,
    Map<String, dynamic> body,
  ) async {
    final res = await _client.put(dairyMemberPath(memberId), body: body);
    return DairyMember.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<DairyMember> deactivateMember(String memberId) async {
    final res = await _client.delete(dairyMemberPath(memberId));
    return DairyMember.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<MemberStatement> memberStatement(
    String memberId, {
    String? dateFrom,
    String? dateTo,
  }) async {
    final res = await _client.get(
      dairyMemberStatementPath(memberId),
      query: {
        if (dateFrom != null && dateFrom.isNotEmpty) 'date_from': dateFrom,
        if (dateTo != null && dateTo.isNotEmpty) 'date_to': dateTo,
      },
    );
    return MemberStatement.fromJson(res);
  }

  // --- Rate chart ---

  Future<RateChart> getActiveRateChart({String species = 'cow'}) async {
    final res =
        await _client.get(pathDairyRateChart, query: {'species': species});
    return RateChart.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<List<RateChart>> listRateChartVersions({String? species}) async {
    final res = await _client.get(pathDairyRateChartVersions, query: {
      if (species != null && species.isNotEmpty) 'species': species,
    });
    return _list(res, RateChart.fromJson);
  }

  Future<RateChart> createRateChart(Map<String, dynamic> body) async {
    final res = await _client.post(pathDairyRateChart, body: body);
    return RateChart.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<RateChart> updateRateChart(
    String chartId,
    Map<String, dynamic> body,
  ) async {
    final res = await _client.put(dairyRateChartPath(chartId), body: body);
    return RateChart.fromJson((res as Map).cast<String, dynamic>());
  }

  // --- Payment batches ---

  Future<List<PaymentBatch>> listPaymentBatches() async {
    final res = await _client.get(pathDairyPaymentBatches);
    return _list(res, PaymentBatch.fromJson);
  }

  Future<PaymentBatch> generatePaymentBatch({
    required String periodFrom,
    required String periodTo,
  }) async {
    final res = await _client.post(pathDairyPaymentBatches, body: {
      'periodFrom': periodFrom,
      'periodTo': periodTo,
    });
    return PaymentBatch.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<PaymentBatch> markBatchPaid(
    String batchId, {
    String payoutRef = '',
  }) async {
    final res = await _client.post(
      dairyPaymentBatchMarkPaidPath(batchId),
      body: {'payoutRef': payoutRef},
    );
    return PaymentBatch.fromJson((res as Map).cast<String, dynamic>());
  }

  // --- Farmer self views ---

  Future<List<PaymentEntry>> farmerPayments() async {
    final res = await _client.get(pathDairyFarmerPayments);
    return _list(res, PaymentEntry.fromJson);
  }

  Future<Map<String, dynamic>> farmerSlips({
    String? dateFrom,
    String? dateTo,
  }) async {
    final res = await _client.get(pathDairyFarmerSlips, query: {
      if (dateFrom != null && dateFrom.isNotEmpty) 'date_from': dateFrom,
      if (dateTo != null && dateTo.isNotEmpty) 'date_to': dateTo,
    });
    return res;
  }

  // --- Milk sales ---

  Future<List<MilkSaleCustomer>> listSaleCustomers() async {
    final res = await _client.get(pathDairySalesCustomers);
    return _list(res, MilkSaleCustomer.fromJson);
  }

  Future<MilkSaleCustomer> createSaleCustomer(Map<String, dynamic> body) async {
    final res = await _client.post(pathDairySalesCustomers, body: body);
    return MilkSaleCustomer.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<MilkSaleCustomer> updateSaleCustomer(
    String customerId,
    Map<String, dynamic> body,
  ) async {
    final res =
        await _client.put(dairySaleCustomerPath(customerId), body: body);
    return MilkSaleCustomer.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<List<MilkSaleOrder>> listSaleOrders({String? status}) async {
    final res = await _client.get(pathDairySalesOrders, query: {
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return _list(res, MilkSaleOrder.fromJson);
  }

  Future<MilkSaleOrder> createSaleOrder(Map<String, dynamic> body) async {
    final res = await _client.post(pathDairySalesOrders, body: body);
    return MilkSaleOrder.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<MilkSaleOrder> updateSaleOrderStatus(
    String orderId,
    String status,
  ) async {
    final res = await _client.post(
      dairySaleOrderStatusPath(orderId),
      body: {'status': status},
    );
    return MilkSaleOrder.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<MilkSalesSummary> salesSummary({
    String? dateFrom,
    String? dateTo,
  }) async {
    final res = await _client.get(pathDairySalesSummary, query: {
      if (dateFrom != null && dateFrom.isNotEmpty) 'date_from': dateFrom,
      if (dateTo != null && dateTo.isNotEmpty) 'date_to': dateTo,
    });
    return MilkSalesSummary.fromJson((res as Map).cast<String, dynamic>());
  }

  // --- Stock ---

  Future<List<StockItem>> listStockItems() async {
    final res = await _client.get(pathDairyStockItems);
    return _list(res, StockItem.fromJson);
  }

  Future<StockItem> createStockItem(Map<String, dynamic> body) async {
    final res = await _client.post(pathDairyStockItems, body: body);
    return StockItem.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<StockItem> adjustStock(
    String itemId, {
    required double delta,
    required String reason,
  }) async {
    final res = await _client.post(
      dairyStockAdjustPath(itemId),
      body: {'delta': delta, 'reason': reason},
    );
    return StockItem.fromJson((res as Map).cast<String, dynamic>());
  }
}

class GaushalaMgmtApi {
  GaushalaMgmtApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<GaushalaProfile> getMyGaushala() async {
    final res = await _client.get(pathGaushalaMine);
    return GaushalaProfile.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<GaushalaProfile> createProfile(Map<String, dynamic> body) async {
    final res = await _client.post(pathGaushalaProfile, body: body);
    return GaushalaProfile.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<GaushalaProfile> updateProfile(Map<String, dynamic> body) async {
    final res = await _client.put(pathGaushalaProfile, body: body);
    return GaushalaProfile.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<List<GaushalaCattle>> listCattle({String? category}) async {
    final res = await _client.get(pathGaushalaCattle, query: {
      if (category != null && category.isNotEmpty) 'category': category,
    });
    return _list(res, GaushalaCattle.fromJson);
  }

  Future<GaushalaCattle> addCattleEvent(
    String animalId,
    Map<String, dynamic> body,
  ) async {
    final res =
        await _client.post(gaushalaCattleEventsPath(animalId), body: body);
    return GaushalaCattle.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<Map<String, dynamic>> updateAdoptionStatus(
    String adoptionId,
    String status,
  ) async {
    final res = await _client.put(
      gaushalaAdoptionStatusPath(adoptionId),
      body: {'status': status},
    );
    return res;
  }

  Future<Map<String, dynamic>> updateDonationStatus(
    String donationId,
    String status,
  ) async {
    final res = await _client.put(
      gaushalaDonationStatusPath(donationId),
      body: {'status': status},
    );
    return res;
  }

  Future<List<GaushalaExpense>> listExpenses({String? month}) async {
    final res = await _client.get(pathGaushalaExpenses, query: {
      if (month != null && month.isNotEmpty) 'month': month,
    });
    return _list(res, GaushalaExpense.fromJson);
  }

  Future<GaushalaExpense> createExpense(Map<String, dynamic> body) async {
    final res = await _client.post(pathGaushalaExpenses, body: body);
    return GaushalaExpense.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<GaushalaExpense> updateExpense(
    String expenseId,
    Map<String, dynamic> body,
  ) async {
    final res = await _client.put(gaushalaExpensePath(expenseId), body: body);
    return GaushalaExpense.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<void> deleteExpense(String expenseId) async {
    await _client.delete(gaushalaExpensePath(expenseId));
  }

  Future<ExpenseSummary> expensesSummary({String? month}) async {
    final res = await _client.get(pathGaushalaExpensesSummary, query: {
      if (month != null && month.isNotEmpty) 'month': month,
    });
    return ExpenseSummary.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<GaushalaDashboard> dashboard() async {
    final res = await _client.get(pathGaushalaDashboard);
    return GaushalaDashboard.fromJson((res as Map).cast<String, dynamic>());
  }

  /// cow_adoptions docs for this gaushala (source: the shared adoptions list
  /// endpoint filtered client-side, same as the backend console does).
  Future<List<MgmtAdoption>> listAdoptions(String gaushalaId) async {
    final res =
        await _client.get(pathLivestockGaushalaAdoptions, query: {
      'gaushalaId': gaushalaId,
    });
    return _list(res, MgmtAdoption.fromJson);
  }

  Future<List<MgmtDonation>> listDonations(String gaushalaId) async {
    final res =
        await _client.get(pathLivestockGaushalaDonations, query: {
      'gaushalaId': gaushalaId,
    });
    return _list(res, MgmtDonation.fromJson);
  }
}
