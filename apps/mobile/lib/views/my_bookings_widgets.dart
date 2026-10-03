// Booking cards for the My Bookings tabs (split from my_bookings_view.dart
// for the line cap). Date renders as `d MMM yyyy` (hi), rupees via hi_IN.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../components/rate_booking_sheet.dart';
import '../data/translations.dart';
import '../models/booking.dart';
import 'my_bookings_status.dart';

final _rupee =
    NumberFormat.currency(locale: 'hi_IN', symbol: '₹', decimalDigits: 0);

String bookingDateLabel(String raw, [String locale = 'hi']) {
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return raw;
  try {
    return DateFormat('d MMM yyyy', locale).format(parsed);
  } catch (_) {
    return DateFormat('d MMM yyyy').format(parsed);
  }
}

class _BookingCardShell extends StatelessWidget {
  final Widget child;
  const _BookingCardShell({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: child,
    );
  }
}

class EquipmentBookingCard extends StatelessWidget {
  final Booking booking;
  final String lang;
  final VoidCallback onCancel;
  final VoidCallback? onRate;
  final bool rated;

  const EquipmentBookingCard({
    super.key,
    required this.booking,
    required this.lang,
    required this.onCancel,
    this.onRate,
    this.rated = false,
  });

  @override
  Widget build(BuildContext context) {
    final canCancel =
        booking.status == 'booked' || booking.status == 'pending';
    return _BookingCardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  '${booking.slotName ?? ''} • ${bookingDateLabel(booking.date, lang)}',
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w800),
                ),
              ),
              BookingStatusChip(
                status: booking.status,
                labels: equipmentStatusLabels(lang),
                colors: equipmentStatusColors,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _rupee.format(booking.priceRupees ?? 0),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF047857),
                ),
              ),
              if (onRate != null || rated)
                RateBookingButton(onRate: onRate, rated: rated),
              if (canCancel)
                TextButton(
                  onPressed: onCancel,
                  child: Text(
                    AppTranslations.get('cancel', lang),
                    style: const TextStyle(
                      color: Color(0xFFDC2626),
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class VetBookingCard extends StatelessWidget {
  final Booking booking;
  final String lang;
  final VoidCallback? onRate;
  final bool rated;

  const VetBookingCard({
    super.key,
    required this.booking,
    required this.lang,
    this.onRate,
    this.rated = false,
  });

  String _visitLabel(String? visitType) => switch (visitType) {
        'farmVisit' => AppTranslations.get('bookings.visitFarm', lang),
        'clinic' => AppTranslations.get('bookings.visitClinic', lang),
        _ => visitType ?? '',
      };

  @override
  Widget build(BuildContext context) {
    return _BookingCardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  booking.vetName ?? '',
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w800),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Text(
                  _visitLabel(booking.visitType),
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1E40AF),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${booking.animalType ?? ''} • ${booking.slot ?? ''}',
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
          ),
          if (onRate != null || rated)
            Align(
              alignment: Alignment.centerRight,
              child: RateBookingButton(onRate: onRate, rated: rated),
            ),
        ],
      ),
    );
  }
}

class ColdStorageBookingCard extends StatelessWidget {
  final Booking booking;
  final String lang;

  const ColdStorageBookingCard({
    super.key,
    required this.booking,
    required this.lang,
  });

  static String _quintalsText(double? quantity) {
    if (quantity == null) return '';
    return quantity % 1 == 0 ? '${quantity.toInt()}' : '$quantity';
  }

  @override
  Widget build(BuildContext context) {
    return _BookingCardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  booking.facilityName ?? '',
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w800),
                ),
              ),
              BookingStatusChip(
                status: booking.status,
                labels: coldStorageStatusLabels(lang),
                colors: coldStorageStatusColors,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${_quintalsText(booking.quantityQuintals)} ${AppTranslations.get('bookings.unitQuintal', lang)} • ${booking.months ?? ''} ${AppTranslations.get('bookings.unitMonths', lang)}',
            style: const TextStyle(fontSize: 12, color: Color(0xFF374151)),
          ),
          const SizedBox(height: 6),
          Text(
            bookingDateLabel(booking.fromDate ?? booking.date, lang),
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
          ),
        ],
      ),
    );
  }
}

class TransportBookingCard extends StatelessWidget {
  final Booking booking;
  final String lang;
  final VoidCallback? onRate;
  final bool rated;

  const TransportBookingCard({
    super.key,
    required this.booking,
    required this.lang,
    this.onRate,
    this.rated = false,
  });

  @override
  Widget build(BuildContext context) {
    return _BookingCardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  booking.vehicleType ?? '',
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w800),
                ),
              ),
              BookingStatusChip(
                status: booking.status,
                labels: transportStatusLabels(lang),
                colors: transportStatusColors,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${booking.pickup ?? ''} → ${booking.drop ?? ''}',
            style: const TextStyle(fontSize: 12, color: Color(0xFF374151)),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                bookingDateLabel(booking.date, lang),
                style:
                    const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
              ),
              Text(
                _rupee.format(booking.fare ?? 0),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF047857),
                ),
              ),
            ],
          ),
          if (onRate != null || rated)
            Align(
              alignment: Alignment.centerRight,
              child: RateBookingButton(onRate: onRate, rated: rated),
            ),
        ],
      ),
    );
  }
}
