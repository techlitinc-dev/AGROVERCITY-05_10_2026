import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/tree_models.dart';
import '../state/app_state.dart';

class MyPlantationCard extends StatelessWidget {
  final TreePlantation plantation;
  final AppState state;
  final VoidCallback onLogGrowth;
  final VoidCallback onViewDetails;

  const MyPlantationCard({
    super.key,
    required this.plantation,
    required this.state,
    required this.onLogGrowth,
    required this.onViewDetails,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.green.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF1B5E20).withValues(alpha: 0.07),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      const Icon(Icons.forest_rounded, color: Color(0xFF1B5E20), size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          plantation.parcelName,
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF112A1F)),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: plantation.survivalRate >= 80 ? const Color(0xFFE8F5E9) : const Color(0xFFFFF3E0),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: plantation.survivalRate >= 80 ? Colors.green : Colors.orange,
                    ),
                  ),
                  child: Text(
                    "जिवंत दर: ${plantation.survivalRate.toStringAsFixed(0)}%",
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      color: plantation.survivalRate >= 80 ? const Color(0xFF1B5E20) : Colors.orange.shade900,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Body Stats
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          plantation.vernacularSpecies.isNotEmpty
                              ? plantation.vernacularSpecies
                              : plantation.treeSpecies,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF1B5E20)),
                        ),
                        Text(
                          "लागवड तारीख: ${plantation.plantingDate}",
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F8E9),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        children: [
                          Text("${plantation.treeCount}", style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF2E7D32))),
                          const Text("झाडे (Trees)", style: TextStyle(fontSize: 9.5, color: Color(0xFF33691E))),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                const Divider(height: 1),
                const SizedBox(height: 10),
                Row(
                  children: [
                    _statPill(Icons.height, "उंची: ${plantation.currentAvgHeightCm.toStringAsFixed(0)} cm"),
                    const SizedBox(width: 8),
                    _statPill(Icons.co2, "CO₂: ${(plantation.estimatedCo2KgPerYear / 1000).toStringAsFixed(1)} टन/वर्ष"),
                    const SizedBox(width: 8),
                    _statPill(Icons.history_edu, "${plantation.logsCount} नोंदी"),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF1B5E20),
                          side: const BorderSide(color: Color(0xFF1B5E20)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: onViewDetails,
                        icon: const Icon(Icons.insights, size: 16),
                        label: const Text("तपशील व इतिहास", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1B5E20),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: onLogGrowth,
                        icon: const Icon(Icons.add_a_photo_outlined, size: 16),
                        label: const Text("वाढ नोंदवा (Audit)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statPill(IconData icon, String text) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 13, color: Colors.grey.shade700),
            const SizedBox(width: 3),
            Flexible(
              child: Text(
                text,
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.grey.shade800),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CarbonCalculatorCard extends StatefulWidget {
  final AppState state;
  final Future<CarbonEstimate> Function(String species, int count, int years) onCalculate;

  const CarbonCalculatorCard({
    super.key,
    required this.state,
    required this.onCalculate,
  });

  @override
  State<CarbonCalculatorCard> createState() => _CarbonCalculatorCardState();
}

class _CarbonCalculatorCardState extends State<CarbonCalculatorCard> {
  String _selectedSpecies = "सागवान (Teak)";
  int _treeCount = 100;
  int _ageYears = 1;
  CarbonEstimate? _result;
  bool _loading = false;

  final List<String> _speciesList = [
    "सागवान (Teak)",
    "बांबू (Bamboo)",
    "मलाबार कडूनिंब (Melia Dubia)",
    "कडुलिंब (Neem)",
    "करंज (Pongamia)",
    "चंदन (Sandalwood)",
    "सुबाभूळ (Subabul)",
  ];

  @override
  void initState() {
    super.initState();
    _recalc();
  }

  Future<void> _recalc() async {
    setState(() => _loading = true);
    try {
      final res = await widget.onCalculate(_selectedSpecies, _treeCount, _ageYears);
      if (mounted) setState(() => _result = res);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final res = _result;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.green.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.green.withValues(alpha: 0.08),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.co2, color: Color(0xFF1B5E20), size: 26),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("कार्बन क्रेडिट व उत्पन्न कॅल्क्युलेटर", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF112A1F))),
                    Text("झाडांचे CO₂ शोषण आणि बाजार मूल्य गणना", style: TextStyle(fontSize: 11, color: Colors.grey)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Species Picker
          const Text("वृक्ष प्रजाती निवडा (Tree Species)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF374151))),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedSpecies,
                isExpanded: true,
                items: _speciesList.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)))).toList(),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _selectedSpecies = val);
                    _recalc();
                  }
                },
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Tree Count Slider
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("झाडांची संख्या (Number of Trees)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF374151))),
              Text("$_treeCount झाडे", style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1B5E20))),
            ],
          ),
          Slider(
            value: _treeCount.toDouble(),
            min: 10,
            max: 2000,
            divisions: 199,
            activeColor: const Color(0xFF1B5E20),
            inactiveColor: Colors.green.shade100,
            onChanged: (val) => setState(() => _treeCount = val.toInt()),
            onChangeEnd: (_) => _recalc(),
          ),

          const SizedBox(height: 10),

          // Result Presentation
          if (_loading)
            const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(color: Color(0xFF1B5E20))))
          else if (res != null) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F3923), Color(0xFF1B5E20)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _carbonMetric("वार्षिक CO₂ शोषण", "${(res.annualCo2Kg / 1000).toStringAsFixed(2)} टन", "(${res.annualCo2Kg.toStringAsFixed(0)} kg/वर्ष)"),
                      _carbonMetric("१० वर्षांचे CO₂", "${(res.tenYearCo2Kg / 1000).toStringAsFixed(1)} टन", "एकूण बायोमास"),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(color: Colors.white24, height: 1),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _carbonMetric("कार्बन क्रेडिट्स (10Yr)", "${res.carbonCredits10Yr.toStringAsFixed(1)} Credits", "1 Credit = 1 टन CO₂"),
                      _carbonMetric("अंदाजित उत्पन्न", "₹${res.estimatedEarningsInr.toStringAsFixed(0)}", "@ ₹1,200/क्रेडिट दर"),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text(
              "ℹ️ ${res.formulaExplanation}",
              style: TextStyle(fontSize: 10.5, color: Colors.grey.shade700, fontStyle: FontStyle.italic),
            ),
          ],
        ],
      ),
    );
  }

  Widget _carbonMetric(String label, String value, String sub) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Color(0xFFD8F3DC), fontSize: 11, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(color: Color(0xFFE9C46A), fontSize: 16, fontWeight: FontWeight.w900)),
        Text(sub, style: const TextStyle(color: Colors.white70, fontSize: 9.5)),
      ],
    );
  }
}

