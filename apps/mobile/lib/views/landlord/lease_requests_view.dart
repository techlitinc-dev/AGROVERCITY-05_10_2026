// Day 9 Task B7 — Lease-request inbox for a listing (पट्टा अनुरोध), L3.

import 'package:flutter/material.dart';
import '../../api/api_exception.dart';
import '../../api/land_market_api.dart';
import '../../models/land_market_models.dart';
import '../../state/app_state.dart';

class LeaseRequestsView extends StatefulWidget {
  final AppState state;
  final LandMarketApi? landMarketApi;
  final LandListing? listing;
  const LeaseRequestsView({
    super.key,
    required this.state,
    this.landMarketApi,
    this.listing,
  });

  @override
  State<LeaseRequestsView> createState() => _LeaseRequestsViewState();
}

class _LeaseRequestsViewState extends State<LeaseRequestsView> {
  late final LandMarketApi _api = widget.landMarketApi ?? LandMarketApi();
  late final LandListing? _listing =
      widget.listing ?? widget.state.selectedListing;

  List<LeaseRequest> _requests = [];
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
      final requests = await _api.listLeaseRequests(status: 'pending');
      if (!mounted) return;
      setState(() {
        _requests = requests;
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

  Future<void> _accept(LeaseRequest request) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(widget.state.tr('landlord.leaseWillBeCreated'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Text(
            "${request.farmerName} • ${request.durationMonths} ${widget.state.tr('landlord.monthsUnit')}"),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(widget.state.tr('back'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(widget.state.tr('landlord.confirm')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await _api.acceptRequest(request.id);
      _snack(widget.state.tr('landlord.leaseActivated'));
      widget.state.navigateTo('landlordLeases');
    } on ApiException catch (e) {
      if (e.code == 'REQUEST_ALREADY_RESOLVED') {
        _snack(widget.state.tr('landlord.requestAlreadyResolved'));
        _load();
      } else {
        _snack(e.message.isNotEmpty ? e.message : e.code);
      }
    }
  }

  Future<void> _reject(LeaseRequest request) async {
    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(widget.state.tr('landlord.rejectRequestTitle'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: TextField(
          controller: reasonCtrl,
          decoration: InputDecoration(
              labelText: widget.state.tr('landlord.reasonOptional'),
              border: const OutlineInputBorder()),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(widget.state.tr('back'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(widget.state.tr('landlord.reject')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await _api.rejectRequest(request.id, reasonCtrl.text.trim());
      _snack(widget.state.tr('landlord.requestRejected'));
      _load();
    } on ApiException catch (e) {
      if (e.code == 'REQUEST_ALREADY_RESOLVED') {
        _snack(widget.state.tr('landlord.requestAlreadyResolved'));
        _load();
      } else {
        _snack(e.message.isNotEmpty ? e.message : e.code);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.state.tr('landlord.leaseRequestsTitle'),
            style: const TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: const Color(0xFF8B5CF6),
        foregroundColor: Colors.white,
      ),
      body: _loading
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
                          onPressed: _load, child: Text(widget.state.tr('retry'))),
                    ],
                  ),
                )
              : _requests.isEmpty
                  ? Center(
                      child: Text(widget.state.tr('landlord.noPendingRequests'),
                          style: const TextStyle(color: Colors.grey)))
                  : ListView.builder(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
                      itemCount: _requests.length,
                      itemBuilder: (_, i) => _requestCard(_requests[i]),
                    ),
    );
  }

  Widget _requestCard(LeaseRequest request) {
    return Container(
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(request.farmerName,
              style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1E293B))),
          Text(
            "${_listing?.village ?? ''} • ${request.durationMonths} ${widget.state.tr('landlord.monthsUnit')}",
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
          ),
          if (request.message.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(request.message,
                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF4B5563))),
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _accept(request),
                  style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      foregroundColor: Colors.white),
                  child: Text(widget.state.tr('landlord.accept'),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _reject(request),
                  style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFDC2626),
                      foregroundColor: Colors.white),
                  child: Text(widget.state.tr('landlord.reject'),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
