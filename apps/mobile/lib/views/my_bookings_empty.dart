// Empty-state widgets for My Bookings (split from my_bookings_view.dart for
// the line cap).

import 'package:flutter/material.dart';

import '../state/app_state.dart';

class BookingEmptyNote extends StatelessWidget {
  final String text;
  const BookingEmptyNote({super.key, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Center(
        child:
            Text(text, style: const TextStyle(fontSize: 12.5, color: Colors.grey)),
      ),
    );
  }
}

class BookingsGlobalEmpty extends StatelessWidget {
  final AppState state;
  final VoidCallback onBookEquipment;
  const BookingsGlobalEmpty({
    super.key,
    required this.state,
    required this.onBookEquipment,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 60),
        child: Column(
          children: [
            const Icon(Icons.assignment_turned_in_outlined,
                size: 48, color: Colors.grey),
            const SizedBox(height: 12),
            Text(
              state.tr('bookings.noBookingsYet'),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: Color(0xFF374151),
              ),
            ),
            const SizedBox(height: 14),
            ElevatedButton.icon(
              onPressed: onBookEquipment,
              icon: const Icon(Icons.agriculture_rounded, size: 16),
              label: Text(state.tr('bookings.bookEquipment')),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2E7D32),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