class GovtSchemeCard extends StatelessWidget {
  final AgroforestryScheme scheme;
  final AppState state;

  const GovtSchemeCard({super.key, required this.scheme, required this.state});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade300),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: ExpansionTile(
          shape: const RoundedRectangleBorder(side: BorderSide.none),
          collapsedShape: const RoundedRectangleBorder(side: BorderSide.none),
          tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          leading: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFE8F5E9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.account_balance, color: Color(0xFF1B5E20), size: 22),
          ),
          title: Text(
            scheme.vernacularName.isNotEmpty ? scheme.vernacularName : scheme.name,
            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF112A1F)),
          ),
          subtitle: Text(
            scheme.department,
            style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600),
          ),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFC8E6C9)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.monetization_on, color: Color(0xFF2E7D32), size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            "अनुदान रक्कम: ${scheme.subsidyAmount}",
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: Color(0xFF1B5E20)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  _sectionHeader("पात्रता (Eligibility):"),
                  Text(scheme.eligibility, style: const TextStyle(fontSize: 12, color: Color(0xFF374151), height: 1.35)),
                  const SizedBox(height: 8),
                  _sectionHeader("आवश्यक कागदपत्रे (Documents):"),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: scheme.documentsRequired
                        .map((d) => Chip(
                              label: Text(d, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600)),
                              backgroundColor: Colors.grey.shade100,
                              padding: const EdgeInsets.symmetric(horizontal: 4),
                              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ))
                        .toList(),
                  ),
                  const SizedBox(height: 8),
                  _sectionHeader("अर्ज प्रक्रिया (Application Process):"),
                  Text(scheme.applicationProcess, style: const TextStyle(fontSize: 12, color: Color(0xFF374151), height: 1.35)),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1B5E20),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () {
                        if (scheme.portalUrl.isNotEmpty) {
                          launchUrl(Uri.parse(scheme.portalUrl), mode: LaunchMode.externalApplication);
                        }
                      },
                      icon: const Icon(Icons.open_in_new, size: 16),
                      label: const Text("अधिकृत पोर्टलवर अर्ज करा (Apply)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: Color(0xFF1B5E20))),
    );
  }
}

