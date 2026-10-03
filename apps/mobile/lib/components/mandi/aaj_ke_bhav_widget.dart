import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../api/mandi_api.dart';
import '../../state/app_state.dart';
import '../common/glass_card.dart';
import '../common/motion_animations.dart';

const String kVyapariCache = 'kVyapariCache';

class AajKeBhavWidget extends StatefulWidget {
  final AppState state;
  final MandiApi? mandiApi;

  const AajKeBhavWidget({super.key, required this.state, this.mandiApi});

  @override
  State<AajKeBhavWidget> createState() => _AajKeBhavWidgetState();
}

class _AajKeBhavWidgetState extends State<AajKeBhavWidget> {
  late final MandiApi _api = widget.mandiApi ?? MandiApi();
  List<Map<String, dynamic>> _rates = [];
  String? _cachedAt;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.getVyapariRates(
        crops: widget.state.profile.activeCrops,
      );
      final data = (res['data'] as List).cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        _rates = data;
        _cachedAt = null;
        _loading = false;
      });
      _saveCache(data);
    } catch (_) {
      await _loadCache();
    }
  }

  Future<void> _saveCache(List<Map<String, dynamic>> data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        kVyapariCache,
        jsonEncode({
          'fetchedAt': DateTime.now().toIso8601String(),
          'data': data,
        }),
      );
    } catch (_) {}
  }

  Future<void> _loadCache() async {
    List<Map<String, dynamic>> cached = [];
    String? fetchedAt;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(kVyapariCache);
      if (raw != null) {
        final decoded = jsonDecode(raw) as Map<String, dynamic>;
        cached = (decoded['data'] as List).cast<Map<String, dynamic>>();
        fetchedAt = decoded['fetchedAt'] as String?;
      }
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _rates = cached;
      _cachedAt = fetchedAt;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      backgroundColor: Colors.white,
      border: Border.all(color: const Color(0xFFECEFF1)),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text("💰", style: TextStyle(fontSize: 16)),
              ),
              const SizedBox(width: 8),
              Text(
                widget.state.tr('aajKeBhav'),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF263238),
                ),
              ),
              const SizedBox(width: 8),
              const AnimatedAudioWaveform(
                barCount: 5,
                height: 14,
                color: Color(0xFF43A047),
              ),
              if (_cachedAt != null) ...[
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    "(cached ${_cachedAt!.length >= 16 ? _cachedAt!.substring(11, 16) : _cachedAt})",
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFFEA580C),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          if (_loading)
            for (var i = 0; i < 2; i++)
              Container(
                margin: const EdgeInsets.symmetric(vertical: 4),
                height: 34,
                decoration: BoxDecoration(
                  color: Colors.grey.shade200,
                  borderRadius: BorderRadius.circular(12),
                ),
              )
          else if (_rates.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                widget.state.tr('noDataAvailable'),
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
            )
          else
            ...List.generate(_rates.length, (index) => _rateRow(index, _rates[index])),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: BouncyPressable(
              onTap: () => widget.state.navigateTo('mandi'),
              child: Text(
                widget.state.tr('viewAllMandiRates'),
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF43A047),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _rateRow(int index, Map<String, dynamic> vr) {
    final changeDir = vr['changeDir'] as String? ?? 'flat';
    Color changeColor = Colors.grey;
    IconData arrow = Icons.remove_rounded;
    if (changeDir == 'up') {
      changeColor = const Color(0xFF2E7D32);
      arrow = Icons.arrow_upward_rounded;
    } else if (changeDir == 'down') {
      changeColor = const Color(0xFFD32F2F);
      arrow = Icons.arrow_downward_rounded;
    }

    return StaggeredSlideFade(
      delayMs: 100 + (index * 60),
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    "${vr['crop']}",
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF263238),
                    ),
                  ),
                ),
                Text(
                  "${vr['rateDisplay']}",
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF263238),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: changeColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(arrow, size: 12, color: changeColor),
                      const SizedBox(width: 2),
                      Text(
                        "${vr['priceChange']}",
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w900,
                          color: changeColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              "${vr['mandiName']} • ${vr['vyapariCount']} ${widget.state.tr('tradersUpdated')} • ${vr['lastUpdated']}",
              style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
            ),
          ],
        ),
      ),
    );
  }
}
