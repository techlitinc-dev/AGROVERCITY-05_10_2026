// Gaushala Console — dairyManager workspace for cattle inventory, adoptions,
// donations, expenses and the dashboard KPIs.
// Contract: /v1/livestock/gaushala/*.

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/livestock_mgmt_api.dart';
import '../../models/livestock_mgmt_models.dart';
import '../../state/app_state.dart';
import 'mgmt_sheets_gaushala.dart';
import 'mgmt_widgets.dart';

class GaushalaConsoleView extends StatefulWidget {
  final AppState state;
  final GaushalaMgmtApi? api;

  const GaushalaConsoleView({super.key, required this.state, this.api});

  @override
  State<GaushalaConsoleView> createState() => _GaushalaConsoleViewState();
}

class _GaushalaConsoleViewState extends State<GaushalaConsoleView> {
  late final GaushalaMgmtApi _api = widget.api ?? GaushalaMgmtApi();

  int _tab = 0; // 0 cattle, 1 adoptions, 2 donations, 3 expenses, 4 dashboard

  GaushalaProfile? _profile;
  bool _profileLoading = true;
  bool _profileMissing = false;

  final MgmtAsyncData<List<GaushalaCattle>> _cattle = MgmtAsyncData();
  String _cattleFilter = '';
  final MgmtAsyncData<List<MgmtAdoption>> _adoptions = MgmtAsyncData();
  String _adoptionFilter = '';
  final MgmtAsyncData<List<MgmtDonation>> _donations = MgmtAsyncData();
  String _donationFilter = '';
  final MgmtAsyncData<List<GaushalaExpense>> _expenses = MgmtAsyncData();
  final MgmtAsyncData<ExpenseSummary> _expenseSummary = MgmtAsyncData();
  final MgmtAsyncData<GaushalaDashboard> _dashboard = MgmtAsyncData();
  final Set<String> _busyIds = {};

