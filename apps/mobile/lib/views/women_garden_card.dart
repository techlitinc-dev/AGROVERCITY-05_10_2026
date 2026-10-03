// Kitchen-garden planner card — GET /v1/women/garden-plans.

import 'package:flutter/material.dart';

import '../api/women_api.dart';
import '../components/common/glass_card.dart';
import '../models/women_models.dart';
import '../state/app_state.dart';

class GardenPlannerCard extends StatefulWidget {
  final AppState state;
  final WomenApi api;

  const GardenPlannerCard({super.key, required this.state, required this.api});

  @override
  State<GardenPlannerCard> createState() => _GardenPlannerCardState();
}

class _GardenPlannerCardState extends State<GardenPlannerCard> {
  bool _loading = true;
  bool _error = false;
  List<GardenPlan> _plans = const [];

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
      final plans = await widget.api.getGardenPlans();
      if (!mounted) return;
      setState(() {
        _plans = plans;
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

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const GlassCard(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 24),
          child: Center(
            child: CircularProgressIndicator(color: Color(0xFFE11D48)),
          ),
        ),
      );
    }
    if (_error) {
      return GlassCard(
        child: Column(
          children: [
            Text(widget.state.tr('women.loadFailed'),
                style:
                    const TextStyle(color: Colors.grey, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            ElevatedButton(
                onPressed: _load,
                child: Text(widget.state.tr('retry'))),
          ],
        ),
      );
    }
    if (_plans.isEmpty) {
      return GlassCard(
        child: Text(widget.state.tr('women.gardenEmpty'),
            style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
      );
    }
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.state.tr('women.gardenTitle'),
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFFBE123C))),
          const SizedBox(height: 10),
          for (var pi = 0; pi < _plans.length; pi++) ...[
            if (pi > 0) const Divider(),
            for (var ii = 0; ii < _plans[pi].items.length; ii++) ...[
              if (ii > 0) const Divider(),
              _gardenItem(_plans[pi].items[ii]),
            ],
          ],
        ],
      ),
    );
  }

  Widget _gardenItem(GardenPlanItem item) {
    final name = item.vernacularName.isNotEmpty
        ? '${item.vernacularName} (${item.name})'
        : item.name;
    final subtitle = [
      if (item.nutrition.isNotEmpty)
        '${widget.state.tr('women.nutritionLabel')} ${item.nutrition}',
      if (item.companion.isNotEmpty) item.companion,
      if (item.daysToHarvest > 0) '${item.daysToHarvest} d',
    ].join(' • ');
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 12.5)),
                if (subtitle.isNotEmpty)
                  Text(subtitle,
                      style:
                          const TextStyle(fontSize: 11, color: Color(0xFFE11D48))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
