// Order tracking: list + expandable detail (timeline, cancel/return) (X5).

import 'package:flutter/material.dart';
import '../api/orders_api.dart';
import '../components/market/order_detail_panel.dart';
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

  Map<String, String> get _statusLabels => {
        'placed': widget.state.tr('bookings.statusPlaced'),
        'paid': widget.state.tr('bookings.statusPaid'),
        'shipped': widget.state.tr('bookings.statusShipped'),
        'delivered': widget.state.tr('bookings.statusDelivered'),
        'cancelled': widget.state.tr('bookings.statusCancelled'),
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

  Color _statusColor(String status) => switch (status) {
        'placed' => const Color(0xFFD97706),
        'paid' => const Color(0xFF16A34A),
        'shipped' => const Color(0xFF2563EB),
        'delivered' => const Color(0xFF14532D),
        _ => Colors.grey,
      };

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.state.tr('bookings.orderTrackingTitle'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          if (_loading)
            Container(height: 72, decoration: BoxDecoration(color: Colors.grey.shade200, borderRadius: BorderRadius.circular(14)))
          else if (_orders.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text(widget.state.tr('bookings.noOrders'), style: const TextStyle(fontSize: 13, color: Colors.grey, fontWeight: FontWeight.w700))),
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
    final returnStatus = order['returnStatus'] as String?;
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
                    refund == 'processed'
                        ? widget.state.tr('bookings.refundDone')
                        : widget.state.tr('bookings.refundProcessing'),
                    refund == 'processed' ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                  ),
                ],
                if (returnStatus != null) ...[
                  const SizedBox(width: 6),
                  _chip(
                    widget.state.tr('emarket.returnPendingLabel'),
                    const Color(0xFFD97706),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 4),
            Text(
              "${items.length} ${widget.state.tr('bookings.itemsUnit')} • ${widget.state.tr('bookings.totalLabel')} ₹${fmtInr((order['total'] as num?) ?? 0)} • ${order['paymentMethod']}",
              style: const TextStyle(fontSize: 11.5, color: Colors.black54),
            ),
            if (expanded)
              OrderDetailPanel(
                state: widget.state,
                order: order,
                api: _api,
                onOrderChanged: _load,
              ),
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
}
