// Module O: Crop Insurance (प्रधानमंत्री फसल बीमा योजना & RWBCIS)
// API-wired port: /v1/insurance/* (Day 11 Tasks B1/B3/B5).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/insurance_api.dart';
import '../components/common/motion_animations.dart';
import '../core/photo_upload.dart';
import '../models/insurance_models.dart';
import '../state/app_state.dart';
import 'crop_insurance/calculator_section.dart';
import 'crop_insurance/claim_form_section.dart';
import 'crop_insurance/claim_success_dialog.dart';
import 'crop_insurance/insurance_header.dart';
import 'crop_insurance/policies_section.dart';
import 'crop_insurance/segmented_tabs.dart';
import 'crop_insurance/tracker_section.dart';

class CropInsuranceView extends StatefulWidget {
  final AppState state;
  final InsuranceApi? insuranceApi;
  final int initialTab;
  final Future<XFile?> Function()? photoPicker;
  final PhotoUploader? photoUploader;

  const CropInsuranceView({
    super.key,
    required this.state,
    this.insuranceApi,
    this.initialTab = 0,
    this.photoPicker,
    this.photoUploader,
  });

  @override
  State<CropInsuranceView> createState() => _CropInsuranceViewState();
}

class _CropInsuranceViewState extends State<CropInsuranceView> {
  late final InsuranceApi _api = widget.insuranceApi ?? InsuranceApi();

  int _selectedTab = 0; // 0: Policies, 1: 72h Claim, 2: Calculator, 3: Tracker
  List<CropInsurancePolicy> _policies = const [];
  List<InsuranceClaimRecord> _claims = const [];
  List<CropPremiumRate> _rates = const [];
  String _calcSeason = 'Kharif';
  bool _loading = true;
  String? _claimPreselectPolicyId;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _selectedTab = widget.initialTab;
    _loadAll();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadAll() async {
    try {
      final results = await Future.wait([
        _api.listPolicies(),
        _api.listClaims(),
        _api.getRates(season: _calcSeason),
      ]);
      if (!mounted) return;
      setState(() {
        _policies = results[0] as List<CropInsurancePolicy>;
        _claims = results[1] as List<InsuranceClaimRecord>;
        _rates = results[2] as List<CropPremiumRate>;
        _loading = false;
      });
      _updatePolling();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _loadRates(String season) async {
    _calcSeason = season;
    try {
      final rates = await _api.getRates(season: season);
      if (!mounted) return;
      setState(() => _rates = rates);
    } catch (_) {}
  }

  // Live tracker: poll non-terminal claims every 30 s (Day 11 B1.6).
  void _updatePolling() {
    final hasLive = _claims.any((c) => !c.isTerminal);
    if (!hasLive) {
      _pollTimer?.cancel();
      _pollTimer = null;
      return;
    }
    _pollTimer ??= Timer.periodic(const Duration(seconds: 30), (_) => _poll());
  }

  Future<void> _poll() async {
    for (final claim in _claims.where((c) => !c.isTerminal)) {
      try {
        final fresh = await _api.getClaim(claim.id);
        if (!mounted) return;
        setState(() {
          _claims = [
            for (final c in _claims) c.id == fresh.id ? fresh : c,
          ];
        });
      } catch (_) {}
    }
    _updatePolling();
  }

  void _fileClaimFor(CropInsurancePolicy policy) {
    setState(() {
      _claimPreselectPolicyId = policy.id;
      _selectedTab = 1;
    });
  }

  Future<void> _onClaimSubmitted(
    String claimNumber,
    List<String> photoGuidelines,
  ) async {
    await showClaimSuccessDialog(context, claimNumber, photoGuidelines);
    if (!mounted) return;
    setState(() => _selectedTab = 3);
    _loadAll();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: const Color(0xFF047857),
      onRefresh: _loadAll,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            StaggeredSlideFade(
              delayMs: 0,
              duration: const Duration(milliseconds: 400),
              child: InsuranceHeader(
                totalAreaAcres:
                    _policies.fold(0.0, (s, p) => s + p.landAreaAcres),
                totalSumInsured:
                    _policies.fold(0.0, (s, p) => s + p.sumInsured),
                totalSubsidy:
                    _policies.fold(0.0, (s, p) => s + p.govtSubsidy),
              ),
            ),
            const SizedBox(height: 14),
            StaggeredSlideFade(
              delayMs: 60,
              duration: const Duration(milliseconds: 400),
              child: const InsuranceEmergencyBanner(),
            ),
            const SizedBox(height: 14),
            StaggeredSlideFade(
              delayMs: 120,
              duration: const Duration(milliseconds: 400),
              child: _buildSegmentedTabs(context),
            ),
            const SizedBox(height: 16),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 350),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0, 0.04),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              ),
              child: KeyedSubtree(
                key: ValueKey<int>(_selectedTab),
                child: _buildActiveTabContent(context),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSegmentedTabs(BuildContext context) {
    return InsuranceTabBar(
      selected: _selectedTab,
      policyCount: _policies.length,
      claimCount: _claims.length,
      onSelect: (index) => setState(() => _selectedTab = index),
    );
  }

  Widget _buildActiveTabContent(BuildContext context) {
    if (_loading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 60),
          child: CircularProgressIndicator(color: Color(0xFF047857)),
        ),
      );
    }
    switch (_selectedTab) {
      case 0:
        return PoliciesSection(
          policies: _policies,
          rates: _rates,
          api: _api,
          onRefresh: _loadAll,
          onFileClaim: _fileClaimFor,
        );
      case 1:
        return ClaimFormSection(
          policies: _policies,
          api: _api,
          appState: widget.state,
          photoPicker: widget.photoPicker,
          initialPolicyId: _claimPreselectPolicyId,
          onSubmitted: _onClaimSubmitted,
        );
      case 2:
        return CalculatorSection(
          rates: _rates,
          season: _calcSeason,
          onSeasonChanged: _loadRates,
        );
      case 3:
      default:
        return TrackerSection(
          claims: _claims,
          api: _api,
          photoUploader: widget.photoUploader,
          onRefresh: _loadAll,
        );
    }
  }
}
