// Module H: FPO Growth Engine Flutter View

import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../api/fpo_api.dart';
import '../state/app_state.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';
import 'fpo/fpo_widgets.dart';

class FpoEngineView extends StatefulWidget {
  final AppState state;
  final FpoApi? fpoApi;
  const FpoEngineView({super.key, required this.state, this.fpoApi});

  @override
  State<FpoEngineView> createState() => _FpoEngineViewState();
}

class _FpoEngineViewState extends State<FpoEngineView> {
  late final FpoApi _api = widget.fpoApi ?? FpoApi();

  bool _loading = true;
  Map<String, dynamic>? _fpo;
  List<Map<String, dynamic>> _pools = [];
  List<Map<String, dynamic>> _machinery = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    Map<String, dynamic>? fpo;
    var pools = <Map<String, dynamic>>[];
    var machinery = <Map<String, dynamic>>[];
    try {
      fpo = await _api.getFpoMe();
    } catch (_) {}
    try {
      final res = await _api.getPools();
      pools = (res['data'] as List).cast<Map<String, dynamic>>().toList();
    } catch (_) {}
    try {
      final res = await _api.getMachinery();
      machinery = (res['data'] as List).cast<Map<String, dynamic>>();
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _fpo = fpo;
      _pools = pools;
      _machinery = machinery;
      _loading = false;
    });
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _joinPool(Map<String, dynamic> pool) async {
    final units = await showDialog<int>(
      context: context,
      builder: (_) => JoinPoolDialog(item: "${pool['item']}", state: widget.state),
    );
    if (units == null) return;
    try {
      final updated = await _api.joinPool("${pool['id']}", units);
      if (!mounted) return;
      setState(() {
        final idx = _pools.indexWhere((p) => p['id'] == pool['id']);
        if (idx >= 0) _pools[idx] = updated;
      });
      _snack(widget.state.tr('fpo.unitsAdded').replaceAll('{units}', '$units'));
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
      if (e.code == 'POOL_FULL') _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final fpo = _fpo;
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
                  Text(widget.state.tr('fpo.headerTitle'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text(widget.state.tr('fpo.headerSubtitle'), style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              AudioButton(
                text: _pools.isEmpty
                    ? widget.state.tr('fpo.audioEmpty')
                    : widget.state
                        .tr('fpo.audioDiscount')
                        .replaceAll('{name}', "${fpo?['name'] ?? 'FPO'}")
                        .replaceAll('{item}', "${_pools.first['item']}")
                        .replaceAll('{discount}', "${_pools.first['discountPercent']}"),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // FPO Profile Banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF1B4332), Color(0xFF2D6A4F)]),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "${fpo?['name'] ?? '...'}",
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  "${widget.state.tr('fpo.members')}: ${fpo?['memberCount'] ?? '...'} ${widget.state.tr('fpo.farmers')} • ${fpo?['district'] ?? ''}",
                  style: const TextStyle(color: Color(0xFFD8F3DC), fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Bulk Procurement Pool
          GlassCard(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _pools.isEmpty
                    ? Text(widget.state.tr('fpo.noActivePools'), style: const TextStyle(fontSize: 12, color: Colors.grey))
                    : PoolCard(pool: _pools.first, onJoin: () => _joinPool(_pools.first), state: widget.state),
          ),
          const SizedBox(height: 14),

          // Shared Machinery
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.state.tr('fpo.machineryCalendar'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                const SizedBox(height: 10),
                MachineryCalendar(machines: _machinery, state: widget.state),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
