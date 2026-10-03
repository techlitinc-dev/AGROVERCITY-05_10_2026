import '../models/emarket_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class OrdersApi {
  OrdersApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> placeOrder({
    required List<Map<String, dynamic>> items,
    required String paymentMethod,
    required String deliveryAddress,
    required String idempotencyKey,
    String? addressId,
    String? couponCode,
  }) =>
      _client.post(pathOrders, body: {
        'items': items,
        'paymentMethod': paymentMethod,
        'deliveryAddress': deliveryAddress,
        'idempotencyKey': idempotencyKey,
        'addressId': ?addressId,
        'couponCode': ?couponCode,
      });

  Future<Map<String, dynamic>> getOrders({int page = 1}) =>
      _client.get(pathOrders, query: {'page': page});

  Future<Map<String, dynamic>> getOrder(String id) => _client.get(orderPath(id));

  Future<Map<String, dynamic>> cancelOrder(String id) =>
      _client.post(orderCancelPath(id));

  Future<List<OrderTimelineEvent>> getTimeline(String id) async {
    final res = await _client.get(orderTimelinePath(id));
    return ((res['events'] as List?) ?? const <dynamic>[])
        .map((e) => OrderTimelineEvent.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, dynamic>> requestReturn(String id, String reason) =>
      _client.post(orderReturnPath(id), body: {'reason': reason});

  Future<Map<String, dynamic>> createRazorpayOrder(String orderId) =>
      _client.post(pathRazorpayOrder, body: {'orderId': orderId});

  Future<Map<String, dynamic>> verifyRazorpayPayment({
    required String orderId,
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) =>
      _client.post(pathRazorpayVerify, body: {
        'orderId': orderId,
        'razorpayOrderId': razorpayOrderId,
        'razorpayPaymentId': razorpayPaymentId,
        'razorpaySignature': razorpaySignature,
      });
}
