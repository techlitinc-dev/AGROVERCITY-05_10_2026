// Order tracking: list + detail timeline + cancel/refund UI (X5).

import 'package:flutter/material.dart';
import '../api/api_exception.dart';
import '../api/orders_api.dart';
import '../components/mandi/mandi_price_card.dart';
import '../state/app_state.dart';

class OrderTrackingView extends StatefulWidget {
  final AppState state;
  final OrdersApi? ordersApi;

  const OrderTrackingView({super.key, required this.state, this.ordersApi});

  @override
  State<OrderTrackingView> createState() => _OrderTrackingViewState();
}

class _OrderTrackingViewState extends State<OrderTrackingView> {
  late final OrdersApi _api = widget.ordersApi ?? OrdersApi();
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  String? _expandedId;
  final Set<String> _notCancellable = {};

  static const _statusFlow = ['placed', 'paid', 'shipped', 'delivered'];
  static const _statusLabels = {
    'placed': 'Placed',
    'paid': 'Paid',
    'shipped': 'Shipped',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.getOrders();
      if (!mounted) return;
      setState(() {
        _orders = (res['data'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _orders = const [];
        _loading = false;
      });
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Color _statusColor(String status) => switch (status) {
        'placed' => const Color(0xFFD97706),
        'paid' => const Color(0xFF16A34A),
        'shipped' => const Color(0xFF2563EB),
        'delivered' => const Color(0xFF14532D),
        _ => Colors.grey,
      };

  Future<void> _cancel(Map<String, dynamic> order) async {
    final isPaid = order['status'] == 'paid';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("ऑर्डर रद्द करें?", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Text(
          isPaid
              ? "यह ऑर्डर पेड है — रद्द करने पर रिफंड शुरू हो जाएगा।"
              : "क्या आप यह ऑर्डर रद्द करना चाहते हैं?",
          style: const TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("नहीं")),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("ऑर्डर रद्द करें"),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.cancelOrder("${order['id']}");
      _snack("ऑर्डर रद्द किया गया");
      await _load();
    } on ApiException catch (e) {
      _snack(e.message);
      if (e.code == 'ORDER_NOT_CANCELLABLE') {
        setState(() => _notCancellable.add("${order['id']}"));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("ऑर्डर ट्रैकिंग / Order Tracking", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          if (_loading)
            Container(height: 72, decoration: BoxDecoration(color: Colors.grey.shade200, borderRadius: BorderRadius.circular(14)))
          else if (_orders.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text("कोई ऑर्डर नहीं", style: TextStyle(fontSize: 13, color: Colors.grey, fontWeight: FontWeight.w700))),
            )
          else
            ..._orders.map(_orderCard),
        ],
      ),
    );
  }

  Widget _orderCard(Map<String, dynamic> order) {
    final id = "${order['id']}";
    final status = "${order['status']}";
    final refund = "${order['refundStatus'] ?? 'none'}";
    final items = (order['items'] as List? ?? const []);
    final expanded = _expandedId == id;
    final statusColor = _statusColor(status);

    return GestureDetector(
      onTap: () => setState(() => _expandedId = expanded ? null : id),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text("#$id", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1B4332))),
                ),
                _chip(_statusLabels[status] ?? status, statusColor),
                if (refund != 'none') ...[
                  const SizedBox(width: 6),
                  _chip(
                    refund == 'processed' ? "रिफंड हो गया" : "रिफंड प्रक्रिया में",
                    refund == 'processed' ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 4),
            Text(
              "${items.length} सामग्री • कुल ₹${fmtInr((order['total'] as num?) ?? 0)} • ${order['paymentMethod']}",
              style: const TextStyle(fontSize: 11.5, color: Colors.black54),
            ),
            if (expanded) _detail(order),
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(7),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(label, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: color)),
    );
  }

  Widget _detail(Map<String, dynamic> order) {
    final id = "${order['id']}";
    final status = "${order['status']}";
    final items = (order['items'] as List? ?? const []).cast<Map<String, dynamic>>();
    final flowIndex = _statusFlow.indexOf(status);
    final cancellable =
        (status == 'placed' || status == 'paid') && !_notCancellable.contains(id);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(height: 18),
        for (final item in items)
          Text("• ${item['productId']} × ${item['quantity']}", style: const TextStyle(fontSize: 11.5, color: Colors.black87)),
        const SizedBox(height: 6),
        Text("डिलीवरी: ${order['deliveryAddress']}", style: const TextStyle(fontSize: 11.5, color: Colors.black54)),
        const SizedBox(height: 10),
        if (status == 'cancelled')
          const Text("❌ ऑर्डर रद्द किया गया", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.red))
        else
          Row(
            children: [
              for (var i = 0; i < _statusFlow.length; i++) ...[
                Icon(
                  i <= flowIndex ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
                  size: 14,
                  color: i <= flowIndex ? const Color(0xFF16A34A) : Colors.grey.shade400,
                ),
                Text(
                  " ${_statusLabels[_statusFlow[i]]}",
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: i <= flowIndex ? FontWeight.w900 : FontWeight.w500,
                    color: i <= flowIndex ? const Color(0xFF16A34A) : Colors.grey,
                  ),
                ),
                if (i < _statusFlow.length - 1)
                  const Text(" →", style: TextStyle(fontSize: 9.5, color: Colors.grey)),
              ],
            ],
          ),
        if (cancellable) ...[
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFDC2626),
                side: const BorderSide(color: Color(0xFFFCA5A5)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () => _cancel(order),
              icon: const Icon(Icons.cancel_outlined, size: 16),
              label: const Text("ऑर्डर रद्द करें", style: TextStyle(fontWeight: FontWeight.w900)),
            ),
          ),
        ],
      ],
    );
  }
}
