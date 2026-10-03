// Order action dialogs — cancel confirmation and return-reason prompt.

import 'package:flutter/material.dart';

import '../../state/app_state.dart';

Future<bool?> confirmOrderCancel(
  BuildContext context,
  AppState state, {
  required bool isPaid,
}) =>
    showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(state.tr('bookings.orderCancelTitle'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Text(
          isPaid
              ? state.tr('bookings.orderCancelPaidMsg')
              : state.tr('bookings.orderCancelMsg'),
          style: const TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(state.tr('bookings.noLabel'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(state.tr('bookings.cancelOrderBtn')),
          ),
        ],
      ),
    );

/// Returns the trimmed reason, or null when cancelled/empty.
Future<String?> promptReturnReason(BuildContext context, AppState state) async {
  final result = await showDialog<String>(
    context: context,
    builder: (ctx) => _ReturnReasonDialog(state: state),
  );
  return result;
}

class _ReturnReasonDialog extends StatefulWidget {
  final AppState state;

  const _ReturnReasonDialog({required this.state});

  @override
  State<_ReturnReasonDialog> createState() => _ReturnReasonDialogState();
}

class _ReturnReasonDialogState extends State<_ReturnReasonDialog> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final reason = _controller.text.trim();
    Navigator.pop(context, reason.isEmpty ? null : reason);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(widget.state.tr('emarket.returnDialogTitle'),
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      content: TextField(
        controller: _controller,
        maxLines: 3,
        decoration: InputDecoration(
          hintText: widget.state.tr('emarket.returnReasonHint'),
          hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF90A4AE)),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(widget.state.tr('bookings.noLabel'))),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEA580C),
              foregroundColor: Colors.white),
          onPressed: _submit,
          child: Text(widget.state.tr('emarket.returnSubmit')),
        ),
      ],
    );
  }
}
