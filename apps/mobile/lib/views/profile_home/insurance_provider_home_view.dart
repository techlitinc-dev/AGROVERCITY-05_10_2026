// Insurance Provider Workspace & Executive Dashboard (12th Persona)
// Allows reviewing farmer policy applications, risk underwriting, surveyor assignment,
// claim sanctioning, DBT disbursements, and portfolio risk management.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../api/insurance_api.dart';
import '../../models/insurance_models.dart';
import '../../models/user_profile_type.dart';
import '../../state/app_state.dart';
import '../crop_insurance/provider_dialogs.dart';

final _inr = NumberFormat('#,##,##0', 'en_IN');

class InsuranceProviderHomeView extends StatefulWidget {
  final AppState state;
  final InsuranceApi? insuranceApi;

  const InsuranceProviderHomeView({
    super.key,
    required this.state,
    this.insuranceApi,
  });

  @override
  State<InsuranceProviderHomeView> createState() => _InsuranceProviderHomeViewState();
}

class _InsuranceProviderHomeViewState extends State<InsuranceProviderHomeView> {
  late final InsuranceApi _api = widget.insuranceApi ?? InsuranceApi();

  int _currentTab = 0; // 0: Policies, 1: Claims, 2: Schemes & Rates, 3: Analytics
  String _policyFilter = 'pending_approval'; // pending_approval, active, rejected, all
  String _claimFilter = 'all';

  InsuranceProviderStats? _stats;
  List<CropInsurancePolicy> _policies = [];
  List<InsuranceClaimRecord> _claims = [];
  List<InsuranceScheme> _schemes = [];
  List<CropPremiumRate> _rates = [];
  bool _loading = true;
  bool _error = false;

