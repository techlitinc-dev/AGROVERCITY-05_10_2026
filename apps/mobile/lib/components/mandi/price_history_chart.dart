import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../api/mandi_api.dart';
import '../../data/translations.dart';
import '../../state/app_state.dart';
import 'mandi_price_card.dart';

String _t(AppState? state, String key) =>
    state != null ? state.tr(key) : AppTranslations.get(key, 'hi');

class PriceHistoryChart extends StatefulWidget {
  final String crop;
  final String mandi;
  final MandiApi? mandiApi;
  final AppState? state;

  const PriceHistoryChart({
    super.key,
    required this.crop,
    required this.mandi,
    this.mandiApi,
    this.state,
  });

  @override
  State<PriceHistoryChart> createState() => _PriceHistoryChartState();
}

class _PriceHistoryChartState extends State<PriceHistoryChart> {
  late final MandiApi _api = widget.mandiApi ?? MandiApi();
  int _months = 3;
  List<Map<String, dynamic>>? _points;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.getPriceHistory(widget.crop, widget.mandi,
          months: _months);
      if (!mounted) return;
      setState(() {
        _points = (res['data'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _points = const [];
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            "${widget.crop} • ${widget.mandi}",
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w900,
              color: Color(0xFF1B4332),
            ),
          ),
          Text(
            _t(widget.state, 'market.priceHistory'),
            style: const TextStyle(fontSize: 11, color: Colors.grey),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              for (final m in const [3, 6, 12]) ...[
                _monthChip(m),
                const SizedBox(width: 8),
              ],
            ],
          ),
          const SizedBox(height: 12),
          if (_loading)
            Container(
              height: 160,
              decoration: BoxDecoration(
                color: Colors.grey.shade200,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            )
          else if (_points == null || _points!.isEmpty)
            Container(
              height: 160,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _t(widget.state, 'noDataAvailable'),
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Colors.grey,
                ),
              ),
            )
          else
            _buildChart(_points!),
        ],
      ),
    );
  }

  Widget _monthChip(int months) {
    final selected = _months == months;
    return GestureDetector(
      onTap: () {
        if (selected) return;
        _months = months;
        _load();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF1B4332) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? const Color(0xFF1B4332) : Colors.grey.shade300,
          ),
        ),
        child: Text(
          "$months ${_t(widget.state, 'market.months')}",
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : Colors.black87,
          ),
        ),
      ),
    );
  }

  Widget _buildChart(List<Map<String, dynamic>> points) {
    final prices =
        points.map((p) => (p['modalPrice'] as num).toDouble()).toList();
    final minP = prices.reduce((a, b) => a < b ? a : b);
    final maxP = prices.reduce((a, b) => a > b ? a : b);
    final lastP = prices.last;
    final span = (maxP - minP).abs();
    final pad = span == 0 ? maxP * 0.05 + 1 : span * 0.15;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _statLabel(_t(widget.state, 'market.minShort'), minP),
            _statLabel(_t(widget.state, 'market.maxShort'), maxP),
            _statLabel(_t(widget.state, 'market.lastPrice'), lastP, highlight: true),
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 160,
          child: LineChart(
            LineChartData(
              minY: minP - pad,
              maxY: maxP + pad,
              gridData: const FlGridData(show: false),
              titlesData: const FlTitlesData(show: false),
              borderData: FlBorderData(show: false),
              lineTouchData: const LineTouchData(enabled: false),
              lineBarsData: [
                LineChartBarData(
                  spots: [
                    for (var i = 0; i < prices.length; i++)
                      FlSpot(i.toDouble(), prices[i]),
                  ],
                  isCurved: true,
                  preventCurveOverShooting: true,
                  color: const Color(0xFF16A34A),
                  barWidth: 2.5,
                  dotData: const FlDotData(show: false),
                  belowBarData: BarAreaData(
                    show: true,
                    color: const Color(0xFF16A34A).withValues(alpha: 0.12),
                  ),
                ),
              ],
            ),
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              "${points.first['date']}",
              style: const TextStyle(fontSize: 10, color: Colors.grey),
            ),
            Text(
              "${points.last['date']}",
              style: const TextStyle(fontSize: 10, color: Colors.grey),
            ),
          ],
        ),
      ],
    );
  }

  Widget _statLabel(String label, num value, {bool highlight = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
        Text(
          "₹${fmtInr(value)}",
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w900,
            color: highlight ? const Color(0xFF16A34A) : const Color(0xFF263238),
          ),
        ),
      ],
    );
  }
}
