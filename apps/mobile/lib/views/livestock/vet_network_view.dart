// Vet Network — dairyManager workspace for the managed vet directory, the
// appointments board and vaccination campaigns.
// Contract: /v1/livestock/vets/*, /v1/livestock/appointments, /v1/livestock/vet/campaigns.

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/vet_api.dart';
import '../../models/livestock_mgmt_models.dart';
import '../../state/app_state.dart';
import 'mgmt_sheets_vets.dart';
import 'mgmt_widgets.dart';

class VetNetworkView extends StatefulWidget {
  final AppState state;
  final VetApi? api;

  const VetNetworkView({super.key, required this.state, this.api});

  @override
  State<VetNetworkView> createState() => _VetNetworkViewState();
}

class _VetNetworkViewState extends State<VetNetworkView> {
  late final VetApi _api = widget.api ?? VetApi();

  int _tab = 0; // 0 directory, 1 appointments, 2 campaigns

  final MgmtAsyncData<List<ManagedVet>> _vets = MgmtAsyncData();
  final MgmtAsyncData<List<Appointment>> _appointments = MgmtAsyncData();
  String _apptFilter = '';
  final MgmtAsyncData<List<VaccinationCampaign>> _campaigns = MgmtAsyncData();
  final Set<String> _busyIds = {};
  String? _expandedCampaignId;

  AppState get s => widget.state;

  @override
  void initState() {
    super.initState();
    _refresh();
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
    await Future.wait([
      _load(_vets, () => _api.listManagedVets()),
      _load(_appointments, () => _api.listMyAppointments()),
      _load(_campaigns, () => _api.listCampaigns()),
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

  @override
  Widget build(BuildContext context) {
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
            _buildHeader(),
            const SizedBox(height: 14),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Row(
                children: [
                  _tabChip(0, s.tr('livestock.vets.directoryTab'),
                      Icons.medical_services_outlined),
                  _tabChip(1, s.tr('livestock.vets.appointmentsTab'),
                      Icons.event_note_outlined),
                  _tabChip(2, s.tr('livestock.vets.campaignsTab'),
                      Icons.vaccines_rounded),
                ],
              ),
            ),
            const SizedBox(height: 14),
            switch (_tab) {
              0 => _buildDirectoryTab(),
              1 => _buildAppointmentsTab(),
              _ => _buildCampaignsTab(),
            },
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0284C7), Color(0xFF075985)],
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
                  s.tr('livestock.vets.networkTitle'),
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
            s.tr('livestock.vets.networkSubtitle'),
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
          color: selected ? const Color(0xFF0284C7) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected ? const Color(0xFF0284C7) : Colors.grey.shade300,
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
  // Directory
  // ------------------------------------------------------------------

  Widget _buildDirectoryTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: double.infinity,
          height: 44,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: () => VetOnboardSheet.show(
              context,
              state: s,
              api: _api,
              onSaved: _refresh,
            ),
            icon: const Icon(Icons.person_add_alt, color: Colors.white, size: 18),
            label: Text(
              s.tr('livestock.vets.onboardButton'),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        MgmtAsyncView<List<ManagedVet>>(
          value: _vets,
          emptyText: s.tr('livestock.vets.emptyVets'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (vets) => Column(children: vets.map(_vetCard).toList()),
        ),
      ],
    );
  }

