// My Bookings — equipment/vet/transport/coldStorage from
// GET /v1/users/me/bookings (Day 11 B2; coldStorage tab added Day 14 B5).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../api/api_exception.dart';
import '../api/bookings_api.dart';
import '../api/ratings_api.dart';
import '../components/rate_booking_sheet.dart';
import '../models/booking.dart';
import '../state/app_state.dart';
import 'my_bookings_empty.dart';
import 'my_bookings_widgets.dart';

class MyBookingsView extends StatefulWidget {
  final AppState state;
  final BookingsApi? bookingsApi;
  final RatingsApi? ratingsApi;

  const MyBookingsView({
    super.key,
    required this.state,
    this.bookingsApi,
    this.ratingsApi,
  });

  @override
  State<MyBookingsView> createState() => _MyBookingsViewState();
}

class _MyBookingsViewState extends State<MyBookingsView> {
  late final BookingsApi _api = widget.bookingsApi ?? BookingsApi();
  late final RatingsApi _ratingsApi = widget.ratingsApi ?? RatingsApi();

  MyBookings _bookings = const MyBookings();
  bool _loading = true;
  int _tab = 0;
  String? _statusCode; // English status code sent as ?status=
  final Set<String> _rated = {}; // booking ids rated this session (Day 12 B7)

  static const _chipMap = {
    'equipment': {1: 'booked', 2: 'pending', 3: 'cancelled'},
    'vet': {1: 'confirmed', 2: 'pending', 3: 'cancelled'},
    'transport': {1: 'accepted', 2: 'requested', 3: 'cancelled'},
    'coldStorage': {1: 'booked', 2: 'pending', 3: 'cancelled'},
  };
  int? _chipIndex;

  List<String> get _tabs => [
        widget.state.tr('bookings.tabEquipment'),
        widget.state.tr('bookings.tabVet'),
        widget.state.tr('bookings.tabTransport'),
        widget.state.tr('bookings.tabColdStorage'),
      ];
  // Localized chip label → per-kind English status code (B2.7b).
  List<String> get _chipLabels => [
        widget.state.tr('bookings.chipAll'),
        widget.state.tr('bookings.statusConfirmed'),
        widget.state.tr('bookings.statusPending'),
        widget.state.tr('bookings.statusCancelled'),
      ];

  String get _kind => switch (_tab) {
        0 => 'equipment',
        1 => 'vet',
        2 => 'transport',
        _ => 'coldStorage',
      };

  @override
  void initState() {
    super.initState();
    unawaited(initializeDateFormatting('hi'));
    _load();
  }

