import 'dart:ui';
import 'package:flutter/material.dart';
import '../../api/mandi_api.dart';
import '../../core/theme.dart';
import '../../state/app_state.dart';
import 'mandi_price_card.dart';

class SmartCompareSheet extends StatefulWidget {
  final AppState state;
  final MandiApi? mandiApi;

  const SmartCompareSheet({super.key, required this.state, this.mandiApi});

  @override
  State<SmartCompareSheet> createState() => _SmartCompareSheetState();
}

class _SmartCompareSheetState extends State<SmartCompareSheet> {
  late final MandiApi _api = widget.mandiApi ?? MandiApi();
  String _crop = 'Tomato';
  double _quintals = 10;
  bool _loading = false;
  List<Map<String, dynamic>>? _results;

  (double, double) _coords() {
    final points = widget.state.profile.farmBoundaryPoints;
    if (points.isEmpty) return (20.0, 73.8);
    final lat =
        points.map((p) => p['lat'] ?? 0.0).reduce((a, b) => a + b) /
            points.length;
    final lng =
        points.map((p) => p['lng'] ?? 0.0).reduce((a, b) => a + b) /
            points.length;
    return (lat, lng);
  }

  Future<void> _compare() async {
    setState(() {
      _loading = true;
      _results = null;
    });
    final (lat, lng) = _coords();
    try {
      final res = await _api.compare(_crop, _quintals, lat, lng);
      if (!mounted) return;
      setState(() {
        _results = (res['data'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _results = const [];
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.85,
          ),
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 26),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.97),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 4.5,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade400,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              const Row(
                children: [
                  Icon(Icons.calculate_rounded, color: Color(0xFF16A34A), size: 20),
                  SizedBox(width: 8),
                  Text(
                    "स्मार्ट मंडी चयन कैलकुलेटर",
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF14532D),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                "भाड़ा काटकर किस मंडी में मिलेगा सर्वाधिक शुद्ध मुनाफा?",
                style: TextStyle(fontSize: 11.5, color: Color(0xFF166534)),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  const Text(
                    "फसल:",
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(width: 10),
                  DropdownButton<String>(
                    value: _crop,
                    underline: const SizedBox.shrink(),
                    borderRadius: BorderRadius.circular(14),
                    items: const [
                      DropdownMenuItem(value: 'Tomato', child: Text('🍅 Tomato (टमाटर)')),
                      DropdownMenuItem(value: 'Onion', child: Text('🧅 Onion (प्याज)')),
                      DropdownMenuItem(value: 'Wheat', child: Text('🌾 Wheat (गेहूं)')),
                    ],
                    onChanged: (v) => setState(() => _crop = v ?? _crop),
                  ),
                ],
              ),
              Text(
                "आपकी कुल उपज: ${_quintals.toInt()} क्विंटल",
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
              ),
              Slider(
                min: 1,
                max: 100,
                divisions: 99,
                value: _quintals,
                activeColor: const Color(0xFF16A34A),
                onChanged: (v) => setState(() => _quintals = v),
              ),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  onPressed: _loading ? null : _compare,
                  icon: const Icon(Icons.compare_arrows_rounded, size: 18),
                  label: Text(
                    _loading ? "तुलना हो रही है..." : "Compare (तुलना करें)",
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              if (_results != null)
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: _results!.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) =>
                        _resultRow(index, _results![index]),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _resultRow(int index, Map<String, dynamic> item) {
    final isBest = index == 0;
    final modal = (item['modalPrice'] as num?) ?? 0;
    final transport = (item['transportCost'] as num?) ?? 0;
    final net = (item['netProfit'] as num?) ?? 0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isBest ? AppColors.accent : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isBest ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
          width: isBest ? 1.6 : 1.0,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  "#${index + 1}  ${item['mandiName']}",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1B4332),
                  ),
                ),
              ),
              if (isBest)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16A34A),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    "Best net profit",
                    style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 5),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "मॉडल ₹${fmtInr(modal)}/qtl",
                style: const TextStyle(fontSize: 11, color: Colors.black87),
              ),
              Text(
                "भाड़ा ₹${fmtInr(transport)}",
                style: const TextStyle(fontSize: 11, color: Colors.black54),
              ),
              Text(
                "शुद्ध लाभ ₹${fmtInr(net)}",
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF16A34A),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
