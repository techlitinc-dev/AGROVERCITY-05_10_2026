import 'package:flutter/material.dart';
import '../../data/translations.dart';
import '../../state/app_state.dart';
import '../common/glass_card.dart';

String _t(AppState? state, String key) =>
    state != null ? state.tr(key) : AppTranslations.get(key, 'hi');

String fmtInr(num value) {
  final s = value.round().toString();
  return s.replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
    (m) => '${m[1]},',
  );
}

class MandiPriceCard extends StatelessWidget {
  final Map<String, dynamic> price;
  final VoidCallback? onTap;
  final AppState? state;

  const MandiPriceCard({super.key, required this.price, this.onTap, this.state});

  @override
  Widget build(BuildContext context) {
    final trend = price['trend'] as String? ?? 'flat';
    final trendColor =
        trend == 'up'
            ? const Color(0xFF16A34A)
            : trend == 'down'
                ? Colors.red
                : Colors.grey;
    final trendIcon = trend == 'up'
        ? Icons.trending_up_rounded
        : trend == 'down'
            ? Icons.trending_down_rounded
            : Icons.trending_flat_rounded;
    final modal = (price['modalPrice'] as num?) ?? 0;
    final minP = (price['minPrice'] as num?) ?? 0;
    final maxP = (price['maxPrice'] as num?) ?? 0;
    final msp = (price['msp'] as num?) ?? 0;

    return GestureDetector(
      onTap: onTap,
      child: GlassCard(
        margin: const EdgeInsets.only(bottom: 12),
        border: Border(left: BorderSide(color: trendColor, width: 4)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "${price['distanceKm']} ${_t(state, 'market.kmAway')} • ${price['updatedAt']}",
                        style: const TextStyle(fontSize: 10.5, color: Colors.grey),
                      ),
                      Text(
                        "${price['mandiName']}",
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1B4332),
                        ),
                      ),
                      Text(
                        "${price['commodity']} • ${price['variety']}",
                        style: const TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      "₹${fmtInr(modal)}",
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1B4332),
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(trendIcon, size: 13, color: trendColor),
                        const SizedBox(width: 2),
                        Text(
                          "${price['changePercent']}",
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: trendColor,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "${_t(state, 'market.minShort')}: ₹${fmtInr(minP)} | ${_t(state, 'market.maxShort')}: ₹${fmtInr(maxP)}",
                  style: const TextStyle(fontSize: 11.5, color: Colors.black87),
                ),
                Text(
                  "${_t(state, 'market.arrivals')}: ${price['arrivalsQuintals']}q",
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1B4332),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "MSP: ₹${fmtInr(msp)}",
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF6D4C41),
                  ),
                ),
                IconButton(
                  tooltip: _t(state, 'market.listenAudio'),
                  iconSize: 18,
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.volume_up_rounded, color: Color(0xFF2E7D32)),
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(_t(state, 'market.audioComingSoon'))),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
