// Day 9 Task B4 — Landlord lease management (पट्टे), wired to /v1/land/leases.

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../api/api_exception.dart';
import '../../api/land_api.dart';
import '../../api/land_market_api.dart';
import '../../models/land_models.dart';
import '../../state/app_state.dart';
import '../profile_home/transport_home_widgets.dart' show formatRupees;
import 'lease_form_sheet.dart';

class LeaseManageView extends StatefulWidget {
  final AppState state;
  final LandApi? landApi;
  final LandMarketApi? landMarketApi;
  const LeaseManageView({
    super.key,
    required this.state,
    this.landApi,
    this.landMarketApi,
  });

  @override
  State<LeaseManageView> createState() => _LeaseManageViewState();
}

class _LeaseManageViewState extends State<LeaseManageView> {
  late final LandApi _api = widget.landApi ?? LandApi();
  late final LandMarketApi _marketApi =
      widget.landMarketApi ?? LandMarketApi();

  List<LandLease> _leases = [];
  Map<String, String> _plotNames = {};
  String? _statusFilter; // null = all, 'active', 'ended'
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final leases = await _api.listLeases(status: _statusFilter);
      final plots = await _api.listPlots();
      if (!mounted) return;
      setState(() {
        _leases = leases;
        _plotNames = {for (final p in plots) p.id: p.name};
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

  Future<void> _addLease() async {
    try {
      final plots = await _api.listPlots();
      final vacant = plots.where((p) => p.status == 'vacant').toList();
      if (!mounted) return;
      if (vacant.isEmpty) {
        _snack(widget.state.tr('landlord.noVacantPlots'));
        return;
      }
      final result = await showLeaseFormSheet(context,
          vacantPlots: vacant, lang: widget.state.language);
      if (result == null || !mounted) return;
      await _api.createLease(
        plotId: result.plotId,
        tenantName: result.tenantName,
        tenantPhone: result.tenantPhone,
        monthlyRentRupees: result.monthlyRentRupees,
        startDate: result.startDate,
        endDate: result.endDate,
      );
      _snack(widget.state.tr('landlord.leaseActivated'));
      _load();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  Future<void> _endLease(LandLease lease) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(widget.state.tr('landlord.endLeaseConfirm'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Text(
            "${lease.tenantName} • ₹${formatRupees(lease.monthlyRentRupees)}${widget.state.tr('landlord.perMonth')}"),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(widget.state.tr('back'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(widget.state.tr('landlord.confirm')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await _api.updateLease(lease.id, status: 'ended');
      _snack(widget.state.tr('landlord.leaseEnded'));
      _load();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  Future<void> _openAgreement(LandLease lease) async {
    try {
      final url = await _marketApi.getAgreementUrl(lease.id);
      if (url.isEmpty) throw const ApiException(code: 'AGREEMENT_UNAVAILABLE');
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {
      _snack(widget.state.tr('landlord.agreementUnavailable'));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.state.tr('landlord.leasesTitle'), style: const TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: const Color(0xFF8B5CF6),
        foregroundColor: Colors.white,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addLease,
        backgroundColor: const Color(0xFF8B5CF6),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: Text(widget.state.tr('landlord.newLeaseFab'), style: const TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              children: [
                _filterChip('active', widget.state.tr('landlord.active')),
                const SizedBox(width: 8),
                _filterChip('ended', widget.state.tr('landlord.ended')),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF43A047)))
                : _error
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(widget.state.tr('landlord.dataLoadFailed'),
                                style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.w700)),
                            const SizedBox(height: 10),
                            ElevatedButton(
                                onPressed: _load,
                                child: Text(widget.state.tr('retry'))),
                          ],
                        ),
                      )
                    : _leases.isEmpty
                        ? Center(
                            child: Text(widget.state.tr('landlord.noLeases'),
                                style: const TextStyle(color: Colors.grey)))
                        : ListView.builder(
                            physics: const BouncingScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
                            itemCount: _leases.length,
                            itemBuilder: (_, i) => _leaseCard(_leases[i]),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String status, String label) {
    final sel = _statusFilter == status;
    return FilterChip(
      label: Text(label),
      selected: sel,
      selectedColor: const Color(0xFFEDE9FE),
      onSelected: (_) {
        _statusFilter = sel ? null : status;
        _load();
      },
    );
  }

  Widget _leaseCard(LandLease lease) {
    final plotName = _plotNames[lease.plotId] ?? lease.plotId;
    return GestureDetector(
      onTap: () => widget.state.openRentTracking(lease),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF8B5CF6).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.handshake_rounded,
                  color: Color(0xFF8B5CF6), size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(lease.tenantName,
                            style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF1E293B))),
                      ),
                      if (lease.verified) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD1FAE5),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(widget.state.tr('landlord.verified'),
                              style: const TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF16A34A))),
                        ),
                      ],
                    ],
                  ),
                  Text(
                    "$plotName • ${lease.startDate} → ${lease.endDate}",
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                  ),
                  Text(
                    "₹${formatRupees(lease.monthlyRentRupees)}${widget.state.tr('landlord.perMonth')}",
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF8B5CF6)),
                  ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, color: Colors.grey),
              onSelected: (action) {
                if (action == 'end') _endLease(lease);
                if (action == 'agreement') _openAgreement(lease);
              },
              itemBuilder: (_) => [
                PopupMenuItem(value: 'agreement', child: Text(widget.state.tr('landlord.agreementPdf'))),
                PopupMenuItem(value: 'end', child: Text(widget.state.tr('landlord.endLease'))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
