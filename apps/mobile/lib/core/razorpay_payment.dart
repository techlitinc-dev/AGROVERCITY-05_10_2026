// Minimal Razorpay opener for non-order payments (Gyan Hub workshop enroll).
// Mirrors checkout_sheet's dev-mode tolerance: the plugin has no web
// implementation, so web/plugin failure routes to onError.

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:razorpay_flutter/razorpay_flutter.dart';

class RazorpayPayment {
  static void open({
    required String orderId,
    required int amountPaise,
    String name = 'AGROVERCITY',
    String contact = '',
    void Function(String paymentId, String signature)? onSuccess,
    void Function()? onError,
  }) {
    if (kIsWeb) {
      onError?.call();
      return;
    }
    try {
      final razorpay = Razorpay();
      razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS,
          (PaymentSuccessResponse r) {
        razorpay.clear();
        onSuccess?.call(r.paymentId ?? '', r.signature ?? '');
      });
      razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (_) {
        razorpay.clear();
        onError?.call();
      });
      razorpay.open({
        'order_id': orderId,
        'amount': amountPaise,
        'name': name,
        'prefill': {'contact': contact},
      });
    } on Object {
      onError?.call();
    }
  }
}
