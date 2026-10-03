import 'api_client.dart';
import 'endpoints.dart';
import '../models/direct_buyer_models.dart';

class PurchasesApi {
  PurchasesApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Purchase> createPurchase({
    required String lotId,
    double? quantity,
  }) async {
    final res = await _client.post(pathPurchases,
        body: {'lotId': lotId, 'quantity': ?quantity});
    return Purchase.fromJson(res);
  }

  Future<Map<String, dynamic>> listPurchases({
    String? role,
    int page = 1,
    int pageSize = 20,
  }) =>
      _client.get(pathPurchases, query: {
        'role': ?role,
        'page': page,
        'pageSize': pageSize,
      });

  Future<Purchase> getPurchase(String id) async {
    final res = await _client.get(purchasePath(id));
    return Purchase.fromJson(res);
  }

  Future<Purchase> payAdvance(
    String id, {
    required int amount,
    String method = '',
    String reference = '',
  }) async {
    final res = await _client.post(purchaseAdvancePath(id),
        body: {'amount': amount, 'method': method, 'reference': reference});
    return Purchase.fromJson(res);
  }

  Future<Purchase> schedulePickup(
    String id, {
    required String date,
    String vehicleType = '',
    String address = '',
    String notes = '',
  }) async {
    final res = await _client.post(purchasePickupPath(id), body: {
      'date': date,
      'vehicleType': vehicleType,
      'address': address,
      'notes': notes,
    });
    return Purchase.fromJson(res);
  }

  Future<Purchase> dispatch(String id) async {
    final res = await _client.post(purchaseDispatchPath(id));
    return Purchase.fromJson(res);
  }

  Future<Purchase> deliver(String id) async {
    final res = await _client.post(purchaseDeliverPath(id));
    return Purchase.fromJson(res);
  }

  Future<Purchase> recordQc(
    String id, {
    required String grade,
    required double acceptedQty,
    required double rejectedQty,
    String note = '',
  }) async {
    final res = await _client.post(purchaseQcPath(id), body: {
      'grade': grade,
      'acceptedQty': acceptedQty,
      'rejectedQty': rejectedQty,
      'note': note,
    });
    return Purchase.fromJson(res);
  }

  Future<Purchase> resolveDispute(String id, String resolution) async {
    final res = await _client
        .post(purchaseResolvePath(id), body: {'resolution': resolution});
    return Purchase.fromJson(res);
  }

  Future<Purchase> recordPayment(
    String id, {
    required int amount,
    String method = '',
    String reference = '',
    required String kind,
  }) async {
    final res = await _client.post(purchasePayPath(id), body: {
      'amount': amount,
      'method': method,
      'reference': reference,
      'kind': kind,
    });
    return Purchase.fromJson(res);
  }

  Future<Purchase> cancel(String id, String reason) async {
    final res =
        await _client.post(purchaseCancelPath(id), body: {'reason': reason});
    return Purchase.fromJson(res);
  }

  Future<Purchase> rate(
    String id, {
    required String target,
    required int rating,
    String review = '',
  }) async {
    final res = await _client.post(purchaseRatePath(id),
        body: {'target': target, 'rating': rating, 'review': review});
    return Purchase.fromJson(res);
  }

  Future<PurchaseInvoice> getInvoice(String id) async {
    final res = await _client.get(purchaseInvoicePath(id));
    return PurchaseInvoice.fromJson(res);
  }
}
