// Vet Workspace — the claimed vet's home: appointments inbox, weekly
// schedule editor, patients (with prescriptions) and earnings.
// Contract: /v1/livestock/vets/me/* (backend/app/routers/livestock_vets.py).

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/vet_api.dart';
import '../../models/livestock_mgmt_models.dart';
import '../../state/app_state.dart';
import '../livestock/mgmt_widgets.dart';
import 'consultation_sheet.dart';

class VetHomeView extends StatefulWidget {
  final AppState state;
  final VetApi? api;

  const VetHomeView({super.key, required this.state, this.api});

  @override
  State<VetHomeView> createState() => _VetHomeViewState();
}

class _VetHomeViewState extends State<VetHomeView> {
  late final VetApi _api = widget.api ?? VetApi();

  int _tab = 0; // 0 appointments, 1 schedule, 2 patients, 3 earnings

  VetWorkspace? _workspace;
  bool _loadingWorkspace = true;
  String? _workspaceError;

  final MgmtAsyncData<List<Appointment>> _appointments = MgmtAsyncData();
  String _apptFilter = ''; // '' | 'today' | status
  final MgmtAsyncData<List<Prescription>> _prescriptions = MgmtAsyncData();
  final MgmtAsyncData<VetEarnings> _earnings = MgmtAsyncData();

  late List<ScheduleDay> _weeklySlots;
  late List<String> _leaves;
  late bool _emergency;
  late bool _tele;
  bool _savingSchedule = false;

  late String _month = _currentMonth();

  final Set<String> _busyIds = {};
  String _patientQuery = '';

  AppState get s => widget.state;

