// Day 9 Task B4 — Rent tracking for one lease ({tenantName} — किराया).

import 'package:flutter/material.dart';
import '../../api/api_exception.dart';
import '../../api/land_api.dart';
import '../../models/land_models.dart';
import '../../state/app_state.dart';
import '../profile_home/transport_home_widgets.dart' show formatRupees;
import 'landlord_form_sheets.dart';

class RentTrackingView extends StatefulWidget {
  final AppState state;
  final LandApi? landApi;
  final LandLease? lease;
  const RentTrackingView({
    super.key,
    required this.state,
    this.landApi,
    this.lease,
  });

  @override
  State<RentTrackingView> createState() => _RentTrackingViewState();
}

class _RentTrackingViewState extends State<RentTrackingView> {
  late final LandApi _api = widget.landApi ?? LandApi();
  late final LandLease? _lease = widget.lease ?? widget.state.selectedLease;

  LeasePayments _data = const LeasePayments(
      payments: [], totalCollectedRupees: 0, pendingMonths: []);
  bool _loading = true;
  bool _error = false;

  static const _methodLabels = {'cash': 'नकद', 'upi': 'UPI', 'bank': 'बैंक'};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final lease = _lease;
    if (lease == null) {
      setState(() {
        _loading = false;
        _error = true;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final data = await _api.listPayments(lease.id);
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = true;
      });
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _addPayment() async {
    final lease = _lease;
    if (lease == null) return;
    final result =
        await showPaymentFormSheet(context, monthlyRentRupees: lease.monthlyRentRupees);
    if (result == null || !mounted) return;
    try {
      await _api.addPayment(
        lease.id,
        amountRupees: result.amountRupees,
        month: result.month,
        method: result.method,
        paidAt: result.paidAt,
      );
      _snack("भुगतान दर्ज हुआ");
      _load();
    } on ApiException catch (e) {
      if (e.code == 'DUPLICATE_PAYMENT_MONTH') {
        _snack("इस महीने का भुगतान पहले से दर्ज है");
      } else {
        _snack(e.message.isNotEmpty ? e.message : e.code);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final lease = _lease;
    return Scaffold(
      appBar: AppBar(
        title: Text("${lease?.tenantName ?? ''} — किराया",
            style: const TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: const Color(0xFF8B5CF6),
        foregroundColor: Colors.white,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addPayment,
        backgroundColor: const Color(0xFF8B5CF6),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text("+ भुगतान दर्ज करें",
            style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF43A047)))
          : _error
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text("डेटा लोड नहीं हो सका",
                          style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      ElevatedButton(
                          onPressed: _load, child: const Text("पुनः प्रयास करें")),
                    ],
                  ),
                )
              : ListView(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
                  children: [
                    // Header card — total collected
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF8B5CF6), Color(0xFF7C3AED)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Text(
                        "कुल संग्रह: ₹${formatRupees(_data.totalCollectedRupees)}",
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.w900),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Pending months
                    if (_data.pendingMonths.isNotEmpty) ...[
                      const Text("लंबित महीने",
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF1E293B))),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: _data.pendingMonths
                            .map(
                              (m) => Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFEE2E2),
                                  borderRadius: BorderRadius.circular(10),
                                  border:
                                      Border.all(color: const Color(0xFFFCA5A5)),
                                ),
                                child: Text(m,
                                    style: const TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w800,
                                        color: Color(0xFFDC2626))),
                              ),
                            )
                            .toList(),
                      ),
                      const SizedBox(height: 14),
                    ],

                    // Payments list
                    const Text("भुगतान इतिहास",
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF1E293B))),
                    const SizedBox(height: 8),
                    if (_data.payments.isEmpty)
                      const Text("अभी कोई भुगतान नहीं",
                          style: TextStyle(color: Colors.grey))
                    else
                      ..._data.payments.map(
                        (p) => Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(p.month,
                                      style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w800,
                                          color: Color(0xFF1E293B))),
                                  Text(
                                    "${_methodLabels[p.method] ?? p.method} • ${p.paidAt}",
                                    style: TextStyle(
                                        fontSize: 10.5,
                                        color: Colors.grey.shade600),
                                  ),
                                ],
                              ),
                              Text("₹${formatRupees(p.amountRupees)}",
                                  style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF16A34A))),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
    );
  }
}
