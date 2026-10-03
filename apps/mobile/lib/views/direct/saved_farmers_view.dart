import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/direct_buyer_api.dart';
import '../../components/direct/direct_widgets.dart';
import '../../models/direct_buyer_models.dart';
import '../../state/app_state.dart';

class SavedFarmersView extends StatefulWidget {
  final AppState state;
  final DirectBuyerApi? directBuyerApi;

  const SavedFarmersView({super.key, required this.state, this.directBuyerApi});

  @override
  State<SavedFarmersView> createState() => _SavedFarmersViewState();
}

class _SavedFarmersViewState extends State<SavedFarmersView> {
  late final DirectBuyerApi _api = widget.directBuyerApi ?? DirectBuyerApi();
  List<SavedFarmer> _farmers = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final farmers = await _api.getSavedFarmers();
      if (!mounted) return;
      setState(() {
        _farmers = farmers;
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _farmers = const [];
          _loading = false;
        });
      }
    }
  }

  Future<void> _remove(SavedFarmer f) async {
    try {
      await _api.removeSavedFarmer(f.farmerId);
      widget.state.showToast(widget.state.tr('direct.farmerRemovedMsg'));
      await _load();
    } on ApiException catch (e) {
      widget.state.showToast(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.state.tr;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
          children: [
            Text(tr('direct.savedFarmersTitle'),
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            if (_loading)
              Container(
                height: 90,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
              )
            else if (_farmers.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: DirectEmptyState(
                    icon: Icons.bookmark_outline_rounded,
                    message: tr('direct.noSavedFarmers')),
              )
            else
              for (final f in _farmers) _farmerCard(f),
          ],
        ),
      ),
    );
  }

  Widget _farmerCard(SavedFarmer f) {
    return Container(
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
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: const Color(0xFF16A34A).withValues(alpha: 0.12),
            child: const Icon(Icons.person_rounded,
                color: Color(0xFF16A34A), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(f.farmerName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w900)),
                const SizedBox(height: 2),
                Text(
                  "${f.village}${f.district.isEmpty ? '' : ' • ${f.district}'}",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
                ),
                Row(
                  children: [
                    Icon(Icons.star_rounded,
                        size: 14,
                        color: f.rating > 0
                            ? const Color(0xFFF59E0B)
                            : Colors.grey.shade400),
                    const SizedBox(width: 2),
                    Text(
                      f.rating > 0 ? f.rating.toStringAsFixed(1) : '—',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Colors.grey.shade700),
                    ),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: widget.state.tr('direct.farmerRemovedMsg'),
            onPressed: () => _remove(f),
            icon: const Icon(Icons.bookmark_remove_rounded,
                color: Color(0xFFDC2626)),
          ),
        ],
      ),
    );
  }
}