  Color get _primary => UserProfileRegistry.meta(UserProfileType.insuranceProvider).primaryColor;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final results = await Future.wait([
        _api.getProviderStats(),
        _api.listProviderPolicies(status: _policyFilter),
        _api.listProviderClaims(status: _claimFilter),
        _api.listSchemes(),
        _api.getRates(),
      ]);
      if (!mounted) return;
      setState(() {
        _stats = results[0] as InsuranceProviderStats;
        _policies = (results[1] as Map<String, dynamic>)['data'] as List<CropInsurancePolicy>;
        _claims = (results[2] as Map<String, dynamic>)['data'] as List<InsuranceClaimRecord>;
        _schemes = results[3] as List<InsuranceScheme>;
        _rates = results[4] as List<CropPremiumRate>;
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

  Future<void> _fetchPolicies() async {
    try {
      final res = await _api.listProviderPolicies(status: _policyFilter);
      if (!mounted) return;
      setState(() {
        _policies = res['data'] as List<CropInsurancePolicy>;
      });
    } catch (_) {}
  }

  Future<void> _fetchClaims() async {
    try {
      final res = await _api.listProviderClaims(status: _claimFilter);
      if (!mounted) return;
      setState(() {
        _claims = res['data'] as List<InsuranceClaimRecord>;
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final stats = _stats;

    return RefreshIndicator(
      onRefresh: _refresh,
      color: _primary,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
        children: [
          // Header identity
          _buildHeader(state),
          const SizedBox(height: 14),

          if (_loading && stats == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error && stats == null)
            Center(
              child: Column(
                children: [
                  const Text('डेटा लोड करने में त्रुटि', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  ElevatedButton(onPressed: _refresh, child: const Text('पुनः प्रयास करें')),
                ],
              ),
            )
          else ...[
            // KPI Stat cards
            _buildKpis(stats),
            const SizedBox(height: 14),

            // Tab navigation selector
            _buildTabSelector(),
            const SizedBox(height: 14),

            // Active Tab Content
            if (_currentTab == 0)
              _buildPoliciesTab()
            else if (_currentTab == 1)
              _buildClaimsTab()
            else if (_currentTab == 2)
              _buildSchemesAndRatesTab()
            else
              _buildAnalyticsTab(stats),
          ],
        ],
      ),
    );
  }

  Widget _buildHeader(AppState state) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [_primary, const Color(0xFF042F2E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: _primary.withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.shield_rounded, color: Color(0xFFFDE68A), size: 18),
                  const SizedBox(width: 6),
                  Text(
                    state.tr('persona.insuranceProvider.label'),
                    style: const TextStyle(color: Color(0xFFFDE68A), fontSize: 12, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'IRDAI Licensed',
                  style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            state.profile.name.isNotEmpty ? state.profile.name : 'Dr. Rajesh Varma (बीमा प्रदाता)',
            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 2),
          Text(
            'AIC of India (कृषि बीमा कंपनी) • लाइसेंस: IRDAI/NL/AGRI/2026/089',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 11, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  Widget _buildKpis(InsuranceProviderStats? stats) {
    final pending = stats?.pendingPolicies ?? 0;
    final active = stats?.activePolicies ?? 0;
    final claimsPending = stats?.pendingClaims ?? 0;
    final lossRatio = stats?.lossRatioPercent ?? 0.0;

    return Row(
      children: [
        _kpiCard('लंबित समीक्षा', '$pending', const Color(0xFFD97706), Icons.pending_actions_rounded),
        const SizedBox(width: 8),
        _kpiCard('सक्रिय कवर', '$active', _primary, Icons.verified_user_rounded),
        const SizedBox(width: 8),
        _kpiCard('दावे लंबित', '$claimsPending', const Color(0xFFDC2626), Icons.report_problem_rounded),
        const SizedBox(width: 8),
        _kpiCard('दावा अनुपात', '$lossRatio%', const Color(0xFF16A34A), Icons.auto_graph_rounded),
      ],
    );
  }

  Widget _kpiCard(String label, String value, Color color, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: color)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.w600), textAlign: TextAlign.center, maxLines: 1),
          ],
        ),
      ),
    );
  }

  Widget _buildTabSelector() {
    final tabs = [
      {'title': 'पॉलिसी समीक्षा', 'icon': Icons.description_rounded},
      {'title': 'दावा निपटान', 'icon': Icons.assignment_turned_in_rounded},
      {'title': 'योजनाएं व दरें', 'icon': Icons.format_list_bulleted_rounded},
      {'title': 'विश्लेषण', 'icon': Icons.pie_chart_rounded},
    ];

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: List.generate(tabs.length, (i) {
          final selected = _currentTab == i;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _currentTab = i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: selected ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: selected
                      ? [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 4, offset: const Offset(0, 2))]
                      : null,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      tabs[i]['icon'] as IconData,
                      size: 16,
                      color: selected ? _primary : const Color(0xFF64748B),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      tabs[i]['title'] as String,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                        color: selected ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 1,
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildPoliciesTab() {
    final filterMap = {
      'pending_approval': 'लंबित (${_stats?.pendingPolicies ?? 0})',
      'active': 'सक्रिय (${_stats?.activePolicies ?? 0})',
      'rejected': 'अस्वीकृत (${_stats?.rejectedPolicies ?? 0})',
      'all': 'सभी (${_stats?.totalPolicies ?? 0})',
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Filter chips
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: filterMap.entries.map((e) {
              final sel = _policyFilter == e.key;
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(e.value, style: TextStyle(fontSize: 11, fontWeight: sel ? FontWeight.w800 : FontWeight.w600)),
                  selected: sel,
                  selectedColor: _primary.withValues(alpha: 0.15),
                  labelStyle: TextStyle(color: sel ? _primary : const Color(0xFF475569)),
                  onSelected: (_) {
                    setState(() => _policyFilter = e.key);
                    _fetchPolicies();
                  },
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 10),

        if (_policies.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 30),
            child: Center(
              child: Text(
                'इस श्रेणी में कोई पॉलिसी आवेदन नहीं मिला',
                style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
              ),
            ),
          )
        else
          for (final pol in _policies) ...[
            _buildPolicyReviewCard(pol),
            const SizedBox(height: 10),
          ],
      ],
    );
  }

  Widget _buildPolicyReviewCard(CropInsurancePolicy pol) {
    Color riskColor = const Color(0xFF16A34A);
    if (pol.riskCategory == 'High') {
      riskColor = const Color(0xFFDC2626);
    } else if (pol.riskCategory == 'Medium') {
      riskColor = const Color(0xFFD97706);
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                pol.policyNumber,
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF0F172A)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: riskColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'जोखिम: ${pol.riskCategory ?? "Low"} (${pol.riskScore ?? 25})',
                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: riskColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${pol.farmerName ?? "किसान"} • ${pol.village ?? "नाशिक"}, ${pol.district ?? "MH"}',
            style: const TextStyle(fontSize: 12, color: Color(0xFF475569), fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _miniDetail('फसल', '${pol.cropName} (${pol.season})'),
                _miniDetail('रकबा', '${pol.landAreaAcres} एकड़'),
                _miniDetail('बीमित राशि', '₹${_inr.format(pol.sumInsured.toInt())}'),
                _miniDetail('प्रीमियम', '₹${_inr.format(pol.farmerPremium.toInt())}'),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Actions
          if (pol.isPending) ...[
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () async {
                      final res = await ProviderDialogs.showRejectPolicyDialog(context, pol, _api);
                      if (res == true) _refresh();
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFDC2626),
                      side: const BorderSide(color: Color(0xFFDC2626)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: const Text('अस्वीकृत करें', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () async {
                      final res = await ProviderDialogs.showApprovePolicyDialog(context, pol, _api);
                      if (res == true) _refresh();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: const Text('स्वीकृत करें', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ] else if (pol.isRejected) ...[
            Text(
              'अस्वीकृत: ${pol.rejectionReason ?? "पात्रता पूर्ण नहीं"}',
              style: const TextStyle(fontSize: 11, color: Color(0xFFDC2626), fontWeight: FontWeight.w700),
            ),
          ] else ...[
            Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 14),
                const SizedBox(width: 4),
                const Text('पॉलिसी सक्रिय • ई-प्रमाणपत्र जारी', style: TextStyle(fontSize: 11, color: Color(0xFF16A34A), fontWeight: FontWeight.w700)),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildClaimsTab() {
    final claimFilters = {
      'all': 'सभी',
      'intimated': 'दावा दर्ज',
      'surveyorAssigned': 'सर्वेयर नियुक्त',
      'fieldAssessed': 'क्षेत्र मूल्यांकन',
      'dbtApproved': 'DBT स्वीकृत',
      'disbursed': 'वितरित',
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: claimFilters.entries.map((e) {
              final sel = _claimFilter == e.key;
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(e.value, style: TextStyle(fontSize: 11, fontWeight: sel ? FontWeight.w800 : FontWeight.w600)),
                  selected: sel,
                  selectedColor: _primary.withValues(alpha: 0.15),
                  labelStyle: TextStyle(color: sel ? _primary : const Color(0xFF475569)),
                  onSelected: (_) {
                    setState(() => _claimFilter = e.key);
                    _fetchClaims();
                  },
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 10),

        if (_claims.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 30),
            child: Center(
              child: Text(
                'कोई दावा रिकॉर्ड नहीं मिला',
                style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
              ),
            ),
          )
        else
          for (final claim in _claims) ...[
            _buildClaimCard(claim),
            const SizedBox(height: 10),
          ],
      ],
    );
  }

  Widget _buildClaimCard(InsuranceClaimRecord claim) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(claim.claimNumber, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  claim.statusText,
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${claim.cropName} • आपदा: ${claim.calamityType} • ${claim.village}',
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF475569)),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('मांग: ₹${_inr.format(claim.requestedAmount.toInt())}', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
              if (claim.approvedAmount != null)
                Text('स्वीकृत: ₹${_inr.format(claim.approvedAmount!.toInt())}', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF16A34A))),
            ],
          ),
          const SizedBox(height: 10),

          // Dynamic action buttons according to lifecycle
          if (claim.status == 'intimated') ...[
            ElevatedButton.icon(
              onPressed: () async {
                final res = await ProviderDialogs.showAssignSurveyorDialog(context, claim, _api);
                if (res == true) _refresh();
              },
              icon: const Icon(Icons.person_add_alt_1_rounded, size: 14),
              label: const Text('सर्वेयर नियुक्त करें (Assign Surveyor)', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
              style: ElevatedButton.styleFrom(
                backgroundColor: _primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 38),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ] else if (claim.status == 'surveyorAssigned' || claim.status == 'fieldAssessed') ...[
            ElevatedButton.icon(
              onPressed: () async {
                final res = await ProviderDialogs.showSanctionClaimDialog(context, claim, _api);
                if (res == true) _refresh();
              },
              icon: const Icon(Icons.gavel_rounded, size: 14),
              label: const Text('समीक्षा व राशि स्वीकृत करें (Approve)', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 38),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ] else if (claim.status == 'dbtApproved') ...[
            ElevatedButton.icon(
              onPressed: () async {
                final res = await ProviderDialogs.showDisburseClaimDialog(context, claim, _api);
                if (res == true) _refresh();
              },
              icon: const Icon(Icons.send_rounded, size: 14),
              label: const Text('DBT अंतरण प्रेषित करें (Disburse)', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 38),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ] else if (claim.status == 'disbursed') ...[
            Text(
              'भुगतान पूर्ण • DBT Ref: ${claim.dbtTransactionId ?? ""}',
              style: const TextStyle(fontSize: 11, color: Color(0xFF16A34A), fontWeight: FontWeight.w800),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSchemesAndRatesTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'राष्ट्रीय कृषि बीमा योजनाएं (National Schemes)',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 8),
        for (final scheme in _schemes) ...[
          _buildSchemeCard(scheme),
          const SizedBox(height: 8),
        ],
        const SizedBox(height: 14),
        const Text(
          'फसल प्रीमियम दर तालिका (Actuarial Rates)',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 8),
        for (final rate in _rates) ...[
          _buildRateCard(rate),
          const SizedBox(height: 6),
        ],
      ],
    );
  }

  Widget _buildSchemeCard(InsuranceScheme scheme) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(scheme.code, style: TextStyle(fontWeight: FontWeight.w900, color: _primary, fontSize: 13)),
              Text('विंडो: ${scheme.claimWindowHours} घंटे', style: const TextStyle(fontSize: 10.5, color: Colors.grey)),
            ],
          ),
          const SizedBox(height: 2),
          Text(scheme.titleHi, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5)),
          const SizedBox(height: 4),
          Text(scheme.descriptionHi, style: const TextStyle(fontSize: 11, color: Color(0xFF475569))),
          const SizedBox(height: 6),
          Text(scheme.cutoffNotice, style: const TextStyle(fontSize: 10, color: Color(0xFF059669), fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _buildRateCard(CropPremiumRate rate) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${rate.cropName} (${rate.season})', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
              Text('कटऑफ: ${rate.cutoffDate}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('₹${_inr.format(rate.sumInsuredPerAcre.toInt())} / एकड़', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: Color(0xFF0F766E))),
              Text('किसान अंश: ${rate.farmerSharePercent}%', style: const TextStyle(fontSize: 10, color: Color(0xFF16A34A), fontWeight: FontWeight.w700)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAnalyticsTab(InsuranceProviderStats? stats) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('पोर्टफोलियो जोखिम विश्लेषण (Portfolio Analytics)', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
          const SizedBox(height: 12),
          _statRow('कुल बीमित दायित्व (Sum Insured)', '₹${_inr.format((stats?.totalSumInsured ?? 0).toInt())}'),
          _statRow('कुल किसान प्रीमियम', '₹${_inr.format((stats?.totalFarmerPremium ?? 0).toInt())}'),
          _statRow('कुल सरकारी अनुदान (Subsidy)', '₹${_inr.format((stats?.totalGovtSubsidy ?? 0).toInt())}'),
          _statRow('कुल वितरित दावे (Settled)', '₹${_inr.format((stats?.totalClaimDisbursed ?? 0).toInt())}'),
          _statRow('क्लेम इनकर्ड रेश्यो (Loss Ratio)', '${stats?.lossRatioPercent ?? 0.0}%'),
        ],
      ),
    );
  }

  Widget _statRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 11.5, color: Color(0xFF475569))),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }

  Widget _miniDetail(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 9.5, color: Color(0xFF64748B))),
        const SizedBox(height: 1),
        Text(value, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
      ],
    );
  }
}