  AppState get s => widget.state;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    setState(() {
      _profileLoading = true;
      _profileMissing = false;
    });
    try {
      _profile = await _api.getMyGaushala();
    } on ApiException catch (e) {
      if (e.statusCode == 404) {
        _profileMissing = true;
      } else {
        _profileMissing = true;
        _snack(e.message.isNotEmpty ? e.message : e.code);
      }
    } catch (_) {
      _profileMissing = true;
    } finally {
      if (mounted) setState(() => _profileLoading = false);
    }
    if (_profile != null) await _refresh();
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
    final profile = _profile;
    if (profile == null) return;
    await Future.wait([
      _load(_cattle, () => _api.listCattle()),
      _load(_adoptions, () => _api.listAdoptions(profile.id)),
      _load(_donations, () => _api.listDonations(profile.id)),
      _load(_expenses, () => _api.listExpenses()),
      _load(_expenseSummary, () => _api.expensesSummary()),
      _load(_dashboard, () => _api.dashboard()),
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
    if (_profileLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8FAFC),
        body: Center(child: CircularProgressIndicator(color: Color(0xFFEF6C00))),
      );
    }
    if (_profileMissing || _profile == null) {
      return _buildSetupPrompt();
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
            _buildHeader(_profile!),
            const SizedBox(height: 14),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Row(
                children: [
                  _tabChip(0, s.tr('livestock.gaushala.cattleTab'),
                      Icons.pets_outlined),
                  _tabChip(1, s.tr('livestock.gaushala.adoptionsTab'),
                      Icons.volunteer_activism_outlined),
                  _tabChip(2, s.tr('livestock.gaushala.donationsTab'),
                      Icons.handshake_outlined),
                  _tabChip(3, s.tr('livestock.gaushala.expensesTab'),
                      Icons.receipt_long_outlined),
                  _tabChip(4, s.tr('livestock.gaushala.dashboardTab'),
                      Icons.dashboard_outlined),
                ],
              ),
            ),
            const SizedBox(height: 14),
            switch (_tab) {
              0 => _buildCattleTab(),
              1 => _buildAdoptionsTab(),
              2 => _buildDonationsTab(),
              3 => _buildExpensesTab(),
              _ => _buildDashboardTab(),
            },
          ],
        ),
      ),
    );
  }

  Widget _buildSetupPrompt() {
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
                  color: const Color(0xFFFFF3E0),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.temple_hindu_rounded,
                    color: Color(0xFFEF6C00), size: 44),
              ),
              const SizedBox(height: 16),
              Text(
                s.tr('livestock.gaushala.setupTitle'),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 6),
              Text(
                s.tr('livestock.gaushala.setupSubtitle'),
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 18),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEF6C00),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: () => GaushalaProfileSheet.show(
                  context,
                  state: s,
                  api: _api,
                  onSaved: _init,
                ),
                icon: const Icon(Icons.add_business_outlined,
                    color: Colors.white),
                label: Text(
                  s.tr('livestock.gaushala.setupButton'),
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

  Widget _buildHeader(GaushalaProfile g) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFEF6C00), Color(0xFFE65100)],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.temple_hindu_rounded,
                  color: Colors.white, size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  g.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.edit_outlined,
                    color: Colors.white, size: 18),
                onPressed: () => GaushalaProfileSheet.show(
                  context,
                  state: s,
                  api: _api,
                  existing: g,
                  onSaved: _init,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.refresh, color: Colors.white, size: 20),
                onPressed: _refresh,
              ),
            ],
          ),
          Text(
            '${g.district}${g.capacity > 0 ? '  •  ${s.tr('livestock.gaushala.capacity')}: ${g.capacity}' : ''}'
            '${g.certifications.isNotEmpty ? '  •  ${g.certifications.keys.join(', ')}' : ''}',
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
          color: selected ? const Color(0xFFEF6C00) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected ? const Color(0xFFEF6C00) : Colors.grey.shade300,
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
  // Cattle
  // ------------------------------------------------------------------

  Widget _buildCattleTab() {
    final categories = (_cattle.data ?? const <GaushalaCattle>[])
        .map((c) => c.category)
        .toSet()
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (categories.isNotEmpty)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                _filterChip(
                  s.tr('livestock.gaushala.filterAll'),
                  _cattleFilter.isEmpty,
                  () => setState(() => _cattleFilter = ''),
                ),
                ...categories.map(
                  (c) => _filterChip(
                    c,
                    _cattleFilter == c,
                    () => setState(
                        () => _cattleFilter = _cattleFilter == c ? '' : c),
                  ),
                ),
              ],
            ),
          ),
        if (categories.isNotEmpty) const SizedBox(height: 12),
        MgmtAsyncView<List<GaushalaCattle>>(
          value: _cattle,
          emptyText: s.tr('livestock.gaushala.emptyCattle'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (list) {
            final filtered = _cattleFilter.isEmpty
                ? list
                : list.where((c) => c.category == _cattleFilter).toList();
            if (filtered.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Center(
                  child: Text(
                    s.tr('livestock.gaushala.emptyCattle'),
                    style: const TextStyle(color: Colors.grey, fontSize: 12.5),
                  ),
                ),
              );
            }
            return Column(children: filtered.map(_cattleCard).toList());
          },
        ),
      ],
    );
  }

  Widget _filterChip(String label, bool selected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFEF6C00) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? const Color(0xFFEF6C00) : Colors.grey.shade300,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            color: selected ? Colors.white : Colors.grey.shade700,
          ),
        ),
      ),
    );
  }

  Widget _cattleCard(GaushalaCattle c) {
    final deceased = c.cattleStatus == 'deceased';
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
                    color: deceased
                        ? const Color(0xFFFFEBEE)
                        : const Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    deceased ? Icons.heart_broken_outlined : Icons.pets_rounded,
                    color: deceased
                        ? const Color(0xFFD32F2F)
                        : const Color(0xFF2E7D32),
                    size: 18,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        '${c.tagId}  •  ${c.species} (${c.breed})',
                        style:
                            const TextStyle(fontSize: 11, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF3E0),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        c.category,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFEF6C00),
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    MgmtStatusBadge.forStatus(c.cattleStatus),
                  ],
                ),
              ],
            ),
            if (c.events.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...c.events
                  .take(3)
                  .map(
                    (e) => Text(
                      '• ${s.tr('livestock.gaushala.event.${e.type}')}: ${e.date}${e.note.isNotEmpty ? ' — ${e.note}' : ''}',
                      style:
                          TextStyle(fontSize: 11, color: Colors.grey.shade600),
                    ),
                  ),
            ],
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => CattleEventSheet.show(
                  context,
                  state: s,
                  api: _api,
                  cattle: c,
                  onSaved: _refresh,
                ),
                icon: const Icon(Icons.event_note_outlined, size: 15),
                label: Text(s.tr('livestock.gaushala.addEvent')),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ------------------------------------------------------------------
  // Adoptions
  // ------------------------------------------------------------------

  Widget _buildAdoptionsTab() {
    const statuses = ['', 'active', 'approved', 'completed', 'rejected'];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: statuses
                .map(
                  (st) => _filterChip(
                    st.isEmpty
                        ? s.tr('livestock.gaushala.filterAll')
                        : s.tr('livestock.gaushala.adoptionStatus.$st'),
                    _adoptionFilter == st,
                    () => setState(() => _adoptionFilter = st),
                  ),
                )
                .toList(),
          ),
        ),
        const SizedBox(height: 12),
        MgmtAsyncView<List<MgmtAdoption>>(
          value: _adoptions,
          emptyText: s.tr('livestock.gaushala.emptyAdoptions'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (list) {
            final filtered = _adoptionFilter.isEmpty
                ? list
                : list.where((a) => a.status == _adoptionFilter).toList();
            if (filtered.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Center(
                  child: Text(
                    s.tr('livestock.gaushala.emptyAdoptions'),
                    style: const TextStyle(color: Colors.grey, fontSize: 12.5),
                  ),
                ),
              );
            }
            return Column(children: filtered.map(_adoptionCard).toList());
          },
        ),
      ],
    );
  }

  Widget _adoptionCard(MgmtAdoption a) {
    final allowed = switch (a.status) {
      'active' => const ['approved', 'rejected'],
      'approved' => const ['completed', 'rejected'],
      _ => const <String>[],
    };
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
                    a.donorName,
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
              '${a.cowName} (${a.cowTagId})  •  ${a.tier}  •  ₹${a.amountInr} (${a.billingCycle})',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
            ),
            Text(
              '${a.donorPhone}${a.donorCity.isNotEmpty ? '  •  ${a.donorCity}' : ''}'
              '${a.certificateNumber.isNotEmpty ? '  •  ${s.tr('livestock.gaushala.receiptCert')}: ${a.certificateNumber}' : ''}',
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
            if (allowed.isNotEmpty)
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: allowed
                    .map(
                      (next) => Padding(
                        padding: const EdgeInsets.only(left: 8),
                        child: _actionButton(
                          id: '${a.id}-$next',
                          label: s
                              .tr('livestock.gaushala.adoptionAction.$next'),
                          color: next == 'rejected'
                              ? const Color(0xFFD32F2F)
                              : const Color(0xFF2E7D32),
                          onPressed: () => _setAdoptionStatus(a, next),
                        ),
                      ),
                    )
                    .toList(),
              ),
          ],
        ),
      ),
    );
  }

  Widget _actionButton({
    required String id,
    required String label,
    required Color color,
    required Future<void> Function() onPressed,
  }) {
    final busy = _isBusy(id);
    return TextButton(
      onPressed: busy ? null : () async {
        _setBusy(id, true);
        try {
          await onPressed();
        } finally {
          _setBusy(id, false);
        }
      },
      child: busy
          ? SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(strokeWidth: 2, color: color),
            )
          : Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
    );
  }

  Future<void> _setAdoptionStatus(MgmtAdoption a, String status) async {
    try {
      final res = await _api.updateAdoptionStatus(a.id, status);
      final receiptJson = res['receipt'];
      await _refresh();
      if (receiptJson is Map) {
        if (!mounted) return;
        ReceiptDialog.show(
          context,
          state: s,
          receipt:
              Receipt.fromJson(receiptJson.cast<String, dynamic>()),
        );
      }
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  // ------------------------------------------------------------------
  // Donations
  // ------------------------------------------------------------------

  Widget _buildDonationsTab() {
    const statuses = ['', 'received', 'acknowledged', 'rejected'];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: statuses
                .map(
                  (st) => _filterChip(
                    st.isEmpty
                        ? s.tr('livestock.gaushala.filterAll')
                        : s.tr('livestock.gaushala.donationStatus.$st'),
                    _donationFilter == st,
                    () => setState(() => _donationFilter = st),
                  ),
                )
                .toList(),
          ),
        ),
        const SizedBox(height: 12),
        MgmtAsyncView<List<MgmtDonation>>(
          value: _donations,
          emptyText: s.tr('livestock.gaushala.emptyDonations'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (list) {
            final filtered = _donationFilter.isEmpty
                ? list
                : list.where((d) => d.status == _donationFilter).toList();
            if (filtered.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Center(
                  child: Text(
                    s.tr('livestock.gaushala.emptyDonations'),
                    style: const TextStyle(color: Colors.grey, fontSize: 12.5),
                  ),
                ),
              );
            }
            return Column(children: filtered.map(_donationCard).toList());
          },
        ),
      ],
    );
  }

  Widget _donationCard(MgmtDonation d) {
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
                    d.donorName,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ),
                MgmtStatusBadge.forStatus(d.status),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${s.tr('livestock.gaushala.donationType.${d.donationType}')}: ${d.quantityDescription}  •  ₹${d.amountInr}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
            ),
            Text(
              '${d.donorPhone}  •  ${s.tr('livestock.gaushala.receiptCert')}: ${d.receiptNumber}',
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                _actionButton(
                  id: '${d.id}-acknowledged',
                  label: s.tr('livestock.gaushala.donationAction.acknowledged'),
                  color: const Color(0xFF2E7D32),
                  onPressed: () => _setDonationStatus(d, 'acknowledged'),
                ),
                const SizedBox(width: 8),
                _actionButton(
                  id: '${d.id}-rejected',
                  label: s.tr('livestock.gaushala.donationAction.rejected'),
                  color: const Color(0xFFD32F2F),
                  onPressed: () => _setDonationStatus(d, 'rejected'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _setDonationStatus(MgmtDonation d, String status) async {
    try {
      final res = await _api.updateDonationStatus(d.id, status);
      final receiptJson = res['receipt'];
      await _refresh();
      if (receiptJson is Map) {
        if (!mounted) return;
        ReceiptDialog.show(
          context,
          state: s,
          receipt:
              Receipt.fromJson(receiptJson.cast<String, dynamic>()),
        );
      }
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  // ------------------------------------------------------------------
  // Expenses
  // ------------------------------------------------------------------

  Widget _buildExpensesTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MgmtAsyncView<ExpenseSummary>(
          value: _expenseSummary,
          emptyText: '',
          isEmpty: (_) => false,
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (summary) => Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFEBEE),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '${s.tr('livestock.gaushala.expenseSummary')}: ₹${summary.total} (${summary.count})'
              '${summary.byCategory.isNotEmpty ? '  •  ${summary.byCategory.entries.map((e) => '${s.tr('livestock.gaushala.expCat.${e.key}')}: ₹${e.value}').join(', ')}' : ''}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFFC62828),
              ),
            ),
          ),
        ),
        SizedBox(
          width: double.infinity,
          height: 44,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFC62828),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: () => ExpenseSheet.show(
              context,
              state: s,
              api: _api,
              onSaved: _refresh,
            ),
            icon: const Icon(Icons.add, color: Colors.white, size: 18),
            label: Text(
              s.tr('livestock.gaushala.expenseNew'),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        MgmtAsyncView<List<GaushalaExpense>>(
          value: _expenses,
          emptyText: s.tr('livestock.gaushala.emptyExpenses'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (list) => Column(
            children: list
                .map(
                  (e) => Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: ListTile(
                      dense: true,
                      leading: const Icon(Icons.receipt_long_outlined,
                          color: Color(0xFFC62828)),
                      title: Text(
                        '${s.tr('livestock.gaushala.expCat.${e.category}')} — ₹${e.amount}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      subtitle: Text(
                        '${e.expenseDate}${e.note.isNotEmpty ? '  •  ${e.note}' : ''}',
                        style: const TextStyle(fontSize: 11.5),
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit_outlined, size: 16),
                            onPressed: () => ExpenseSheet.show(
                              context,
                              state: s,
                              api: _api,
                              existing: e,
                              onSaved: _refresh,
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline,
                                size: 16, color: Color(0xFFD32F2F)),
                            onPressed: () => _deleteExpense(e),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
      ],
    );
  }

  Future<void> _deleteExpense(GaushalaExpense e) async {
    try {
      await _api.deleteExpense(e.id);
      _snack(s.tr('livestock.gaushala.expenseDeleted'));
      await _refresh();
    } on ApiException catch (ex) {
      _snack(ex.message.isNotEmpty ? ex.message : ex.code);
    }
  }

  // ------------------------------------------------------------------
  // Dashboard
  // ------------------------------------------------------------------

  Widget _buildDashboardTab() {
    return MgmtAsyncView<GaushalaDashboard>(
      value: _dashboard,
      emptyText: s.tr('livestock.gaushala.emptyDashboard'),
      retryLabel: s.tr('livestock.mgmt.retry'),
      onRetry: _refresh,
      builder: (d) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.6,
            children: [
              _kpiCard(s.tr('livestock.gaushala.kpiHeadcount'), '${d.headcount}',
                  Icons.pets_rounded, const Color(0xFF2E7D32)),
              _kpiCard(
                  s.tr('livestock.gaushala.kpiAdoptions'),
                  '${d.activeAdoptions}',
                  Icons.volunteer_activism_rounded,
                  const Color(0xFFEF6C00)),
              _kpiCard(
                  s.tr('livestock.gaushala.kpiDonations'),
                  '₹${d.donationsMonthTotal}',
                  Icons.handshake_rounded,
                  const Color(0xFF1565C0)),
              _kpiCard(
                  s.tr('livestock.gaushala.kpiExpenses'),
                  '₹${d.expensesMonthTotal}',
                  Icons.receipt_long_rounded,
                  const Color(0xFFC62828)),
            ],
          ),
          const SizedBox(height: 14),
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    s.tr('livestock.gaushala.kpiOccupancy'),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: d.capacity > 0
                          ? (d.occupancy / d.capacity).clamp(0.0, 1.0)
                          : 0,
                      minHeight: 10,
                      backgroundColor: Colors.grey.shade200,
                      color: const Color(0xFFEF6C00),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    d.capacity > 0
                        ? '${d.occupancy} / ${d.capacity} (${d.occupancyPercent ?? 0}%)'
                        : '${d.occupancy} / —',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    s.tr('livestock.gaushala.kpiByCategory'),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (d.byCategory.isEmpty)
                    Text(
                      s.tr('livestock.gaushala.emptyDashboard'),
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    )
                  else
                    ...d.byCategory.entries.map(
                      (e) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                e.key,
                                style: const TextStyle(fontSize: 12.5),
                              ),
                            ),
                            Text(
                              '${e.value}',
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _kpiCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
          Text(
            label,
            style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
          ),
        ],
      ),
    );
  }
}
