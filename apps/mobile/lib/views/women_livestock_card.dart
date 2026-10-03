// Backyard livestock health card — GET /v1/women/backyard-livestock.

import 'package:flutter/material.dart';

import '../api/women_api.dart';
import '../components/common/glass_card.dart';
import '../models/women_models.dart';
import '../state/app_state.dart';

class LivestockHealthCard extends StatefulWidget {
  final AppState state;
  final WomenApi api;

  const LivestockHealthCard({super.key, required this.state, required this.api});

  @override
  State<LivestockHealthCard> createState() => _LivestockHealthCardState();
}

class _LivestockHealthCardState extends State<LivestockHealthCard> {
  bool _loading = true;
  bool _error = false;
  List<BackyardLivestock> _animals = const [];

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
      final animals = await widget.api.getBackyardLivestock();
      if (!mounted) return;
      setState(() {
        _animals = animals;
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
    if (_animals.isEmpty) {
      return GlassCard(
        child: Text(widget.state.tr('women.livestockEmpty'),
            style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.w600)),
      );
    }
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.state.tr('women.livestockTitle'),
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFFBE123C))),
          const SizedBox(height: 10),
          for (var i = 0; i < _animals.length; i++) ...[
            if (i > 0) const Divider(),
            _livestockItem(_animals[i]),
          ],
        ],
      ),
    );
  }

  Widget _livestockItem(BackyardLivestock animal) {
    final name = animal.vernacularName.isNotEmpty
        ? '${animal.vernacularName} (${animal.animal})'
        : animal.animal;
    final care = [
      if (animal.vaccine.isNotEmpty) animal.vaccine,
      if (animal.vaccineDue.isNotEmpty) animal.vaccineDue,
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
                Text('$name × ${animal.count}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 12.5)),
                if (care.isNotEmpty)
                  Text(care,
                      style: const TextStyle(fontSize: 10.5, color: Colors.grey)),
              ],
            ),
          ),
          if (animal.yieldLabel.isNotEmpty)
            Flexible(
              child: Text(animal.yieldLabel,
                  textAlign: TextAlign.end,
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1B4332))),
            ),
        ],
      ),
    );
  }
}
