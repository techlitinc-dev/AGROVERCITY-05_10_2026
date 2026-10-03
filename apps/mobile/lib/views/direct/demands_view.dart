import 'package:flutter/material.dart';

import '../../api/demands_api.dart';
import '../../components/direct/direct_widgets.dart';
import '../../components/common/motion_animations.dart';
import '../../components/mandi/mandi_price_card.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';
import 'demand_form_sheet.dart';

class DemandsView extends StatefulWidget {
  final AppState state;
  final DemandsApi? demandsApi;

  const DemandsView({super.key, required this.state, this.demandsApi});

  @override
  State<DemandsView> createState() => _DemandsViewState();
}

class _DemandsViewState extends State<DemandsView> {
  late final DemandsApi _api = widget.demandsApi ?? DemandsApi();
  List<Demand> _demands = const [];
  bool _loading = true;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.listDemands(status: 'all');
      if (!mounted) return;
      setState(() {
        _demands = ((res['data'] as List?) ?? const <dynamic>[])
            .map((e) => Demand.fromJson((e as Map).cast<String, dynamic>()))
            .toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _demands = const [];
          _loading = false;
        });
      }
    }
  }

  List<Demand> get _filtered => _filter == 'all'
      ? _demands
      : _demands.where((d) => d.status == _filter).toList();

  Future<void> _create() async {
    final ok = await DemandFormSheet.show(context, state: widget.state, api: _api);
    if (ok == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.state.tr;
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF4F46E5),
        foregroundColor: Colors.white,
        onPressed: _create,
        icon: const Icon(Icons.add_rounded),
        label: Text(tr('direct.newDemand'),
            style: const TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 110),
          children: [
            Text(tr('direct.demandsTitle'),
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(tr('direct.demandsSubtitle'),
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final f in const ['all', 'open', 'fulfilled', 'closed']) ...[
                    if (f != 'all') const SizedBox(width: 8),
                    ChoiceChip(
                      label: Text(
                          f == 'all' ? tr('direct.allLabel') : demandStatusLabel(widget.state, f)),
                      selected: _filter == f,
                      onSelected: (_) => setState(() => _filter = f),
                      selectedColor: const Color(0xFF4F46E5),
                      labelStyle: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w900,
                          color: _filter == f ? Colors.white : Colors.black87),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (_loading)
              Container(
                height: 72,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                ),
              )
            else if (_filtered.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: DirectEmptyState(
                    icon: Icons.campaign_outlined, message: tr('direct.noDemands')),
              )
            else
              for (final d in _filtered) _demandCard(d),
          ],
        ),
      ),
    );
  }

  Widget _demandCard(Demand d) {
    return BouncyPressable(
      onTap: () async {
        widget.state.openDemandDetail(d.id);
      },
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    d.variety.isEmpty ? d.crop : "${d.crop} (${d.variety})",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13.5, fontWeight: FontWeight.w900),
                  ),
                ),
                DirectStatusChip(
                    label: demandStatusLabel(widget.state, d.status),
                    color: demandStatusColor(d.status)),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              "${qtyText(d.quantity)} ${d.unit} • ${widget.state.tr('direct.maxPriceLabel')} ₹${fmtInr(d.maxPrice)}/${d.unit == 'kg' ? 'kg' : 'q'} • ${d.qualityGrade}",
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 2),
            Text(
              "${d.deliveryLocation} • ${widget.state.tr('direct.neededByLabel')} ${d.neededBy}",
              style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.handshake_outlined,
                    size: 13, color: const Color(0xFF4F46E5)),
                const SizedBox(width: 4),
                Text(
                  widget.state
                      .tr('direct.offersCountLabel')
                      .replaceAll('{count}', "${d.offersCount}"),
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF4F46E5)),
                ),
                const Spacer(),
                Icon(Icons.chevron_right_rounded,
                    color: Colors.grey.shade400),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
