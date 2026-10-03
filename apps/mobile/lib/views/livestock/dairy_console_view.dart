// Dairy Console — dairyManager workspace for members, rate charts, payment
// batches, milk sales and stock. Contract: /v1/livestock/dairy/*.

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/livestock_mgmt_api.dart';
import '../../models/livestock_mgmt_models.dart';
import '../../state/app_state.dart';
import 'mgmt_sheets_dairy.dart';
import 'mgmt_widgets.dart';

class DairyConsoleView extends StatefulWidget {
  final AppState state;
  final DairyMgmtApi? api;

  const DairyConsoleView({super.key, required this.state, this.api});

  @override
  State<DairyConsoleView> createState() => _DairyConsoleViewState();
}

class _DairyConsoleViewState extends State<DairyConsoleView> {
  late final DairyMgmtApi _api = widget.api ?? DairyMgmtApi();

  int _tab = 0; // 0 members, 1 rate chart, 2 payments, 3 sales, 4 stock

  final MgmtAsyncData<List<DairyMember>> _members = MgmtAsyncData();
  final MgmtAsyncData<List<RateChart>> _charts = MgmtAsyncData();
  final MgmtAsyncData<List<PaymentBatch>> _batches = MgmtAsyncData();
  final MgmtAsyncData<List<MilkSaleCustomer>> _customers = MgmtAsyncData();
  final MgmtAsyncData<List<MilkSaleOrder>> _orders = MgmtAsyncData();
  final MgmtAsyncData<MilkSalesSummary> _salesSummary = MgmtAsyncData();
  final MgmtAsyncData<List<StockItem>> _stock = MgmtAsyncData();

