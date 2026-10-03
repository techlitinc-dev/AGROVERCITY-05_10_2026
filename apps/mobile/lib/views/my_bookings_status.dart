// Status chip + per-kind status label/color maps for the My Bookings cards
// (split from my_bookings_widgets.dart for the line cap).

import 'package:flutter/material.dart';

import '../data/translations.dart';

class BookingStatusChip extends StatelessWidget {
  final String status;
  final Map<String, String> labels;
  final Map<String, Color> colors;

  const BookingStatusChip({
    super.key,
    required this.status,
    required this.labels,
    required this.colors,
  });

  @override
  Widget build(BuildContext context) {
    final color = colors[status] ?? const Color(0xFF6B7280);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color),
      ),
      child: Text(
        labels[status] ?? status,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
    );
  }
}

Map<String, String> equipmentStatusLabels(String lang) => {
      'booked': AppTranslations.get('bookings.statusConfirmed', lang),
      'pending': AppTranslations.get('bookings.statusApprovalPending', lang),
      'cancelled': AppTranslations.get('bookings.statusCancelled', lang),
    };
const equipmentStatusColors = {
  'booked': Color(0xFF16A34A),
  'pending': Color(0xFFD97706),
  'cancelled': Color(0xFFDC2626),
};

Map<String, String> transportStatusLabels(String lang) => {
      'requested': AppTranslations.get('bookings.statusRequested', lang),
      'accepted': AppTranslations.get('bookings.statusAccepted', lang),
      'enRoute': AppTranslations.get('bookings.statusEnRoute', lang),
      'delivered': AppTranslations.get('bookings.statusDelivered', lang),
      'cancelled': AppTranslations.get('bookings.statusCancelled', lang),
    };
const transportStatusColors = {
  'requested': Color(0xFFD97706),
  'accepted': Color(0xFF16A34A),
  'enRoute': Color(0xFF0284C7),
  'delivered': Color(0xFF047857),
  'cancelled': Color(0xFFDC2626),
};

Map<String, String> coldStorageStatusLabels(String lang) => {
      'booked': AppTranslations.get('bookings.statusBooked', lang),
      'pending': AppTranslations.get('bookings.statusPending', lang),
      'approved': 'स्वीकृत (Approved)',
      'inwarded': 'आवक दर्ज (e-NWR)',
      'release_requested': 'निकासी अनुरोधित',
      'released': 'निर्गत (Released)',
      'rejected': 'अस्वीकृत',
      'cancelled': AppTranslations.get('bookings.statusCancelled', lang),
    };
const coldStorageStatusColors = {
  'booked': Color(0xFF16A34A),
  'pending': Color(0xFFD97706),
  'approved': Color(0xFF0284C7),
  'inwarded': Color(0xFF0F766E),
  'release_requested': Color(0xFFB45309),
  'released': Color(0xFF64748B),
  'rejected': Color(0xFFDC2626),
  'cancelled': Color(0xFFDC2626),
};
