import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../common/motion_animations.dart';
import '../mandi/mandi_price_card.dart';

class CartBar extends StatelessWidget {
  final AppState state;
  final VoidCallback onCheckout;

  const CartBar({super.key, required this.state, required this.onCheckout});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        if (state.cartItems.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF2E7D32),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Cart: ${state.cartItemCount} items",
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      "Total: ₹${fmtInr(state.cartTotal)} (0% BNPL)",
                      style: const TextStyle(color: Color(0xFFE8F5E9), fontSize: 11.5),
                    ),
                  ],
                ),
                BouncyPressable(
                  onTap: onCheckout,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      "Confirm Order →",
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF2E7D32)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
