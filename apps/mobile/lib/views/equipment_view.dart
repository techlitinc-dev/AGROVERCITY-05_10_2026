// Module L: Equipment Sharing Network Flutter View (CRD Change 10)

import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../api/equipment_api.dart';
import '../state/app_state.dart';
import 'equipment/booking_confirm_sheet.dart';
import 'equipment/equipment_calendar_section.dart';
import 'equipment/machine_booking_widgets.dart';

class EquipmentView extends StatefulWidget {
  final AppState state;
  final EquipmentApi? equipmentApi;
  final List<Map<String, dynamic>>? myBookings;
  const EquipmentView({
    super.key,
    required this.state,
    this.equipmentApi,
    this.myBookings,
  });

  @override
  State<EquipmentView> createState() => _EquipmentViewState();
}

class _EquipmentViewState extends State<EquipmentView> {
  late final EquipmentApi _api = widget.equipmentApi ?? EquipmentApi();

  bool _loadingMachines = true;
  bool _loadingSlots = false;
  List<Map<String, dynamic>> _machines = [];
  Map<String, dynamic>? _selectedMachine;
  List<Map<String, dynamic>> _slots = [];
  int _dayIndex = 0;
  late final List<Map<String, dynamic>> _myBookings = [
    ...?widget.myBookings,
  ];
  final GlobalKey _calendarKey = GlobalKey();
  final ScrollController _scrollCtrl = ScrollController();

  String get _farmerName => widget.state.profile.name;

  @override
  void initState() {
    super.initState();
    _loadMachines();
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  String _dateStr(DateTime d) =>
      "${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}";

  List<DateTime> get _days =>
      List.generate(7, (i) => DateTime.now().add(Duration(days: i)));

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _loadMachines() async {
    try {
      final res = await _api.getEquipment();
      if (!mounted) return;
      final machines = (res['data'] as List).cast<Map<String, dynamic>>();
      setState(() {
        _machines = machines;
        _selectedMachine = machines.isNotEmpty ? machines.first : null;
        _loadingMachines = false;
      });
      await _loadSlots();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _machines = const [];
        _loadingMachines = false;
      });
    }
  }

  Future<void> _loadSlots() async {
    final machine = _selectedMachine;
    if (machine == null) return;
    setState(() => _loadingSlots = true);
    try {
      final res = await _api.getSlots(
        "${machine['id']}",
        _dateStr(_days[_dayIndex]),
      );
      if (!mounted) return;
      setState(() {
        _slots = (res['data'] as List).cast<Map<String, dynamic>>();
        _loadingSlots = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _slots = const [];
        _loadingSlots = false;
      });
    }
  }

  bool _isMine(Map<String, dynamic> slot) =>
      slot['bookedByName'] == _farmerName &&
      (slot['status'] == 'booked' || slot['status'] == 'pending');

  // max 2 slots/farmer/day — server-enforced, 409 on third
  Future<void> _book(Map<String, dynamic> slot) async {
    final machine = _selectedMachine;
    if (machine == null) return;
    final date = _dateStr(_days[_dayIndex]);
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => BookingConfirmSheet(
        machineName: "${machine['name']}",
        ownerType: "${machine['ownerType'] ?? 'private'}",
        date: date,
        slot: slot,
      ),
    );
    if (confirmed != true) return;
    try {
      final res = await _api.bookSlot("${slot['id']}", _farmerName);
      final booking =
          (res['booking'] as Map?)?.cast<String, dynamic>() ?? const {};
      final status = "${res['status'] ?? booking['status'] ?? 'pending'}";
      final coins = (res['agriCoinsEarned'] as num?)?.toInt() ?? 0;
      setState(() {
        _myBookings.add({
          'bookingId': booking['id'],
          'slotId': slot['id'],
          'equipmentName': machine['name'],
          'date': date,
          'slotName': slot['slotName'],
          'priceRupees': slot['priceRupees'],
          'status': status,
        });
      });
      _snack("बुकिंग ${status == 'booked' ? 'कन्फर्म' : 'स्वीकृति लंबित'}! +$coins AgriCoins");
      _loadSlots();
    } on ApiException catch (e) {
      if (e.code == 'MAX_SLOTS_PER_DAY') {
        _snack(e.message.isNotEmpty ? e.message : e.code);
      } else if (e.code == 'SLOT_UNAVAILABLE') {
        _snack("स्लॉट अब उपलब्ध नहीं");
        _loadSlots();
      } else {
        _snack(e.message.isNotEmpty ? e.message : e.code);
      }
    }
  }

  Future<void> _cancel(Map<String, dynamic> slot) async {
    final booking = _myBookings.cast<Map<String, dynamic>?>().firstWhere(
          (b) => b?['slotId'] == slot['id'] && b?['status'] != 'rejected',
          orElse: () => null,
        );
    final bookingId = booking?['bookingId'];
    if (bookingId == null) {
      _snack("यह बुकिंग इस सत्र में नहीं बनी — कैंसिल जानकारी उपलब्ध नहीं");
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("बुकिंग रद्द करें?", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Text("${slot['slotName']} • ₹${(slot['priceRupees'] as num?)?.toInt() ?? 0}"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("वापस")),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("रद्द करें"),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.cancelBooking("$bookingId");
      setState(() => _myBookings.remove(booking));
      _snack("बुकिंग रद्द हुई");
      _loadSlots();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
      if (e.code == 'CANCEL_WINDOW_CLOSED') _loadSlots();
    }
  }

  Future<void> _waitlist(Map<String, dynamic> slot) async {
    try {
      await _api.joinWaitlist("${slot['id']}");
      _snack("वेटलिस्ट में जुड़ गए! कैंसिल होने पर सूचना मिलेगी।");
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  void _scrollToCalendar() {
    final ctx = _calendarKey.currentContext;
    if (ctx != null) {
      Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ListView(
        controller: _scrollCtrl,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Time-Slot Yantra Booking", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                  Text("Morning, Afternoon, Evening, Night Slots", style: TextStyle(fontSize: 11.5, color: Color(0xFF90A4AE))),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(8)),
                child: const Text("Max 2 Slots", style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32))),
              ),
            ],
          ),
          const SizedBox(height: 14),
          EquipmentCalendarSection(
            key: _calendarKey,
            machines: _machines,
            selectedMachineId: _selectedMachine?['id'] as String?,
            days: _days,
            dayIndex: _dayIndex,
            slots: _slots,
            loadingMachines: _loadingMachines,
            loadingSlots: _loadingSlots,
            isMine: _isMine,
            onSelectMachine: (m) {
              setState(() => _selectedMachine = m);
              _loadSlots();
            },
            onSelectDay: (i) {
              setState(() => _dayIndex = i);
              _loadSlots();
            },
            onBook: _book,
            onCancel: _cancel,
            onWaitlist: _waitlist,
          ),
          if (_myBookings.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text("मेरी बुकिंग", style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
            const SizedBox(height: 8),
            ..._myBookings.map(
              (b) => MyBookingCard(
                booking: b,
                onRebook: b['status'] == 'rejected' ? _scrollToCalendar : null,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