  String? _selectedBatchId;

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
      _load(_members, () => _api.listMembers()),
      _load(_charts, () => _api.listRateChartVersions()),
      _load(_batches, () => _api.listPaymentBatches()),
      _load(_customers, () => _api.listSaleCustomers()),
      _load(_orders, () => _api.listSaleOrders()),
      _load(_salesSummary, () => _api.salesSummary()),
      _load(_stock, () => _api.listStockItems()),
    ]);
    if (mounted) setState(() {});
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  void _err(ApiException e) =>
      _snack(e.message.isNotEmpty ? e.message : e.code);

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
                  _tabChip(0, s.tr('livestock.mgmt.membersTab'),
                      Icons.group_outlined),
                  _tabChip(1, s.tr('livestock.mgmt.rateChartTab'),
                      Icons.currency_rupee_rounded),
                  _tabChip(2, s.tr('livestock.mgmt.paymentsTab'),
                      Icons.payments_outlined),
                  _tabChip(3, s.tr('livestock.mgmt.salesTab'),
                      Icons.local_shipping_outlined),
                  _tabChip(4, s.tr('livestock.mgmt.stockTab'),
                      Icons.inventory_2_outlined),
                ],
              ),
            ),
            const SizedBox(height: 14),
            switch (_tab) {
              0 => _buildMembersTab(),
              1 => _buildRateChartTab(),
              2 => _buildPaymentsTab(),
              3 => _buildSalesTab(),
              _ => _buildStockTab(),
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
          colors: [Color(0xFF0288D1), Color(0xFF01579B)],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.water_drop_rounded,
                  color: Colors.white, size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  s.tr('livestock.mgmt.consoleTitle'),
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
            s.tr('livestock.mgmt.consoleSubtitle'),
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
          color: selected ? const Color(0xFF0288D1) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected ? const Color(0xFF0288D1) : Colors.grey.shade300,
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
  // Members
  // ------------------------------------------------------------------

  Widget _buildMembersTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: double.infinity,
          height: 44,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0288D1),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: () => MemberEditSheet.show(
              context,
              state: s,
              api: _api,
              onSaved: _refresh,
            ),
            icon: const Icon(Icons.person_add_alt, color: Colors.white, size: 18),
            label: Text(
              s.tr('livestock.mgmt.addMember'),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        MgmtAsyncView<List<DairyMember>>(
          value: _members,
          emptyText: s.tr('livestock.mgmt.emptyMembers'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (members) => Column(
            children: members.map((m) => _memberCard(m)).toList(),
          ),
        ),
      ],
    );
  }

  Widget _memberCard(DairyMember m) {
    final inactive = m.status != 'active';
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
                    color: const Color(0xFFE3F2FD),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.badge_outlined,
                      color: Color(0xFF0288D1), size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        m.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        '${s.tr('livestock.mgmt.memberCode')}: ${m.memberCode}',
                        style:
                            const TextStyle(fontSize: 11, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                MgmtStatusBadge.forStatus(m.status),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${s.tr('livestock.mgmt.village')}: ${m.village.isEmpty ? '—' : m.village}  •  ${s.tr('livestock.mgmt.phone')}: ${m.phone.isEmpty ? '—' : m.phone}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
            ),
            Text(
              '${s.tr('livestock.mgmt.defaultSpecies')}: ${m.defaultSpecies}  •  ${s.tr('livestock.mgmt.deduction')}: ₹${m.deduction}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: () => MemberEditSheet.show(
                    context,
                    state: s,
                    api: _api,
                    existing: m,
                    onSaved: _refresh,
                  ),
                  icon: const Icon(Icons.edit_outlined, size: 15),
                  label: Text(s.tr('livestock.mgmt.edit')),
                ),
                if (!inactive)
                  TextButton.icon(
                    onPressed: () => _deactivateMember(m),
                    icon: const Icon(Icons.block_outlined,
                        size: 15, color: Color(0xFFD32F2F)),
                    label: Text(
                      s.tr('livestock.mgmt.deactivate'),
                      style: const TextStyle(color: Color(0xFFD32F2F)),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _deactivateMember(DairyMember m) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(s.tr('livestock.mgmt.deactivateConfirm')),
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
    try {
      await _api.deactivateMember(m.id);
      _snack(s.tr('livestock.mgmt.memberDeactivated'));
      await _refresh();
    } on ApiException catch (e) {
      _err(e);
    }
  }

  // ------------------------------------------------------------------
  // Rate chart
  // ------------------------------------------------------------------

  Widget _buildRateChartTab() {
    final charts = _charts.data ?? const <RateChart>[];
    final activeCharts =
        charts.where((c) => c.active).toList(growable: false);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: double.infinity,
          height: 44,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2E7D32),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: () => RateChartSheet.show(
              context,
              state: s,
              api: _api,
              onSaved: _refresh,
            ),
            icon: const Icon(Icons.add_chart, color: Colors.white, size: 18),
            label: Text(
              s.tr('livestock.mgmt.newRateChart'),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        MgmtAsyncView<List<RateChart>>(
          value: _charts,
          emptyText: s.tr('livestock.mgmt.emptyRateCharts'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (list) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (activeCharts.isNotEmpty) ...[
                Text(
                  s.tr('livestock.mgmt.activeNow'),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                ...activeCharts.map(_rateChartCard),
                const SizedBox(height: 14),
              ],
              Text(
                s.tr('livestock.mgmt.versions'),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              ...list.where((c) => !c.active).map(_rateChartCard),
            ],
          ),
        ),
      ],
    );
  }

  Widget _rateChartCard(RateChart c) {
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
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: c.species == 'cow'
                        ? const Color(0xFFE8F5E9)
                        : const Color(0xFFECEFF1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    c.species.toUpperCase(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: c.species == 'cow'
                          ? const Color(0xFF2E7D32)
                          : const Color(0xFF455A64),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${s.tr('livestock.mgmt.baseRate')}: ₹${c.baseRate}/L',
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                if (c.active)
                  MgmtStatusBadge(
                    label: s.tr('livestock.mgmt.statusActive'),
                    color: const Color(0xFF2E7D32),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              '${s.tr('livestock.mgmt.effectiveFrom')}: ${c.effectiveFrom}  •  FAT ${c.fatBase} (+₹${c.fatStep})  •  SNF ${c.snfBase} (+₹${c.snfStep})',
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700),
            ),
            Text(
              '${s.tr('livestock.mgmt.minRate')}: ₹${c.minRate}  •  ${s.tr('livestock.mgmt.minFat')}: ${c.minFat}  •  ${s.tr('livestock.mgmt.minSnf')}: ${c.minSnf}',
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => RateChartSheet.show(
                  context,
                  state: s,
                  api: _api,
                  existing: c,
                  onSaved: _refresh,
                ),
                icon: const Icon(Icons.edit_outlined, size: 15),
                label: Text(s.tr('livestock.mgmt.edit')),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ------------------------------------------------------------------
  // Payments
  // ------------------------------------------------------------------

  Widget _buildPaymentsTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: double.infinity,
          height: 44,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1565C0),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: () => BatchGenerateSheet.show(
              context,
              state: s,
              api: _api,
              onSaved: _refresh,
            ),
            icon: const Icon(Icons.playlist_add, color: Colors.white, size: 18),
            label: Text(
              s.tr('livestock.mgmt.batchGenerateBtn'),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        MgmtAsyncView<List<PaymentBatch>>(
          value: _batches,
          emptyText: s.tr('livestock.mgmt.emptyBatches'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (batches) => Column(
            children: [
              ...batches.map(_batchCard),
              if (_selectedBatchId != null)
                _batchDetail(batches.firstWhere(
                  (b) => b.id == _selectedBatchId,
                  orElse: () => batches.first,
                )),
            ],
          ),
        ),
      ],
    );
  }

  Widget _batchCard(PaymentBatch b) {
    final selected = _selectedBatchId == b.id;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: selected ? const Color(0xFF1565C0) : Colors.transparent,
          width: 1.4,
        ),
      ),
      child: InkWell(
        onTap: () => setState(() => _selectedBatchId = selected ? null : b.id),
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
                      '${b.periodFrom} → ${b.periodTo}',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13.5,
                      ),
                    ),
                  ),
                  MgmtStatusBadge.forStatus(b.status),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                '${s.tr('livestock.mgmt.liters')}: ${b.totalLiters} L  •  ${s.tr('livestock.mgmt.netAmount')}: ₹${b.totalNet}  (${b.entries.length} entries)',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _batchDetail(PaymentBatch b) {
    return Card(
      color: const Color(0xFFEFF6FF),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  s.tr('livestock.mgmt.batchEntries'),
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (b.status != 'paid')
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2E7D32),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    onPressed: () => MarkPaidSheet.show(
                              context,
                              state: s,
                              api: _api,
                              batch: b,
                              onSaved: _refresh,
                            ),
                    icon: const Icon(Icons.verified_outlined,
                        color: Colors.white, size: 16),
                    label: Text(
                      s.tr('livestock.mgmt.markPaid'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowHeight: 32,
                dataRowMinHeight: 30,
                dataRowMaxHeight: 36,
                columns: [
                  DataColumn(label: Text(s.tr('livestock.mgmt.memberLabel'))),
                  DataColumn(
                      label: Text(s.tr('livestock.mgmt.liters')),
                      numeric: true),
                  DataColumn(
                      label: Text(s.tr('livestock.mgmt.amount')),
                      numeric: true),
                  DataColumn(
                      label: Text(s.tr('livestock.mgmt.deduction'))),
                  DataColumn(
                      label: Text(s.tr('livestock.mgmt.netAmount')),
                      numeric: true),
                  DataColumn(label: Text(s.tr('livestock.mgmt.status'))),
                ],
                rows: b.entries
                    .map(
                      (e) => DataRow(cells: [
                        DataCell(Text(e.memberName,
                            style: const TextStyle(fontSize: 12))),
                        DataCell(Text('${e.liters}',
                            style: const TextStyle(fontSize: 12))),
                        DataCell(Text('₹${e.amount}',
                            style: const TextStyle(fontSize: 12))),
                        DataCell(Text('₹${e.deduction}',
                            style: const TextStyle(fontSize: 12))),
                        DataCell(Text('₹${e.netAmount}',
                            style: const TextStyle(fontSize: 12))),
                        DataCell(MgmtStatusBadge.forStatus(e.status)),
                      ]),
                    )
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ------------------------------------------------------------------
  // Sales
  // ------------------------------------------------------------------

  static const _orderNext = {
    'scheduled': 'delivered',
    'delivered': 'billed',
    'billed': 'paid',
  };

  Widget _buildSalesTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEF6C00),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: () => SaleCustomerSheet.show(
                  context,
                  state: s,
                  api: _api,
                  onSaved: _refresh,
                ),
                icon: const Icon(Icons.person_add_alt,
                    color: Colors.white, size: 16),
                label: Text(
                  s.tr('livestock.mgmt.addCustomer'),
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFE65100),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: _customers.data == null ||
                        _customers.data!.isEmpty
                    ? null
                    : () => SaleOrderSheet.show(
                          context,
                          state: s,
                          api: _api,
                          customers: _customers.data!,
                          onSaved: _refresh,
                        ),
                icon: const Icon(Icons.add_shopping_cart,
                    color: Colors.white, size: 16),
                label: Text(
                  s.tr('livestock.mgmt.addOrder'),
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        MgmtAsyncView<MilkSalesSummary>(
          value: _salesSummary,
          emptyText: '',
          isEmpty: (d) => false,
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (summary) => Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E0),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '${s.tr('livestock.mgmt.summaryHeader')}: ${summary.totalOrders}  •  ${summary.totalLiters} L  •  ₹${summary.totalAmount}  •  ${s.tr('livestock.mgmt.collected')}: ₹${summary.collectedAmount}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFFEF6C00),
              ),
            ),
          ),
        ),
        MgmtAsyncView<List<MilkSaleCustomer>>(
          value: _customers,
          emptyText: s.tr('livestock.mgmt.emptyCustomers'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (customers) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${s.tr('livestock.mgmt.customersTab')} (${customers.length})',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              ...customers.map(_customerCard),
            ],
          ),
        ),
        const SizedBox(height: 14),
        MgmtAsyncView<List<MilkSaleOrder>>(
          value: _orders,
          emptyText: s.tr('livestock.mgmt.emptyOrders'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (orders) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${s.tr('livestock.mgmt.ordersTab')} (${orders.length})',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              ...orders.map(_orderCard),
            ],
          ),
        ),
      ],
    );
  }

  Widget _customerCard(MilkSaleCustomer c) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        dense: true,
        leading: const Icon(Icons.storefront_outlined,
            color: Color(0xFFEF6C00)),
        title: Text(
          '${c.name} (${s.tr('livestock.mgmt.type.${c.type}')})',
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
        ),
        subtitle: Text(
          '₹${c.ratePerLiter}/L  •  ${s.tr('livestock.mgmt.dailyLitersShort')}: ${c.dailyLitersAM}+${c.dailyLitersPM} L',
          style: const TextStyle(fontSize: 11.5),
        ),
        trailing: IconButton(
          icon: const Icon(Icons.edit_outlined, size: 16),
          onPressed: () => SaleCustomerSheet.show(
            context,
            state: s,
            api: _api,
            existing: c,
            onSaved: _refresh,
          ),
        ),
      ),
    );
  }

  Widget _orderCard(MilkSaleOrder o) {
    final next = _orderNext[o.status];
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
                    '${o.customerName} • ${o.orderDate} (${o.shift.toUpperCase()})',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                MgmtStatusBadge.forStatus(o.status),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${o.liters} L  •  ${s.tr('livestock.mgmt.amount')}: ₹${o.amount}'
              '${o.items.isNotEmpty ? '  •  ${o.items.length} items' : ''}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
            ),
            if (next != null)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => _advanceOrder(o, next),
                  child: Text(
                    '${s.tr('livestock.mgmt.advance')} → ${s.tr('livestock.mgmt.orderStatus.$next')}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _advanceOrder(MilkSaleOrder o, String next) async {
    try {
      await _api.updateSaleOrderStatus(o.id, next);
      await _refresh();
    } on ApiException catch (e) {
      _err(e);
    }
  }

  // ------------------------------------------------------------------
  // Stock
  // ------------------------------------------------------------------

  Widget _buildStockTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: double.infinity,
          height: 44,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6A1B9A),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: () => StockItemSheet.show(
              context,
              state: s,
              api: _api,
              onSaved: _refresh,
            ),
            icon: const Icon(Icons.add_box_outlined,
                color: Colors.white, size: 18),
            label: Text(
              s.tr('livestock.mgmt.addStockItem'),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        MgmtAsyncView<List<StockItem>>(
          value: _stock,
          emptyText: s.tr('livestock.mgmt.emptyStock'),
          retryLabel: s.tr('livestock.mgmt.retry'),
          onRetry: _refresh,
          builder: (items) => GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.35,
            ),
            itemCount: items.length,
            itemBuilder: (ctx, i) => _stockCard(items[i]),
          ),
        ),
      ],
    );
  }

  Widget _stockCard(StockItem item) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    item.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF3E5F5),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    s.tr('livestock.mgmt.cat.${item.category}'),
                    style: const TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF6A1B9A),
                    ),
                  ),
                ),
              ],
            ),
            const Spacer(),
            Text(
              '${item.stockQty} ${item.unit}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                color: Color(0xFF6A1B9A),
              ),
            ),
            Text(
              '₹${item.unitPrice}/${item.unit}'
              '${item.expiryDate.isNotEmpty ? '  •  ${item.expiryDate}' : ''}',
              style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => StockAdjustSheet.show(
                  context,
                  state: s,
                  api: _api,
                  item: item,
                  onSaved: _refresh,
                ),
                child: Text(
                  s.tr('livestock.mgmt.adjust'),
                  style: const TextStyle(fontSize: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
