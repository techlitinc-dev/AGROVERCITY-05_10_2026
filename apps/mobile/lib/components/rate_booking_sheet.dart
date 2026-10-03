// Rate-after-completion bottom sheet (Day 12 B7, X8): 5 large stars +
// optional comment → POST /v1/ratings. `showRateBookingSheet` returns a
// RateSheetResult so the caller can snack and mark the card rated.

import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../api/ratings_api.dart';
import '../models/booking.dart';

typedef RateSheetResult = ({bool markRated, String text});

Future<RateSheetResult?> showRateBookingSheet(
  BuildContext context, {
  required Booking booking,
  required String kind,
  required RatingsApi api,
}) {
  return showModalBottomSheet<RateSheetResult>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) => Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(sheetContext).viewInsets.bottom),
      child: RateBookingSheet(booking: booking, kind: kind, api: api),
    ),
  );
}

class RateBookingSheet extends StatefulWidget {
  final Booking booking;
  final String kind;
  final RatingsApi api;

  const RateBookingSheet({
    super.key,
    required this.booking,
    required this.kind,
    required this.api,
  });

  @override
  State<RateBookingSheet> createState() => _RateBookingSheetState();
}

class _RateBookingSheetState extends State<RateBookingSheet> {
  final _commentController = TextEditingController();
  int _stars = 0;
  bool _submitting = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_stars < 1 || _submitting) return;
    setState(() => _submitting = true);
    try {
      await widget.api.postRating(
        bookingKind: widget.kind,
        bookingId: widget.booking.id,
        stars: _stars,
        comment: _commentController.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(
        (markRated: true, text: 'धन्यवाद! रेटिंग दर्ज हुई'),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      final text = switch (e.code) {
        'NOT_COMPLETED' => 'पूरी न हुई बुकिंग रेट नहीं की जा सकती',
        'ALREADY_RATED' => 'आप पहले ही रेटिंग दे चुके हैं',
        _ => e.message.isNotEmpty ? e.message : 'रेटिंग दर्ज करने में विफल',
      };
      Navigator.of(context)
          .pop((markRated: e.code == 'ALREADY_RATED', text: text));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'सेवा रेट करें',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: Color(0xFF263238),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (idx) {
              final selected = idx < _stars;
              return GestureDetector(
                onTap: () => setState(() => _stars = idx + 1),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Icon(
                    selected ? Icons.star_rounded : Icons.star_outline_rounded,
                    size: 40,
                    color: const Color(0xFFEAB308),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _commentController,
            maxLength: 500,
            maxLines: 2,
            decoration: InputDecoration(
              hintText: 'टिप्पणी (वैकल्पिक)',
              hintStyle: TextStyle(fontSize: 12, color: Colors.grey.shade400),
              counterStyle: const TextStyle(fontSize: 10),
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (_stars < 1 || _submitting) ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2E7D32),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                _submitting ? 'भेजा जा रहा है...' : 'भेजें',
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Small shared button for the terminal-status booking cards.
class RateBookingButton extends StatelessWidget {
  final VoidCallback? onRate;
  final bool rated;

  const RateBookingButton({super.key, required this.onRate, this.rated = false});

  @override
  Widget build(BuildContext context) {
    if (rated) {
      return const Text(
        'रेटेड ✓',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          color: Color(0xFF16A34A),
        ),
      );
    }
    return TextButton(
      onPressed: onRate,
      child: const Text(
        'रेटिंग दें',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          color: Color(0xFF2E7D32),
        ),
      ),
    );
  }
}
