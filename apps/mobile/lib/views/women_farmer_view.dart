// Module I: Women Farmer Mode — API-wired port (Day 14 Task B1).
// SHG tab ← GET /v1/women/shg + POST /women/shg/deposit; गृह उद्योग tab ←
// GET /v1/women/home-enterprise. Kitchen-garden & livestock-health tabs ←
// GET /v1/women/garden-plans and GET /v1/women/backyard-livestock.

import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../api/women_api.dart';
import '../models/women_models.dart';
import '../state/app_state.dart';
import 'women_farmer_widgets.dart';
import 'women_garden_card.dart';
import 'women_livestock_card.dart';

class WomenFarmerView extends StatefulWidget {
  final AppState state;
  final WomenApi? womenApi;

  const WomenFarmerView({super.key, required this.state, this.womenApi});

  @override
  State<WomenFarmerView> createState() => _WomenFarmerViewState();
}

class _WomenFarmerViewState extends State<WomenFarmerView> {
  late final WomenApi _api = widget.womenApi ?? WomenApi();

  int _selectedTab = 0; // 0: SHG, 1: Kitchen Garden, 2: Livestock, 3: Enterprise
  ShgProfile? _shg;
  HomeEnterpriseSummary? _enterprise;
  bool _loading = true;
  bool _error = false;
  bool _depositing = false;

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
      final shg = await _api.getShg();
      final enterprise = await _api.getHomeEnterprise();
      if (!mounted) return;
      setState(() {
        _shg = shg;
        _enterprise = enterprise;
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

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _deposit() async {
    final profile = _shg;
    if (profile == null || _depositing) return;
    setState(() => _depositing = true);
    final now = DateTime.now();
    final month = '${now.year}-${now.month.toString().padLeft(2, '0')}';
    try {
      final res = await _api.deposit(
          amount: profile.monthlyDeposit, month: month);
      final newCorpus = (res['newCorpus'] as num?)?.toDouble() ??
          profile.corpus + profile.monthlyDeposit;
      if (!mounted) return;
      setState(() {
        _shg = profile.copyWith(corpus: newCorpus);
        _depositing = false;
      });
      _snack(widget.state
          .tr('women.depositSuccess')
          .replaceAll('{amount}', inrFormat.format(newCorpus)));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _depositing = false);
      _snack(e.code == 'DUPLICATE_DEPOSIT_MONTH'
          ? widget.state.tr('women.depositDuplicateMonth')
          : (e.message.isNotEmpty ? e.message : e.code));
    }
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
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFBE123C), Color(0xFFE11D48)],
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.state.tr('women.headerTitle'),
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(widget.state.tr('women.headerSubtitle'),
                    style: const TextStyle(
                        color: Color(0xFFFFE4E6), fontSize: 12, height: 1.4)),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Tabs
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _tabBtn(0, widget.state.tr('women.tabShg')),
                _tabBtn(1, widget.state.tr('women.tabGarden')),
                _tabBtn(2, widget.state.tr('women.tabLivestock')),
                _tabBtn(3, widget.state.tr('women.tabEnterprise')),
              ],
            ),
          ),
          const SizedBox(height: 14),

          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: CircularProgressIndicator(color: Color(0xFFE11D48)),
              ),
            )
          else if (_error)
            Center(
              child: Column(
                children: [
                  const SizedBox(height: 40),
                  Text(widget.state.tr('women.loadFailed'),
                      style: const TextStyle(
                          color: Colors.grey, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  ElevatedButton(
                      onPressed: _load,
                      child: Text(widget.state.tr('retry'))),
                ],
              ),
            )
          else ...[
            if (_selectedTab == 0 && _shg != null)
              ShgCard(
                profile: _shg!,
                depositing: _depositing,
                onDeposit: _deposit,
                state: widget.state,
              ),
            if (_selectedTab == 1)
              GardenPlannerCard(state: widget.state, api: _api),
            if (_selectedTab == 2)
              LivestockHealthCard(state: widget.state, api: _api),
            if (_selectedTab == 3 && _enterprise != null)
              EnterpriseIncomeCard(summary: _enterprise!, state: widget.state),
          ],
        ],
      ),
    );
  }

  Widget _tabBtn(int idx, String label) {
    final active = _selectedTab == idx;
    return GestureDetector(
      onTap: () => setState(() => _selectedTab = idx),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: active ? const Color(0xFFE11D48) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
              color:
                  active ? const Color(0xFFE11D48) : Colors.grey.shade300),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 12,
                fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                color: active ? Colors.white : Colors.black87)),
      ),
    );
  }
}