  Future<void> _load() async {
    try {
      final bookings = await _api.getMyBookings(status: _statusCode);
      if (!mounted) return;
      setState(() {
        _bookings = bookings;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _bookings = const MyBookings();
        _loading = false;
      });
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(message)));
  }

  void _selectChip(int? index) {
    setState(() {
      _chipIndex = index;
      _statusCode = index == null ? null : _chipMap[_kind]![index];
    });
    _load();
  }

  void _selectTab(int index) {
    setState(() {
      _tab = index;
      _chipIndex = null;
      _statusCode = null;
    });
    _load();
  }

  Future<void> _cancelEquipment(Booking booking) async {
    try {
      await _api.cancelEquipmentBooking(booking.id);
      if (!mounted) return;
      setState(() {
        _bookings = MyBookings(
          equipment:
              _bookings.equipment.where((b) => b.id != booking.id).toList(),
          vet: _bookings.vet,
          transport: _bookings.transport,
          coldStorage: _bookings.coldStorage,
        );
      });
      _snack(widget.state.tr('bookings.bookingCancelledMsg'));
    } on ApiException catch (e) {
      _snack(e.code == 'CANCEL_WINDOW_CLOSED'
          ? (e.message.isNotEmpty ? e.message : e.code)
          : (e.message.isNotEmpty
              ? e.message
              : widget.state.tr('bookings.cancelFailed')));
    }
  }

  // Terminal statuses eligible for rating (Day 12 A6 backend rules).
  bool _isRateable(Booking b) => switch (b.kind) {
        'transport' => b.status == 'delivered',
        'vet' => b.status == 'completed',
        'coldStorage' => false,
        _ => b.status == 'booked',
      };

  Future<void> _openRateSheet(Booking booking) async {
    final result = await showRateBookingSheet(
      context,
      booking: booking,
      kind: _kind,
      api: _ratingsApi,
    );
    if (result == null || !mounted) return;
    if (result.markRated) setState(() => _rated.add(booking.id));
    _snack(result.text);
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: const Color(0xFF2E7D32),
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.state.tr('myBookings'),
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: Color(0xFF263238),
              ),
            ),
            const SizedBox(height: 12),
            _buildTabBar(),
            const SizedBox(height: 10),
            _buildFilterChips(),
            const SizedBox(height: 12),
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 60),
                  child: CircularProgressIndicator(color: Color(0xFF43A047)),
                ),
              )
            else if (_bookings.isEmpty)
              BookingsGlobalEmpty(
                state: widget.state,
                onBookEquipment: () => widget.state.navigateTo('equipment'),
              )
            else
              _buildActiveList(),
          ],
        ),
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: List.generate(_tabs.length, (index) {
          final selected = _tab == index;
          return Expanded(
            child: GestureDetector(
              onTap: () => _selectTab(index),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: selected ? const Color(0xFF2E7D32) : null,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    _tabs[index],
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                      color: selected ? Colors.white : Colors.grey.shade700,
                    ),
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildFilterChips() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(_chipLabels.length, (index) {
          final selected = _chipIndex == index || (index == 0 && _chipIndex == null);
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(_chipLabels[index]),
              selected: selected,
              onSelected: (_) => _selectChip(index == 0 ? null : index),
              selectedColor: const Color(0xFFD8F3DC),
              checkmarkColor: const Color(0xFF1B4332),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildActiveList() {
    switch (_tab) {
      case 0:
        if (_bookings.equipment.isEmpty) {
          return BookingEmptyNote(
              text: widget.state.tr('bookings.noEquipmentBookings'));
        }
        return Column(
          children: _bookings.equipment
              .map((b) => EquipmentBookingCard(
                    booking: b,
                    lang: widget.state.language,
                    onCancel: () => _cancelEquipment(b),
                    onRate: _isRateable(b) ? () => _openRateSheet(b) : null,
                    rated: _rated.contains(b.id),
                  ))
              .toList(),
        );
      case 1:
        if (_bookings.vet.isEmpty) {
          return BookingEmptyNote(
              text: widget.state.tr('bookings.noVetBookings'));
        }
        return Column(
          children: _bookings.vet
              .map((b) => VetBookingCard(
                    booking: b,
                    lang: widget.state.language,
                    onRate: _isRateable(b) ? () => _openRateSheet(b) : null,
                    rated: _rated.contains(b.id),
                  ))
              .toList(),
        );
      case 2:
        if (_bookings.transport.isEmpty) {
          return BookingEmptyNote(
              text: widget.state.tr('bookings.noTransportBookings'));
        }
        return Column(
          children: _bookings.transport
              .map((b) => TransportBookingCard(
                    booking: b,
                    lang: widget.state.language,
                    onRate: _isRateable(b) ? () => _openRateSheet(b) : null,
                    rated: _rated.contains(b.id),
                  ))
              .toList(),
        );
      default:
        if (_bookings.coldStorage.isEmpty) {
          return BookingEmptyNote(
              text: widget.state.tr('bookings.noStorageBookings'));
        }
        return Column(
          children: _bookings.coldStorage
              .map((b) => ColdStorageBookingCard(
                    booking: b,
                    lang: widget.state.language,
                  ))
              .toList(),
        );
    }
  }
}
