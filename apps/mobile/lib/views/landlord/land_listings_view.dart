// Day 9 Task B7 — Landlord's own land listings (मेरी ज़मीन लिस्टिंग), L2.

import 'package:flutter/material.dart';
import '../../api/api_exception.dart';
import '../../api/land_api.dart';
import '../../api/land_market_api.dart';
import '../../models/land_market_models.dart';
import '../../state/app_state.dart';
import '../profile_home/transport_home_widgets.dart' show formatRupees;
import 'listing_form_sheet.dart';

class LandListingsView extends StatefulWidget {
  final AppState state;
  final LandMarketApi? landMarketApi;
  final LandApi? landApi;
  const LandListingsView({
    super.key,
    required this.state,
    this.landMarketApi,
    this.landApi,
  });

  @override
  State<LandListingsView> createState() => _LandListingsViewState();
}

class _LandListingsViewState extends State<LandListingsView> {
  late final LandMarketApi _api = widget.landMarketApi ?? LandMarketApi();
  late final LandApi _landApi = widget.landApi ?? LandApi();

  List<LandListing> _listings = [];
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
      final listings = await _api.myListings();
      if (!mounted) return;
      setState(() {
        _listings = listings;
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

  Future<void> _addListing() async {
    try {
      final plots = await _landApi.listPlots();
      if (!mounted) return;
      final result = await showListingFormSheet(context,
          plots: plots, lang: widget.state.language);
      if (result == null || !mounted) return;
      // listable plot coordinates default to the profile farm location
      final point = widget.state.profile.farmBoundaryPoints.isNotEmpty
          ? widget.state.profile.farmBoundaryPoints.first
          : const {'lat': 20.0, 'lng': 73.8};
      await _api.createListing(
        village: result.village,
        district: result.district,
        lat: point['lat'] ?? 20.0,
        lng: point['lng'] ?? 73.8,
        areaAcres: result.areaAcres,
        expectedRentRupees: result.expectedRentRupees,
        soilType: result.soilType,
        plotId: result.plotId,
      );
      _snack(widget.state.tr('landlord.listingAdded'));
      _load();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.state.tr('landlord.myListings'),
            style: const TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: const Color(0xFF8B5CF6),
        foregroundColor: Colors.white,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addListing,
        backgroundColor: const Color(0xFF8B5CF6),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: Text(widget.state.tr('landlord.addListing'), style: const TextStyle(fontWeight: FontWeight.w800)),
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
              : _listings.isEmpty
                  ? Center(
                      child: Text(widget.state.tr('landlord.noListingsHint'),
                          style: const TextStyle(color: Colors.grey)))
                  : ListView.builder(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
                      itemCount: _listings.length,
                      itemBuilder: (_, i) => _listingCard(_listings[i]),
                    ),
    );
  }

  Widget _statusChip(String status) {
    final (label, color) = switch (status) {
      'leased' => (widget.state.tr('landlord.statusLeased'), const Color(0xFF8B5CF6)),
      'closed' => (widget.state.tr('landlord.statusClosed'), const Color(0xFF6B7280)),
      _ => (widget.state.tr('landlord.statusOpen'), const Color(0xFF16A34A)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration:
          BoxDecoration(color: color, borderRadius: BorderRadius.circular(12)),
      child: Text(label,
          style: const TextStyle(
              color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
    );
  }

  Widget _listingCard(LandListing listing) {
    return GestureDetector(
      onTap: () => widget.state.openLeaseRequests(listing),
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
              child: const Icon(Icons.map_rounded,
                  color: Color(0xFF8B5CF6), size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("${listing.village}, ${listing.district}",
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF1E293B))),
                  Text(
                    "${listing.areaAcres} ${widget.state.tr('acresUnit')} • ₹${formatRupees(listing.expectedRentRupees)}${widget.state.tr('landlord.perMonth')}",
                    style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
                  ),
                  if (listing.soilType != null)
                    Text("${widget.state.tr('soilType')}: ${listing.soilType}",
                        style: TextStyle(fontSize: 10.5, color: Colors.grey.shade500)),
                ],
              ),
            ),
            _statusChip(listing.status),
          ],
        ),
      ),
    );
  }
}