class SpeciesSuitabilityAdvisorCard extends StatefulWidget {
  final AppState state;
  final Future<List<SpeciesRecommendation>> Function(String soilType, String water) onFetch;

  const SpeciesSuitabilityAdvisorCard({
    super.key,
    required this.state,
    required this.onFetch,
  });

  @override
  State<SpeciesSuitabilityAdvisorCard> createState() => _SpeciesSuitabilityAdvisorCardState();
}

class _SpeciesSuitabilityAdvisorCardState extends State<SpeciesSuitabilityAdvisorCard> {
  String _selectedSoil = "black_cotton";
  String _selectedWater = "limited_drip";
  List<SpeciesRecommendation> _recommendations = const [];
  bool _loading = true;

  final Map<String, String> _soils = {
    "black_cotton": "काळी कसदार",
    "red_loamy": "तांबडी दुमट",
    "sandy_arid": "वाळूमिश्रित कोरडवाहू",
    "rocky_murrum": "मुरमाड / हलकी",
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await widget.onFetch(_selectedSoil, _selectedWater);
      if (mounted) setState(() => _recommendations = res);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text("मातीचा प्रकार निवडा (Select Soil Type)", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF112A1F))),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: _soils.entries.map((e) {
              final isSel = _selectedSoil == e.key;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(e.value, style: TextStyle(fontSize: 11.5, fontWeight: isSel ? FontWeight.w800 : FontWeight.w600)),
                  selected: isSel,
                  selectedColor: const Color(0xFF1B5E20),
                  labelStyle: TextStyle(color: isSel ? Colors.white : Colors.black87),
                  onSelected: (val) {
                    if (val) {
                      setState(() => _selectedSoil = e.key);
                      _load();
                    }
                  },
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 12),

        if (_loading)
          const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator(color: Color(0xFF1B5E20))))
        else
          Column(
            children: _recommendations.map((rec) => _recommendationTile(rec)).toList(),
          ),
      ],
    );
  }

  Widget _recommendationTile(SpeciesRecommendation rec) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  rec.vernacularName.isNotEmpty ? rec.vernacularName : rec.name,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1B5E20)),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  "${rec.suitabilityScore}% योग्य",
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              _metricPill("अंतर", rec.recommendedSpacing),
              const SizedBox(width: 6),
              _metricPill("कालावधी", rec.gestationYears),
              const SizedBox(width: 6),
              _metricPill("उत्पन्न", rec.expectedAnnualRevenue),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            rec.careSummary,
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF4B5563), height: 1.3),
          ),
        ],
      ),
    );
  }

  Widget _metricPill(String k, String v) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 6),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(k, style: TextStyle(fontSize: 9, color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
            Text(v, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF112A1F)), overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}