  static String _currentMonth() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}';
  }

  static String _today() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  @override
  void initState() {
    super.initState();
    _weeklySlots = const [];
    _leaves = const [];
    _emergency = false;
    _tele = false;
    _loadWorkspace();
  }

  Future<void> _loadWorkspace() async {
    setState(() {
      _loadingWorkspace = true;
      _workspaceError = null;
    });
    try {
      _workspace = await _api.getMyVetProfile();
      _applySchedule(_workspace!.schedule);
    } on ApiException catch (e) {
      _workspaceError = e.message.isNotEmpty ? e.message : e.code;
    } catch (e) {
      _workspaceError = e.toString();
    } finally {
      if (mounted) setState(() => _loadingWorkspace = false);
    }
    if (_workspace != null) await _refresh();
  }

  void _applySchedule(VetSchedule schedule) {
    _weeklySlots = schedule.weeklySlots
        .map((d) => ScheduleDay(day: d.day, slots: List.of(d.slots)))
        .toList();
    _leaves = List.of(schedule.leaves);
    _emergency = schedule.emergencyAvailable;
    _tele = schedule.teleAvailable;
  }

  Future<void> _load<T>(
    MgmtAsyncData<T> holder,
    Future<T> Function() call,
  ) async {
    holder
      ..loading = true
      ..error = null;
    try {
      holder.data = await call();
    } on ApiException catch (e) {
      holder.error = e.message.isNotEmpty ? e.message : e.code;
    } catch (e) {
      holder.error = e.toString();
    } finally {
      if (mounted) holder.loading = false;
    }
  }

  Future<void> _refresh() async {
    if (_workspace == null) return;
    await Future.wait([
      _load(_appointments, () => _api.getMyAppointments()),
      _load(_prescriptions, () => _api.listPrescriptions()),
      _load(_earnings, () => _api.getMyEarnings(month: _month)),
    ]);
    if (mounted) setState(() {});
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  bool _isBusy(String id) => _busyIds.contains(id);

  void _setBusy(String id, bool busy) {
    setState(() {
      if (busy) {
        _busyIds.add(id);
      } else {
        _busyIds.remove(id);
      }
    });
  }

  Future<void> _transition(
    Appointment appt,
    String status, {
    String cancelReason = '',
  }) async {
    final key = '${appt.id}-$status';
    _setBusy(key, true);
    try {
      await _api.updateAppointmentStatus(appt.id, {
        'status': status,
        if (cancelReason.isNotEmpty) 'cancelReason': cancelReason,
      });
      await _refresh();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    } finally {
      _setBusy(key, false);
    }
  }

  Future<String?> _askCancelReason() async {
    final ctrl = TextEditingController();
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(s.tr('livestock.vetHome.cancelReasonTitle')),
        content: TextField(
          controller: ctrl,
          decoration: InputDecoration(
            labelText: s.tr('livestock.vetHome.cancelReason'),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(s.tr('livestock.mgmt.cancel')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD32F2F),
            ),
            child: Text(
              s.tr('livestock.vetHome.cancelAction'),
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
    final reason = ctrl.text.trim();
    ctrl.dispose();
    return saved == true ? reason : null;
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingWorkspace) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8FAFC),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF00838F))),
      );
    }
    if (_workspace == null) {
      return _buildClaimPrompt();
    }
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          children: [
            _buildHeader(_workspace!),
            const SizedBox(height: 14),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Row(
                children: [
                  _tabChip(0, s.tr('livestock.vetHome.apptsTab'),
                      Icons.inbox_outlined),
                  _tabChip(1, s.tr('livestock.vetHome.scheduleTab'),
                      Icons.schedule_rounded),
                  _tabChip(2, s.tr('livestock.vetHome.patientsTab'),
                      Icons.pets_outlined),
                  _tabChip(3, s.tr('livestock.vetHome.earningsTab'),
                      Icons.currency_rupee_rounded),
                ],
              ),
            ),
            const SizedBox(height: 14),
            switch (_tab) {
              0 => _buildAppointmentsTab(),
              1 => _buildScheduleTab(),
              2 => _buildPatientsTab(),
              _ => _buildEarningsTab(),
            },
          ],
        ),
      ),
    );
  }

  Widget _buildClaimPrompt() {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0F7FA),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.medical_services_rounded,
                    color: Color(0xFF00838F), size: 44),
              ),
              const SizedBox(height: 16),
              Text(
                s.tr('livestock.vetHome.notClaimedTitle'),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 6),
              Text(
                _workspaceError ?? '',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 18),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00838F),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: _claim,
                icon: const Icon(Icons.verified_outlined, color: Colors.white),
                label: Text(
                  s.tr('livestock.vetHome.claimAction'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _claim() async {
    try {
      await _api.claimVetProfile();
      await widget.state.loadVetProfile();
      await _loadWorkspace();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  Widget _buildHeader(VetWorkspace w) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF00838F), Color(0xFF006064)],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.medical_services_rounded,
                  color: Colors.white, size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  s.tr('livestock.vetHome.workspaceTitle'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.refresh, color: Colors.white, size: 20),
                onPressed: _refresh,
              ),
            ],
          ),
          Text(
            '${w.vet.name}  •  ${s.tr('livestock.vetHome.totalAppts')}: ${w.totalAppointments}  •  ${s.tr('livestock.vetHome.monthEarnings')}: ₹${w.monthEarnings}'
            '${w.ratingAvg != null ? '  •  ★${w.ratingAvg} (${w.ratingCount})' : ''}',
            style: const TextStyle(color: Colors.white70, fontSize: 11.5),
          ),
        ],
      ),
    );
  }

  Widget _tabChip(int index, String label, IconData icon) {
    final selected = _tab == index;
    return GestureDetector(
      onTap: () => setState(() => _tab = index),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF00838F) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected ? const Color(0xFF00838F) : Colors.grey.shade300,
          ),
        ),
        child: Row(
          children: [
            Icon(icon,
                size: 15, color: selected ? Colors.white : Colors.grey.shade700),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                color: selected ? Colors.white : Colors.grey.shade800,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ------------------------------------------------------------------
  // Appointments inbox
  // ------------------------------------------------------------------

  static const _filters = [
    '',
    'today',
    'requested',
    'confirmed',
    'in-progress',
    'completed',
    'cancelled',
  ];

  Widget _buildAppointmentsTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: _filters
                .map(
                  (f) => GestureDetector(
                    onTap: () => setState(() => _apptFilter = f),
                    child: Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: _apptFilter == f
                            ? const Color(0xFF00838F)
                            : Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: _apptFilter == f
                              ? const Color(0xFF00838F)
                              : Colors.grey.shade300,
                        ),
                      ),
                      child: Text(
                        f.isEmpty
                            ? s.tr('livestock.gaushala.filterAll')
                            : f == 'today'
                                ? s.tr('livestock.vetHome.today')
                                : s.tr('livestock.vets.apptStatus.$f'),
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: _apptFilter == f
                              ? FontWeight.w800
                              : FontWeight.w600,
                          color: _apptFilter == f
                              ? Colors.white
                              : Colors.grey.shade700,
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
        const SizedBox(height: 12),
        MgmtAsyncView<List<Appointment>>(
          value: _appointments,
          emptyText: s.tr('livestock.vetHome.emptyAppointments'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (list) {
            final filtered = list.where((a) {
              if (_apptFilter == 'today') return a.slotDate == _today();
              if (_apptFilter.isNotEmpty) return a.status == _apptFilter;
              return true;
            }).toList();
            if (filtered.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Center(
                  child: Text(
                    s.tr('livestock.vetHome.emptyAppointments'),
                    style: const TextStyle(color: Colors.grey, fontSize: 12.5),
                  ),
                ),
              );
            }
            return Column(children: filtered.map(_appointmentCard).toList());
          },
        ),
      ],
    );
  }

  Widget _appointmentCard(Appointment a) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    a.farmerName,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ),
                MgmtStatusBadge.forStatus(a.status),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${a.slotDate} ${a.slotTime}  •  ${s.tr('livestock.vets.visitType.${a.visitType}')}  •  ₹${a.fee}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
            ),
            if (a.symptoms.isNotEmpty)
              Text(
                '${s.tr('livestock.vets.symptoms')}: ${a.symptoms}',
                style: const TextStyle(fontSize: 11.5),
              ),
            if (a.address.isNotEmpty)
              Text(
                '${s.tr('livestock.mgmt.address')}: ${a.address}',
                style: const TextStyle(fontSize: 11.5),
              ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: _actionButtons(a),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _actionButtons(Appointment a) {
    final buttons = <Widget>[];
    switch (a.status) {
      case 'requested':
        buttons.add(_actionBtn(a, 'confirmed', const Color(0xFF2E7D32)));
        buttons.add(_actionBtn(a, 'cancelled', const Color(0xFFD32F2F)));
      case 'confirmed':
        buttons.add(_actionBtn(a, 'in-progress', const Color(0xFF1565C0)));
        buttons.add(_actionBtn(a, 'cancelled', const Color(0xFFD32F2F)));
      case 'in-progress':
        buttons.add(_completeBtn(a));
    }
    return buttons;
  }

  Widget _actionBtn(Appointment a, String status, Color color) {
    final key = '${a.id}-$status';
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: TextButton(
        onPressed: _isBusy(key)
            ? null
            : () async {
                if (status == 'cancelled') {
                  final reason = await _askCancelReason();
                  if (reason == null) return;
                  await _transition(a, status, cancelReason: reason);
                } else {
                  await _transition(a, status);
                }
              },
        child: _isBusy(key)
            ? SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2, color: color),
              )
            : Text(
                s.tr('livestock.vetHome.action.$status'),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
      ),
    );
  }

  Widget _completeBtn(Appointment a) {
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF00838F),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        onPressed: () => ConsultationSheet.show(
          context,
          state: s,
          api: _api,
          appointment: a,
          onSaved: _refresh,
        ),
        icon: const Icon(Icons.receipt_long_outlined,
            color: Colors.white, size: 15),
        label: Text(
          s.tr('livestock.vetHome.action.completed'),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  // ------------------------------------------------------------------
  // Schedule editor
  // ------------------------------------------------------------------

  static const _dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  Widget _buildScheduleTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ...List.generate(7, (day) {
          final daySlots = _weeklySlots
              .where((d) => d.day == day)
              .expand((d) => d.slots)
              .toList();
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _dayNames[day],
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: () => _addSlot(day),
                        icon: const Icon(Icons.add, size: 15),
                        label: Text(s.tr('livestock.vetHome.addSlot')),
                      ),
                    ],
                  ),
                  if (daySlots.isEmpty)
                    Text(
                      s.tr('livestock.vetHome.noSlots'),
                      style:
                          TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
                    )
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: daySlots
                          .map(
                            (slot) => InputChip(
                              label: Text(
                                '${slot.start}–${slot.end}',
                                style: const TextStyle(fontSize: 11.5),
                              ),
                              onDeleted: () => _removeSlot(day, slot),
                              deleteIconColor: const Color(0xFFD32F2F),
                            ),
                          )
                          .toList(),
                    ),
                ],
              ),
            ),
          );
        }),
        const SizedBox(height: 8),
        Text(
          s.tr('livestock.vetHome.leaves'),
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 6),
        if (_leaves.isEmpty)
          Text(
            s.tr('livestock.vetHome.noLeaves'),
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: _leaves
                .map(
                  (leave) => Chip(
                    label: Text(leave, style: const TextStyle(fontSize: 11.5)),
                  ),
                )
                .toList(),
          ),
        TextButton.icon(
          onPressed: _addLeave,
          icon: const Icon(Icons.event_busy_outlined, size: 16),
          label: Text(s.tr('livestock.vetHome.addLeave')),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(s.tr('livestock.vetHome.emergencyToggle')),
          value: _emergency,
          onChanged: (v) => setState(() => _emergency = v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(s.tr('livestock.vetHome.teleToggle')),
          value: _tele,
          onChanged: (v) => setState(() => _tele = v),
        ),
        const SizedBox(height: 10),
        MgmtSaveButton(
          label: s.tr('livestock.mgmt.saveChanges'),
          saving: _savingSchedule,
          color: const Color(0xFF00838F),
          onPressed: _saveSchedule,
        ),
      ],
    );
  }

  Future<void> _addSlot(int day) async {
    final start = TextEditingController(text: '09:00');
    final end = TextEditingController(text: '12:00');
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
            '${s.tr('livestock.vetHome.addSlot')} — ${_dayNames[day]}'),
        content: Row(
          children: [
            Expanded(
              child: TextField(
                controller: start,
                decoration: InputDecoration(
                  labelText: s.tr('livestock.vetHome.slotStart'),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: end,
                decoration: InputDecoration(
                  labelText: s.tr('livestock.vetHome.slotEnd'),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(s.tr('livestock.mgmt.cancel')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00838F),
            ),
            child: Text(
              s.tr('livestock.mgmt.save'),
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
    if (saved == true) {
      setState(() {
        final existing = _weeklySlots.where((d) => d.day == day).toList();
        final slots = existing.isEmpty
            ? <ScheduleSlot>[]
            : List.of(existing.first.slots);
        slots.add(ScheduleSlot(start: start.text.trim(), end: end.text.trim()));
        _weeklySlots.removeWhere((d) => d.day == day);
        _weeklySlots.add(ScheduleDay(day: day, slots: slots));
        _weeklySlots.sort((a, b) => a.day.compareTo(b.day));
      });
    }
    start.dispose();
    end.dispose();
  }

  void _removeSlot(int day, ScheduleSlot slot) {
    setState(() {
      final dayEntry = _weeklySlots.where((d) => d.day == day).toList();
      if (dayEntry.isEmpty) return;
      final slots = List.of(dayEntry.first.slots)..remove(slot);
      _weeklySlots.removeWhere((d) => d.day == day);
      if (slots.isNotEmpty) {
        _weeklySlots.add(ScheduleDay(day: day, slots: slots));
        _weeklySlots.sort((a, b) => a.day.compareTo(b.day));
      }
    });
  }

  Future<void> _addLeave() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime(2035),
    );
    if (picked == null) return;
    final date =
        '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    try {
      final updated = await _api.updateMySchedule({
        'leaves': [date],
      });
      if (mounted) {
        setState(() => _applySchedule(updated));
        _snack(s.tr('livestock.vetHome.leaveAdded'));
      }
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  Future<void> _saveSchedule() async {
    setState(() => _savingSchedule = true);
    try {
      final updated = await _api.updateMySchedule({
        'weeklySlots':
            _weeklySlots.map((d) => d.toJson()).toList(),
        'emergencyAvailable': _emergency,
        'teleAvailable': _tele,
      });
      if (mounted) {
        setState(() => _applySchedule(updated));
        _snack(s.tr('livestock.vetHome.scheduleSaved'));
      }
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    } finally {
      if (mounted) setState(() => _savingSchedule = false);
    }
  }

  // ------------------------------------------------------------------
  // Patients
  // ------------------------------------------------------------------

  Widget _buildPatientsTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          decoration: InputDecoration(
            hintText: s.tr('livestock.vetHome.patientSearch'),
            prefixIcon: const Icon(Icons.search, size: 20),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
          onChanged: (v) => setState(() => _patientQuery = v.trim()),
        ),
        const SizedBox(height: 12),
        MgmtAsyncView<List<Appointment>>(
          value: _appointments,
          emptyText: s.tr('livestock.vetHome.emptyPatients'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (list) {
            final byAnimal = <String, Map<String, dynamic>>{};
            for (final a in list) {
              final key = a.animalId.isEmpty ? '—' : a.animalId;
              final entry = byAnimal.putIfAbsent(
                key,
                () => {
                  'farmerName': a.farmerName,
                  'animalId': key,
                  'count': 0,
                  'lastDate': '',
                },
              );
              entry['count'] = (entry['count'] as int) + 1;
              if ((a.slotDate).compareTo(entry['lastDate'] as String) > 0) {
                entry['lastDate'] = a.slotDate;
              }
            }
            var patients = byAnimal.values.toList()
              ..sort((a, b) =>
                  (b['lastDate'] as String).compareTo(a['lastDate'] as String));
            if (_patientQuery.isNotEmpty) {
              final q = _patientQuery.toLowerCase();
              patients = patients
                  .where(
                    (p) =>
                        (p['farmerName'] as String)
                            .toLowerCase()
                            .contains(q) ||
                        (p['animalId'] as String).toLowerCase().contains(q),
                  )
                  .toList();
            }
            if (patients.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Center(
                  child: Text(
                    s.tr('livestock.vetHome.emptyPatients'),
                    style: const TextStyle(color: Colors.grey, fontSize: 12.5),
                  ),
                ),
              );
            }
            return Column(
              children: patients
                  .map(
                    (p) => Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: ListTile(
                        dense: true,
                        leading: const Icon(Icons.pets_outlined,
                            color: Color(0xFF00838F)),
                        title: Text(
                          p['animalId'] as String,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        subtitle: Text(
                          '${p['farmerName']}  •  ${p['count']} ${s.tr('livestock.vetHome.visits')}  •  ${p['lastDate']}',
                          style: const TextStyle(fontSize: 11.5),
                        ),
                        trailing: const Icon(Icons.chevron_right, size: 18),
                        onTap: () => _showPatientRx(p['animalId'] as String),
                      ),
                    ),
                  )
                  .toList(),
            );
          },
        ),
      ],
    );
  }

  void _showPatientRx(String animalId) {
    final rx = (_prescriptions.data ?? const <Prescription>[])
        .where((p) => p.animalId == animalId)
        .toList();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => MgmtSheetFrame(
        state: s,
        icon: Icons.receipt_long_outlined,
        iconColor: const Color(0xFF00838F),
        title: '${s.tr('livestock.vetHome.prescriptions')} — $animalId',
        subtitle: s.tr('livestock.vetHome.prescriptionsSubtitle'),
        children: [
          if (rx.isEmpty)
            Text(
              s.tr('livestock.vetHome.noPrescriptions'),
              style: const TextStyle(fontSize: 12.5, color: Colors.grey),
            )
          else
            ...rx.map(
              (p) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.diagnosis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      ...p.medicines.map(
                        (m) => Text(
                          '• ${m.name} — ${m.dosage} ${m.frequency} ${s.tr('livestock.vetHome.forDays').replaceAll('{d}', '${m.durationDays}')}',
                          style: const TextStyle(fontSize: 11.5),
                        ),
                      ),
                      if (p.advice.isNotEmpty)
                        Text(
                          '${s.tr('livestock.vetRx.advice')}: ${p.advice}',
                          style: const TextStyle(fontSize: 11.5),
                        ),
                      if (p.milkWithdrawalDays > 0)
                        Text(
                          '${s.tr('livestock.vetRx.milkWithdrawal')}: ${p.milkWithdrawalDays}d',
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: Color(0xFFC62828),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      Text(
                        p.createdAt,
                        style:
                            const TextStyle(fontSize: 10.5, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ------------------------------------------------------------------
  // Earnings
  // ------------------------------------------------------------------

  Widget _buildEarningsTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(
              icon: const Icon(Icons.chevron_left),
              onPressed: () => _shiftMonth(-1),
            ),
            Text(
              _month,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
            ),
            IconButton(
              icon: const Icon(Icons.chevron_right),
              onPressed: () => _shiftMonth(1),
            ),
          ],
        ),
        MgmtAsyncView<VetEarnings>(
          value: _earnings,
          emptyText: s.tr('livestock.vetHome.emptyEarnings'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (e) => Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: _earningCard(
                      s.tr('livestock.vetHome.totalFees'),
                      '₹${e.totalEarnings}',
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _earningCard(
                      s.tr('livestock.vetHome.completedCount'),
                      '${e.completedAppointments}',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                s.tr('livestock.vetHome.appointmentList'),
                style:
                    const TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              ..._completedForMonth(),
            ],
          ),
        ),
      ],
    );
  }

  List<Widget> _completedForMonth() {
    final list = (_appointments.data ?? const <Appointment>[])
        .where((a) =>
            a.status == 'completed' &&
            (a.completedAt ?? a.updatedAt).startsWith(_month))
        .toList();
    if (list.isEmpty) {
      return [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 24),
          child: Center(
            child: Text(
              s.tr('livestock.vetHome.emptyEarnings'),
              style: const TextStyle(color: Colors.grey, fontSize: 12.5),
            ),
          ),
        ),
      ];
    }
    return list
        .map(
          (a) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: ListTile(
              dense: true,
              leading: const Icon(Icons.check_circle_outline,
                  color: Color(0xFF2E7D32)),
              title: Text(
                a.farmerName,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
              subtitle: Text(
                '${a.slotDate}  •  ${s.tr('livestock.vets.visitType.${a.visitType}')}',
                style: const TextStyle(fontSize: 11.5),
              ),
              trailing: Text(
                '₹${a.fee}',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF2E7D32),
                ),
              ),
            ),
          ),
        )
        .toList();
  }

  Widget _earningCard(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF00838F).withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: Color(0xFF00838F),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700),
          ),
        ],
      ),
    );
  }

  Future<void> _shiftMonth(int delta) async {
    final parts = _month.split('-').map(int.parse).toList();
    var year = parts[0];
    var month = parts[1] + delta;
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    while (month < 1) {
      month += 12;
      year -= 1;
    }
    _month =
        '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}';
    await _load(_earnings, () => _api.getMyEarnings(month: _month));
    if (mounted) setState(() {});
  }
}