  Widget _vetCard(ManagedVet v) {
    final inactive = v.status == 'inactive';
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
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0F2FE),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.medical_services_rounded,
                      color: Color(0xFF0284C7), size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        v.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        v.qualification.isEmpty
                            ? v.vetCouncilRegNo
                            : '${v.qualification}${v.vetCouncilRegNo.isNotEmpty ? '  •  ${v.vetCouncilRegNo}' : ''}',
                        style:
                            const TextStyle(fontSize: 11, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                if (v.claimed)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.verified,
                            size: 12, color: Color(0xFF2E7D32)),
                        const SizedBox(width: 4),
                        Text(
                          s.tr('livestock.vets.claimed'),
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF2E7D32),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${s.tr('livestock.vets.fees')}: ${s.tr('livestock.vets.visitType.clinic')} ₹${v.feeClinic}  •  ${s.tr('livestock.vets.visitType.farm')} ₹${v.feeFarm}  •  ${s.tr('livestock.vets.visitType.tele')} ₹${v.feeTele}',
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700),
            ),
            Text(
              '${v.specializations.join(', ')}${v.serviceDistricts.isNotEmpty ? '  •  ${v.serviceDistricts.join(', ')}' : ''}',
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: () => VetOnboardSheet.show(
                    context,
                    state: s,
                    api: _api,
                    existing: v,
                    onSaved: _refresh,
                  ),
                  icon: const Icon(Icons.edit_outlined, size: 15),
                  label: Text(s.tr('livestock.mgmt.edit')),
                ),
                if (!inactive)
                  TextButton(
                    onPressed: _isBusy(v.id)
                        ? null
                        : () => _deactivateVet(v),
                    child: _isBusy(v.id)
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFFD32F2F),
                            ),
                          )
                        : Text(
                            s.tr('livestock.vets.deactivate'),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFD32F2F),
                            ),
                          ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _deactivateVet(ManagedVet v) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(s.tr('livestock.vets.deactivateConfirm')),
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
              s.tr('livestock.mgmt.confirm'),
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    _setBusy(v.id, true);
    try {
      await _api.deactivateManagedVet(v.id);
      _snack(s.tr('livestock.vets.vetDeactivated'));
      await _refresh();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    } finally {
      _setBusy(v.id, false);
    }
  }

  // ------------------------------------------------------------------
  // Appointments board
  // ------------------------------------------------------------------

  static const _apptStatuses = [
    '',
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
            children: _apptStatuses
                .map(
                  (st) => GestureDetector(
                    onTap: () => setState(() => _apptFilter = st),
                    child: Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: _apptFilter == st
                            ? const Color(0xFF0284C7)
                            : Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: _apptFilter == st
                              ? const Color(0xFF0284C7)
                              : Colors.grey.shade300,
                        ),
                      ),
                      child: Text(
                        st.isEmpty
                            ? s.tr('livestock.gaushala.filterAll')
                            : s.tr('livestock.vets.apptStatus.$st'),
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: _apptFilter == st
                              ? FontWeight.w800
                              : FontWeight.w600,
                          color: _apptFilter == st
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
          emptyText: s.tr('livestock.vets.emptyAppointments'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (list) {
            final filtered = _apptFilter.isEmpty
                ? list
                : list.where((a) => a.status == _apptFilter).toList();
            if (filtered.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Center(
                  child: Text(
                    s.tr('livestock.vets.emptyAppointments'),
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
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${a.vetName} ↔ ${a.farmerName}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
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
                style: const TextStyle(fontSize: 11.5, color: Colors.black87),
              ),
          ],
        ),
      ),
    );
  }

  // ------------------------------------------------------------------
  // Campaigns
  // ------------------------------------------------------------------

  Widget _buildCampaignsTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: double.infinity,
          height: 44,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00838F),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: () => CampaignCreateSheet.show(
              context,
              state: s,
              api: _api,
              onSaved: _refresh,
            ),
            icon: const Icon(Icons.campaign_outlined, color: Colors.white, size: 18),
            label: Text(
              s.tr('livestock.vets.campaignNew'),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        MgmtAsyncView<List<VaccinationCampaign>>(
          value: _campaigns,
          emptyText: s.tr('livestock.vets.emptyCampaigns'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (list) =>
              Column(children: list.map(_campaignCard).toList()),
        ),
      ],
    );
  }

  Widget _campaignCard(VaccinationCampaign c) {
    final expanded = _expandedCampaignId == c.id;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: InkWell(
        onTap: () => _toggleCampaign(c.id),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      c.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  MgmtStatusBadge(
                    label: s.tr('livestock.vets.campaignStatus.${c.status}'),
                    color: switch (c.status) {
                      'active' => const Color(0xFF2E7D32),
                      'closed' => const Color(0xFFD32F2F),
                      _ => const Color(0xFF1565C0),
                    },
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${c.vaccine}${c.disease.isNotEmpty ? ' (${c.disease})' : ''}  •  ${c.fromDate} → ${c.toDate}',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
              ),
              if (c.targetDistricts.isNotEmpty)
                Text(
                  c.targetDistricts.join(', '),
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              if (expanded) ...[
                const Divider(height: 18),
                FutureBuilder<VaccinationCampaign>(
                  future: _api.getCampaign(c.id),
                  builder: (ctx, snap) {
                    if (snap.connectionState != ConnectionState.done) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Center(
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      );
                    }
                    if (snap.hasError) {
                      return Text(
                        s.tr('livestock.mgmt.loadFailed'),
                        style:
                            const TextStyle(fontSize: 12, color: Colors.grey),
                      );
                    }
                    final detail = snap.data!;
                    if (detail.enrollments.isEmpty) {
                      return Text(
                        s.tr('livestock.vets.emptyEnrollments'),
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      );
                    }
                    return Column(
                      children: detail.enrollments.map((enrollment) {
                        final vaccinated = enrollment.status == 'vaccinated';
                        return Row(
                          children: [
                            Expanded(
                              child: Text(
                                enrollment.animalId,
                                style: const TextStyle(fontSize: 12),
                              ),
                            ),
                            MgmtStatusBadge(
                              label: s.tr(vaccinated
                                  ? 'livestock.vets.enrollmentVaccinated'
                                  : 'livestock.vets.enrollmentEnrolled'),
                              color: vaccinated
                                  ? const Color(0xFF2E7D32)
                                  : const Color(0xFF1565C0),
                            ),
                            if (!vaccinated)
                              TextButton(
                                onPressed: _isBusy(enrollment.id)
                                    ? null
                                    : () => _markVaccinated(
                                        c.id, enrollment.animalId),
                                child: _isBusy(enrollment.id)
                                    ? const SizedBox(
                                        width: 14,
                                        height: 14,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : Text(
                                        s.tr(
                                            'livestock.vets.markVaccinated'),
                                        style: const TextStyle(
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                              ),
                          ],
                        );
                      }).toList(),
                    );
                  },
                ),
              ] else ...[
                const SizedBox(height: 4),
                Text(
                  '${s.tr('livestock.vets.enrollments')}: ${c.enrollmentCount}',
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _toggleCampaign(String id) async {
    setState(() =>
        _expandedCampaignId = _expandedCampaignId == id ? null : id);
  }

  Future<void> _markVaccinated(String campaignId, String animalId) async {
    final key = 'mv-$campaignId-$animalId';
    _setBusy(key, true);
    try {
      await _api.markVaccinated(campaignId, animalId);
      await _refresh();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    } finally {
      _setBusy(key, false);
    }
  }
}
