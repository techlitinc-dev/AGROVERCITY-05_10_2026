// Expanded order detail — items, address, live status timeline
// (GET /orders/{id}/timeline), cancel and return actions.

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/orders_api.dart';
import '../../models/emarket_models.dart';
import '../../state/app_state.dart';
import 'order_action_dialogs.dart';

class OrderDetailPanel extends StatefulWidget {
  final AppState state;
  final Map<String, dynamic> order;
  final OrdersApi api;

  /// Called after a successful cancel/return so the list can reload.
  final VoidCallback onOrderChanged;

  const OrderDetailPanel({
    super.key,
    required this.state,
    required this.order,
    required this.api,
    required this.onOrderChanged,
  });

  @override
  State<OrderDetailPanel> createState() => _OrderDetailPanelState();
}

class _OrderDetailPanelState extends State<OrderDetailPanel> {
  static const _statusFlow = ['placed', 'paid', 'shipped', 'delivered'];

  List<OrderTimelineEvent> _timeline = [];
  bool _timelineLoading = true;
  bool _notCancellable = false;
  bool _returning = false;

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
    _loadTimeline();
  }

  Future<void> _loadTimeline() async {
    try {
      final events = await widget.api.getTimeline("${widget.order['id']}");
      if (!mounted) return;
      setState(() {
        _timeline = events;
        _timelineLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _timelineLoading = false);
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  String _formatAt(String at) {
    final dt = DateTime.tryParse(at);
    if (dt == null) return at;
    final local = dt.toLocal();
    String two(int v) => v.toString().padLeft(2, '0');
    return "${two(local.day)}/${two(local.month)}/${local.year} ${two(local.hour)}:${two(local.minute)}";
  }

  Future<void> _cancel() async {
    final order = widget.order;
    final confirmed = await confirmOrderCancel(
      context,
      widget.state,
      isPaid: order['status'] == 'paid',
    );
    if (confirmed != true) return;
    try {
      await widget.api.cancelOrder("${order['id']}");
      _snack(widget.state.tr('bookings.orderCancelledMsg'));
      widget.onOrderChanged();
    } on ApiException catch (e) {
      _snack(e.message);
      if (e.code == 'ORDER_NOT_CANCELLABLE') {
        setState(() => _notCancellable = true);
      }
    }
  }

  Future<void> _return() async {
    final reason = await promptReturnReason(context, widget.state);
    if (reason == null) return;
    setState(() => _returning = true);
    try {
      await widget.api.requestReturn("${widget.order['id']}", reason);
      widget.state.showToast(widget.state.tr('emarket.returnSuccess'));
      widget.onOrderChanged();
    } on ApiException catch (e) {
      _snack(e.message);
    } finally {
      if (mounted) setState(() => _returning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final status = "${order['status']}";
    final returnStatus = order['returnStatus'] as String?;
    final items =
        (order['items'] as List? ?? const []).cast<Map<String, dynamic>>();
    final flowIndex = _statusFlow.indexOf(status);
    final cancellable =
        (status == 'placed' || status == 'paid') && !_notCancellable;
    final returnable = (status == 'delivered' || status == 'paid') &&
        returnStatus == null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(height: 18),
        for (final item in items)
          Text("• ${item['productId']} × ${item['quantity']}", style: const TextStyle(fontSize: 11.5, color: Colors.black87)),
        const SizedBox(height: 6),
        Text("${widget.state.tr('bookings.deliveryLabel')} ${order['deliveryAddress']}", style: const TextStyle(fontSize: 11.5, color: Colors.black54)),
        if ((order['couponCode'] as String?) != null) ...[
          const SizedBox(height: 4),
          Text(
            "${widget.state.tr('emarket.coupons')}: ${order['couponCode']} • ${widget.state.tr('emarket.finalTotalLabel')}: ₹${(order['finalTotal'] as num?) ?? order['total']}",
            style: const TextStyle(fontSize: 11.5, color: Color(0xFFEA580C)),
          ),
        ],
        const SizedBox(height: 10),
        if (status == 'cancelled')
          Text(widget.state.tr('bookings.orderCancelledLabel'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.red))
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
        const SizedBox(height: 10),
        Text(
          widget.state.tr('emarket.orderTimeline'),
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 6),
        if (_timelineLoading)
          const SizedBox(
            height: 40,
            child: Center(
              child: SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          )
        else if (_timeline.isEmpty)
          Text("—", style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500))
        else
          for (var i = 0; i < _timeline.length; i++)
            _timelineRow(_timeline[i], isLast: i == _timeline.length - 1),
        if (returnStatus != null) ...[
          const SizedBox(height: 8),
          _returnChip(returnStatus),
        ],
        if (cancellable || returnable) const SizedBox(height: 10),
        if (cancellable)
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFDC2626),
                side: const BorderSide(color: Color(0xFFFCA5A5)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _cancel,
              icon: const Icon(Icons.cancel_outlined, size: 16),
              label: Text(widget.state.tr('bookings.cancelOrderBtn'), style: const TextStyle(fontWeight: FontWeight.w900)),
            ),
          ),
        if (returnable)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFEA580C),
                  side: const BorderSide(color: Color(0xFFFDBA74)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _returning ? null : _return,
                icon: const Icon(Icons.assignment_return_rounded, size: 16),
                label: Text(widget.state.tr('emarket.returnItem'),
                    style: const TextStyle(fontWeight: FontWeight.w900)),
              ),
            ),
          ),
        if (cancellable || returnable) const SizedBox(height: 2),
      ],
    );
  }

  Widget _timelineRow(OrderTimelineEvent event, {required bool isLast}) {
    final label = _statusLabels[event.status] ?? event.status;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              Container(
                width: 10,
                height: 10,
                margin: const EdgeInsets.only(top: 3),
                decoration: const BoxDecoration(
                  color: Color(0xFF16A34A),
                  shape: BoxShape.circle,
                ),
              ),
              if (!isLast)
                Expanded(child: Container(width: 2, color: const Color(0xFFBBF7D0))),
            ],
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900),
                  ),
                  if (event.note.isNotEmpty)
                    Text(event.note,
                        style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600)),
                  Text(
                    _formatAt(event.at),
                    style: TextStyle(fontSize: 9.5, color: Colors.grey.shade500),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _returnChip(String returnStatus) {
    final color =
        returnStatus == 'requested' ? const Color(0xFFD97706) : const Color(0xFF16A34A);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(
        widget.state.tr('emarket.returnPendingLabel'),
        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: color),
      ),
    );
  }
}
