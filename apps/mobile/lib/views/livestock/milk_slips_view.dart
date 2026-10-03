// My Milk & Payments — farmer self-views for collection slips and payment
// batches. Contract: /v1/livestock/dairy/farmer/slips + /farmer/payments.

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/livestock_mgmt_api.dart';
import '../../models/livestock_mgmt_models.dart';
import '../../state/app_state.dart';
import '../livestock/mgmt_widgets.dart';

class MilkSlipsView extends StatefulWidget {
  final AppState state;
  final DairyMgmtApi? api;

  const MilkSlipsView({super.key, required this.state, this.api});

  @override
  State<MilkSlipsView> createState() => _MilkSlipsViewState();
}

class _MilkSlipsViewState extends State<MilkSlipsView> {
  late final DairyMgmtApi _api = widget.api ?? DairyMgmtApi();

  int _tab = 0; // 0 slips, 1 payments

  final MgmtAsyncData<List<MilkCollectionSlip>> _slips = MgmtAsyncData();
  final MgmtAsyncData<List<PaymentEntry>> _payments = MgmtAsyncData();
  String _memberCode = '';

  AppState get s => widget.state;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    await Future.wait([_loadSlips(), _loadPayments()]);
    if (mounted) setState(() {});
  }

  Future<void> _loadSlips() async {
    _slips
      ..loading = true
      ..error = null;
    try {
      final res = await _api.farmerSlips();
      _memberCode = res['memberCode'] as String? ?? '';
      _slips.data = ((res['data'] as List?) ?? const <dynamic>[])
          .map((e) =>
              MilkCollectionSlip.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
    } on ApiException catch (e) {
      _slips.error = e.message.isNotEmpty ? e.message : e.code;
    } catch (e) {
      _slips.error = e.toString();
    } finally {
      if (mounted) _slips.loading = false;
    }
  }

  Future<void> _loadPayments() async {
    _payments
      ..loading = true
      ..error = null;
    try {
      _payments.data = await _api.farmerPayments();
    } on ApiException catch (e) {
      _payments.error = e.message.isNotEmpty ? e.message : e.code;
    } catch (e) {
      _payments.error = e.toString();
    } finally {
      if (mounted) _payments.loading = false;
    }
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
            Row(
              children: [
                _tabChip(
                  0,
                  s.tr('livestock.farmer.slipsTab'),
                  Icons.receipt_long_outlined,
                ),
                _tabChip(
                  1,
                  s.tr('livestock.farmer.paymentsTab'),
                  Icons.payments_outlined,
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (_tab == 0)
              MgmtAsyncView<List<MilkCollectionSlip>>(
                value: _slips,
                emptyText: s.tr('livestock.farmer.emptySlips'),
                retryLabel: s.tr('livestock.mgmt.retry'),
                onRetry: _refresh,
                builder: (list) =>
                    Column(children: list.map(_slipCard).toList()),
              )
            else
              MgmtAsyncView<List<PaymentEntry>>(
                value: _payments,
                emptyText: s.tr('livestock.farmer.emptyPayments'),
                retryLabel: s.tr('livestock.mgmt.retry'),
                onRetry: _refresh,
                builder: (list) =>
                    Column(children: list.map(_paymentCard).toList()),
              ),
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
          colors: [Color(0xFF43A047), Color(0xFF1B5E20)],
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
                  s.tr('livestock.farmer.title'),
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
          if (_memberCode.isNotEmpty)
            Text(
              '${s.tr('livestock.mgmt.memberCode')}: $_memberCode',
              style: const TextStyle(color: Colors.white70, fontSize: 11.5),
            ),
        ],
      ),
    );
  }

  Widget _tabChip(int index, String label, IconData icon) {
    final selected = _tab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tab = index),
        child: Container(
          margin: EdgeInsets.only(right: index == 0 ? 8 : 0),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF43A047) : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? const Color(0xFF43A047) : Colors.grey.shade300,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 15,
                  color: selected ? Colors.white : Colors.grey.shade700),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  color: selected ? Colors.white : Colors.grey.shade800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _slipCard(MilkCollectionSlip slip) {
    final isMorning = slip.shift == 'morning';
    final isCow = slip.milkType == 'cow';
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
                    color: isCow
                        ? const Color(0xFFE8F5E9)
                        : const Color(0xFFECEFF1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    isCow ? Icons.pets : Icons.agriculture,
                    color: isCow
                        ? const Color(0xFF2E7D32)
                        : const Color(0xFF455A64),
                    size: 18,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        slip.date,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        slip.slipNumber,
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
                        color: isMorning
                            ? const Color(0xFFFFF3E0)
                            : const Color(0xFFEDE7F6),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        s.tr(isMorning
                            ? 'livestock.mgmt.shiftAM'
                            : 'livestock.mgmt.shiftPM'),
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                          color: isMorning
                              ? const Color(0xFFE65100)
                              : const Color(0xFF512DA8),
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '₹${slip.totalAmount}',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1565C0),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const Divider(height: 16),
            Row(
              children: [
                _slipMetric(s.tr('livestock.farmer.liters'), '${slip.liters} L'),
                _slipMetric('FAT', '${slip.fatPercent}%'),
                _slipMetric('SNF', '${slip.snfPercent}%'),
                _slipMetric(s.tr('livestock.mgmt.ratePerLiter'),
                    '₹${slip.ratePerLiter}'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _slipMetric(String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }

  Widget _paymentCard(PaymentEntry p) {
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
                  child: const Icon(Icons.payments_outlined,
                      color: Color(0xFF1565C0), size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.batchId,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                      Text(
                        p.createdAt,
                        style:
                            const TextStyle(fontSize: 11, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                MgmtStatusBadge.forStatus(p.status),
              ],
            ),
            const Divider(height: 16),
            Row(
              children: [
                _slipMetric(s.tr('livestock.farmer.liters'), '${p.liters} L'),
                _slipMetric(s.tr('livestock.mgmt.amount'), '₹${p.amount}'),
                _slipMetric(s.tr('livestock.mgmt.deduction'), '₹${p.deduction}'),
                _slipMetric(s.tr('livestock.farmer.net'), '₹${p.netAmount}'),
              ],
            ),
            if (p.payoutRef.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  '${s.tr('livestock.mgmt.payoutRef')}: ${p.payoutRef}',
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
