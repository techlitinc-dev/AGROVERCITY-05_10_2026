// Module F/A: Live Mandi Rates & Profit Maximizer Flutter View (API-wired)

import 'package:flutter/material.dart';
import '../api/mandi_api.dart';
import '../state/app_state.dart';
import '../components/common/audio_button.dart';
import '../components/mandi/mandi_price_card.dart';
import '../components/mandi/price_history_chart.dart';
import '../components/mandi/smart_compare_sheet.dart';

class MandiView extends StatefulWidget {
  final AppState state;
  final MandiApi? mandiApi;

  const MandiView({super.key, required this.state, this.mandiApi});

  @override
  State<MandiView> createState() => _MandiViewState();
}

class _MandiViewState extends State<MandiView> {
  late final MandiApi _api = widget.mandiApi ?? MandiApi();
  String _selectedCrop = 'All';
  List<Map<String, dynamic>> _prices = [];
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
      final res = await _api.getPrices(
        crop: _selectedCrop == 'All' ? null : _selectedCrop,
      );
      if (!mounted) return;
      setState(() {
        _prices = (res['data'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _prices = const [];
        _loading = false;
        _error = true;
      });
    }
  }

  String _englishCrop(String commodity) => commodity.split('(').first.trim();

  void _openDetail(Map<String, dynamic> price) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(14, 0, 14, 24),
        child: PriceHistoryChart(
          crop: _englishCrop("${price['commodity']}"),
          mandi: "${price['mandiName']}",
          mandiApi: _api,
        ),
      ),
    );
  }

  void _openCompare() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SmartCompareSheet(state: widget.state, mandiApi: _api),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.state.tr('liveMandiRatesTitle'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text(widget.state.tr('liveMandiSubtitle'), style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              AudioButton(text: widget.state.tr('trade.mandiRatesAudio')),
            ],
          ),
          const SizedBox(height: 10),

          // Action buttons: Smart Compare + Sell Produce
          Row(
            children: [
              Expanded(
                child: _headerButton(
                  icon: Icons.calculate_rounded,
                  label: widget.state.tr('smartMandiSelect'),
                  color: const Color(0xFF16A34A),
                  onTap: _openCompare,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _headerButton(
                  icon: Icons.sell_rounded,
                  label: widget.state.tr('sellYourProduce'),
                  color: const Color(0xFFEA580C),
                  onTap: () => widget.state.navigateTo('sellProduce'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Filters
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _filterChip('All', widget.state.tr('allCrops')),
                _filterChip('Tomato', '🍅 Tomato'),
                _filterChip('Onion', '🧅 Onion'),
                _filterChip('Wheat', '🌾 Wheat'),
              ],
            ),
          ),
          const SizedBox(height: 14),

          if (_error) _retryBanner(),

          if (_loading)
            for (var i = 0; i < 3; i++)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                height: 96,
                decoration: BoxDecoration(
                  color: Colors.grey.shade200,
                  borderRadius: BorderRadius.circular(16),
                ),
              )
          else if (_error)
            const SizedBox.shrink()
          else if (_prices.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(widget.state.tr('noDataAvailable'), style: const TextStyle(fontSize: 13, color: Colors.grey, fontWeight: FontWeight.w700)),
              ),
            )
          else
            ..._prices.map(
              (p) => MandiPriceCard(price: p, onTap: () => _openDetail(p)),
            ),
        ],
      ),
    );
  }

  Widget _headerButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.5)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: color),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _retryBanner() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFDBA74)),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, size: 18, color: Color(0xFFEA580C)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              widget.state.tr('trade.liveRatesUnavailable'),
              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF9A3412)),
            ),
          ),
          TextButton(
            onPressed: _load,
            child: Text(
              widget.state.tr('retry'),
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFFEA580C)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String id, String label) {
    final sel = _selectedCrop == id;
    return GestureDetector(
      onTap: () {
        if (sel) return;
        _selectedCrop = id;
        _load();
      },
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: sel ? const Color(0xFF1B4332) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: sel ? const Color(0xFF1B4332) : Colors.grey.shade300),
        ),
        child: Text(label, style: TextStyle(fontSize: 12, fontWeight: sel ? FontWeight.w800 : FontWeight.w500, color: sel ? Colors.white : Colors.black87)),
      ),
    );
  }
}
