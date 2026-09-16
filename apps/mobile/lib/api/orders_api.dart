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
  }) =>
      _client.post(pathOrders, body: {
        'items': items,
        'paymentMethod': paymentMethod,
        'deliveryAddress': deliveryAddress,
        'idempotencyKey': idempotencyKey,
        'addressId': ?addressId,
      });

  Future<Map<String, dynamic>> getOrders({int page = 1}) =>
      _client.get(pathOrders, query: {'page': page});

  Future<Map<String, dynamic>> getOrder(String id) => _client.get(orderPath(id));

  Future<Map<String, dynamic>> cancelOrder(String id) =>
      _client.post(orderCancelPath(id));

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
