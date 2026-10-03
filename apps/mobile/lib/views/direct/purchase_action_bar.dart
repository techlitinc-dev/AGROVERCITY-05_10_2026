import 'package:flutter/material.dart';

import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';

class PurchaseActionBar extends StatelessWidget {
  final AppState state;
  final Purchase purchase;
  final bool isFarmer;
  final VoidCallback onPayAdvance;
  final VoidCallback onRecordPayment;
  final VoidCallback onCancel;
  final VoidCallback onSchedulePickup;
  final VoidCallback onDispatch;
  final VoidCallback onDeliver;
  final VoidCallback onQc;
  final VoidCallback onResolve;
  final VoidCallback onInvoice;
  final VoidCallback onRate;

  const PurchaseActionBar({
    super.key,
    required this.state,
    required this.purchase,
    required this.isFarmer,
    required this.onPayAdvance,
    required this.onRecordPayment,
    required this.onCancel,
    required this.onSchedulePickup,
    required this.onDispatch,
    required this.onDeliver,
    required this.onQc,
    required this.onResolve,
    required this.onInvoice,
    required this.onRate,
  });

  Widget _btn(String label, Color color, VoidCallback onTap,
      {bool filled = true}) {
    final btn = filled
        ? ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: color,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: onTap,
            child: Text(label,
                style: const TextStyle(fontWeight: FontWeight.w900)),
          )
        : OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: color,
              side: BorderSide(color: color),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: onTap,
            child: Text(label,
                style: const TextStyle(fontWeight: FontWeight.w900)),
          );
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: SizedBox(width: double.infinity, child: btn),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tr = state.tr;
    switch (purchase.status) {
      case 'confirmed':
        return Column(children: [
          _btn(tr('direct.payAdvanceBtn'), const Color(0xFF2563EB), onPayAdvance),
          _btn(tr('direct.recordPaymentBtn'), const Color(0xFFD97706), onRecordPayment),
          _btn(tr('direct.cancelPurchaseBtn'), const Color(0xFFDC2626), onCancel,
              filled: false),
        ]);
      case 'advancePaid':
        return Column(children: [
          _btn(tr('direct.pickupBtn'), const Color(0xFF7C3AED), onSchedulePickup),
          _btn(tr('direct.recordPaymentBtn'), const Color(0xFFD97706), onRecordPayment),
          _btn(tr('direct.cancelPurchaseBtn'), const Color(0xFFDC2626), onCancel,
              filled: false),
        ]);
      case 'pickupScheduled':
        return Column(children: [
          _btn(tr('direct.dispatchBtn'), const Color(0xFF0284C7), onDispatch),
          _btn(tr('direct.recordPaymentBtn'), const Color(0xFFD97706), onRecordPayment),
          _btn(tr('direct.cancelPurchaseBtn'), const Color(0xFFDC2626), onCancel,
              filled: false),
        ]);
      case 'inTransit':
        return _btn(tr('direct.deliveredBtn'), const Color(0xFF0D9488), onDeliver);
      case 'delivered':
        return _btn(tr('direct.qcFormTitle'), const Color(0xFF0D9488), onQc);
      case 'qcDisputed':
        return _btn(tr('direct.resolveDisputeBtn'), const Color(0xFFDC2626), onResolve);
      case 'completed':
        final alreadyRated = isFarmer
            ? purchase.rating['farmerToBuyer'] != null
            : purchase.rating['buyerToFarmer'] != null;
        return Column(children: [
          _btn(tr('direct.invoiceBtn'), const Color(0xFF16A34A), onInvoice),
          if (!alreadyRated)
            _btn(
                isFarmer ? tr('direct.rateBuyerBtn') : tr('direct.rateFarmerBtn'),
                const Color(0xFFF59E0B),
                onRate,
                filled: false),
        ]);
      default:
        return const SizedBox.shrink();
    }
  }
}
