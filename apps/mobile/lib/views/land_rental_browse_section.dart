// Day 9 Task B7 — farmer "किराए की ज़मीन" browse section (L2/L3).
// Self-contained so the Day 10 land_legal_view port can absorb it as-is.

import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../api/land_market_api.dart';
import '../models/land_market_models.dart';
import '../state/app_state.dart';
import 'profile_home/transport_home_widgets.dart' show formatRupees;

// Request dialog — duration stepper + message. Resolves with
// (durationMonths, message) or null.
Future<(int, String)?> showLeaseRequestDialog(
  BuildContext context, {
  required AppState state,
}) {
  final messageCtrl = TextEditingController();
  var duration = 12;

  return showDialog<(int, String)>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (context, setDialogState) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          state.tr('landLegal.requestLease'),
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  onPressed: duration > 1
                      ? () => setDialogState(() => duration--)
                      : null,
                  icon: const Icon(Icons.remove_circle_outline_rounded),
                ),
                Text(
                  '$duration ${state.tr('landLegal.months')}',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                IconButton(
                  onPressed: duration < 120
                      ? () => setDialogState(() => duration++)
                      : null,
                  icon: const Icon(Icons.add_circle_outline_rounded),
                ),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
              controller: messageCtrl,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: state.tr('landLegal.messageOptional'),
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(state.tr('cancel')),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF8B5CF6),
              foregroundColor: Colors.white,
            ),
            onPressed: () =>
                Navigator.pop(ctx, (duration, messageCtrl.text.trim())),
            child: Text(
              state.tr('landLegal.sendRequest'),
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    ),
  );
}

class LandRentalBrowseSection extends StatefulWidget {
  final AppState state;
  final LandMarketApi? landMarketApi;
  const LandRentalBrowseSection({
    super.key,
    required this.state,
    this.landMarketApi,
  });

  @override
  State<LandRentalBrowseSection> createState() =>
      _LandRentalBrowseSectionState();
}

class _LandRentalBrowseSectionState extends State<LandRentalBrowseSection> {
  late final LandMarketApi _api = widget.landMarketApi ?? LandMarketApi();

  final _acresCtrl = TextEditingController();
  List<LandListing> _listings = [];
  bool _nearOnly = false;
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
      String? near;
      if (_nearOnly && widget.state.profile.farmBoundaryPoints.isNotEmpty) {
        final p = widget.state.profile.farmBoundaryPoints.first;
        near = "${p['lat']},${p['lng']}";
      }
      final acres = double.tryParse(_acresCtrl.text.trim());
      final listings = await _api.listListings(near: near, acres: acres);
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

  Future<void> _requestLease(LandListing listing) async {
    final result = await showLeaseRequestDialog(context, state: widget.state);
    if (result == null || !mounted) return;
    final (duration, message) = result;
    try {
      await _api.requestLease(
        listingId: listing.id,
        durationMonths: duration,
        message: message,
      );
      _snack(widget.state.tr('landLegal.requestSent'));
    } on ApiException catch (e) {
      if (e.code == 'DUPLICATE_LEASE_REQUEST') {
        _snack(widget.state.tr('landLegal.requestAlreadySent'));
      } else if (e.code == 'LISTING_NOT_OPEN') {
        _snack(widget.state.tr('landLegal.listingNotAvailable'));
      } else {
        _snack(e.message.isNotEmpty ? e.message : e.code);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Filter row — min acres + nearby toggle
        Row(
          children: [
            SizedBox(
              width: 110,
              child: TextField(
                controller: _acresCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: widget.state.tr('landLegal.minAcres'),
                  border: const OutlineInputBorder(),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                ),
                onSubmitted: (_) => _load(),
              ),
            ),
            const SizedBox(width: 10),
            FilterChip(
              label: Text(widget.state.tr('landLegal.nearby')),
              selected: _nearOnly,
              selectedColor: const Color(0xFFEDE9FE),
              onSelected: (v) {
                _nearOnly = v;
                _load();
              },
            ),
          ],
        ),
        const SizedBox(height: 14),

        if (_loading)
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: CircularProgressIndicator(color: Color(0xFF43A047)),
            ),
          )
        else if (_error)
          Center(
            child: Column(
              children: [
                Text(
                  widget.state.tr('landLegal.loadFailed'),
                  style: const TextStyle(
                    color: Colors.grey,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                ElevatedButton(
                  onPressed: _load,
                  child: Text(widget.state.tr('retry')),
                ),
              ],
            ),
          )
        else if (_listings.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: Text(
                widget.state.tr('landLegal.noRentalNearby'),
                style: const TextStyle(color: Colors.grey),
              ),
            ),
          )
        else
          ..._listings.map(_listingCard),
      ],
    );
  }

  Widget _listingCard(LandListing listing) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  "${listing.village}, ${listing.district}",
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1E293B),
                  ),
                ),
              ),
              Text(
                '₹${formatRupees(listing.expectedRentRupees)}/${widget.state.tr('landLegal.perMonth')}',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF8B5CF6),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${listing.areaAcres} ${widget.state.tr('acresUnit')} • ${widget.state.tr('landLegal.owner')}: ${listing.landlordName}',
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
          ),
          if (listing.soilType != null || listing.waterSource != null) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              children: [
                if (listing.soilType != null) _miniChip(listing.soilType!),
                if (listing.waterSource != null)
                  _miniChip(listing.waterSource!),
              ],
            ),
          ],
          const SizedBox(height: 10),
          ElevatedButton.icon(
            onPressed: () => _requestLease(listing),
            icon: const Icon(Icons.handshake_rounded, size: 16),
            label: Text(
              widget.state.tr('landLegal.requestLease'),
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF8B5CF6),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 40),
            ),
          ),
        ],
      ),
    );
  }

  Widget _miniChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: Color(0xFF374151),
        ),
      ),
    );
  }
}
