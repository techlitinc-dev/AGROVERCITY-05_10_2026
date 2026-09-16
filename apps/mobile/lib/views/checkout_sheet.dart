// Checkout: address picker + payment method + Razorpay UPI / COD / BNPL.

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:uuid/uuid.dart';
import '../api/addresses_api.dart';
import '../api/api_exception.dart';
import '../api/orders_api.dart';
import '../components/market/address_picker_sheet.dart';
import '../components/market/checkout_widgets.dart';
import '../components/mandi/mandi_price_card.dart';
import '../state/app_state.dart';

class CheckoutSheet extends StatefulWidget {
  final AppState state;
  final OrdersApi? ordersApi;
  final AddressesApi? addressesApi;

  const CheckoutSheet({
    super.key,
    required this.state,
    this.ordersApi,
    this.addressesApi,
  });

  @override
  State<CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<CheckoutSheet> {
  late final OrdersApi _orders = widget.ordersApi ?? OrdersApi();
  late final AddressesApi _addresses = widget.addressesApi ?? AddressesApi();
  final String _idempotencyKey = const Uuid().v4();

  List<Map<String, dynamic>> _addressList = [];
  Map<String, dynamic>? _selectedAddress;
  String _paymentMethod = 'cod';
  bool _placing = false;
  Map<String, dynamic>? _placedOrder;

  @override
  void initState() {
    super.initState();
    _loadAddresses();
  }

  Future<void> _loadAddresses() async {
    try {
      final res = await _addresses.getAddresses();
      final list = (res['data'] as List).cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        _addressList = list;
        _selectedAddress = list.firstWhere(
          (a) => a['isDefault'] == true,
          orElse: () => list.isNotEmpty ? list.first : const {},
        );
        if (_selectedAddress!.isEmpty) _selectedAddress = null;
      });
    } catch (_) {}
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  String _fallbackAddress() {
    final p = widget.state.profile;
    return "${p.village}, ${p.district}, ${p.state}";
  }

  String _composedAddress(Map<String, dynamic> a) =>
      "${a['line1']}, ${a['village']}, ${a['district']}, ${a['state']} - ${a['pincode']}";

  Future<void> _pickAddress() async {
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AddressPickerSheet(
        state: widget.state,
        addresses: _addressList,
        addressesApi: _addresses,
        selectedId: _selectedAddress?['id'] as String?,
      ),
    );
    if (picked != null) {
      setState(() {
        _selectedAddress = picked;
        if (!_addressList.any((a) => a['id'] == picked['id'])) {
          _addressList = [..._addressList, picked];
        }
      });
    }
  }

  Future<void> _pay() async {
    if (_placing) return;
    setState(() => _placing = true);
    final address = _selectedAddress;
    try {
      final res = await _orders.placeOrder(
        items: [
          for (final i in widget.state.cartItems)
            {'productId': i['productId'], 'quantity': i['quantity']},
        ],
        paymentMethod: _paymentMethod,
        deliveryAddress:
            address == null ? _fallbackAddress() : _composedAddress(address),
        addressId: address?['id'] as String?,
        idempotencyKey: _idempotencyKey,
      );
      if (_paymentMethod == 'upi') {
        await _payUpi("${res['orderId']}");
      } else {
        _onOrderSuccess(res);
      }
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : "भुगतान विफल — पुनः प्रयास करें");
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  Future<void> _payUpi(String orderId) async {
    final rzp = await _orders.createRazorpayOrder(orderId);
    final rzpOrderId = "${rzp['razorpayOrderId']}";
    // razorpay_flutter has no web implementation; the dev backend accepts the
    // signature "dev", so web/plugin failure completes through the dev path.
    if (!kIsWeb) {
      try {
        final razorpay = Razorpay();
        razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS,
            (PaymentSuccessResponse r) async {
          razorpay.clear();
          await _verifyUpi(
            orderId,
            r.orderId ?? rzpOrderId,
            r.paymentId ?? '',
            r.signature ?? '',
          );
        });
        razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (_) {
          razorpay.clear();
          _snack("भुगतान विफल — पुनः प्रयास करें");
        });
        razorpay.open({
          'key': rzp['keyId'],
          'order_id': rzpOrderId,
          'amount': rzp['amount'],
          'name': 'AGROVERCITY',
          'prefill': {'contact': widget.state.profile.phone},
        });
        return;
      } on Object {
        // fall through to the dev verify path
      }
    }
    await _verifyUpi(orderId, rzpOrderId, 'pay_dev', 'dev');
  }

  Future<void> _verifyUpi(
    String orderId,
    String rzpOrderId,
    String paymentId,
    String signature,
  ) async {
    try {
      final res = await _orders.verifyRazorpayPayment(
        orderId: orderId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
      );
      if (res['status'] == 'paid') {
        _onOrderSuccess({'orderId': orderId, 'total': widget.state.cartTotal});
      } else {
        _snack("भुगतान विफल — पुनः प्रयास करें");
      }
    } on ApiException {
      _snack("भुगतान विफल — पुनः प्रयास करें");
    }
  }

  void _onOrderSuccess(Map<String, dynamic> res) {
    setState(() => _placedOrder = res);
    widget.state.refreshCart().catchError((_) {});
    widget.state.navigateTo('orderTracking');
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 26,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "चेकआउट (Checkout)",
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
          ),
          const SizedBox(height: 12),
          CheckoutAddressCard(
            composedAddress: _selectedAddress == null
                ? null
                : _composedAddress(_selectedAddress!),
            label: "${_selectedAddress?['label'] ?? ''}",
            onTap: _pickAddress,
          ),
          const SizedBox(height: 12),
          const Text("भुगतान विधि", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900)),
          CheckoutMethodTiles(
            groupValue: _paymentMethod,
            onChanged: (v) => setState(() => _paymentMethod = v ?? _paymentMethod),
          ),
          if (_placedOrder != null) ...[
            const SizedBox(height: 10),
            OrderSuccessCard(order: _placedOrder!),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _placing ? null : _pay,
              child: Text(
                _placing
                    ? "प्रोसेस हो रहा है..."
                    : "Pay ₹${fmtInr(widget.state.cartTotal)}",
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
