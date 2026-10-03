// Tree / वृक्षारोपण (Plantation Hub) — Blogs, NGOs, Fuel Trees & Care Guides
// (API-wired port: /v1/tree/articles, /v1/tree/ngos + sapling-request,
// /v1/tree/biofuel, /v1/tree/care-guides).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_exception.dart';
import '../api/tree_api.dart';
import '../components/common/audio_button.dart';
import '../components/common/motion_animations.dart';
import '../models/tree_models.dart';
import '../state/app_state.dart';
import 'tree_biofuel_care_widgets.dart';
import 'tree_plantation_dialogs.dart';
import 'tree_plantation_mrv_dialogs.dart';
import 'tree_plantation_mrv_widgets.dart';
import 'tree_plantation_widgets.dart';

class TreePlantationView extends StatefulWidget {
  final AppState state;
  final TreeApi? treeApi;

  const TreePlantationView({super.key, required this.state, this.treeApi});

  @override
  State<TreePlantationView> createState() => _TreePlantationViewState();
}

class _TreePlantationViewState extends State<TreePlantationView> {
  late final TreeApi _api = widget.treeApi ?? TreeApi();

  int _selectedTab = 0; // 0: Articles, 1: NGOs, 2: Fuel Trees, 3: Care Guides, 4: My Trees, 5: Carbon ROI, 6: Schemes, 7: Suitability
  List<TreeArticle> _articles = const [];
  List<NgoOrganization> _ngos = const [];
  List<BiofuelTree> _biofuelTrees = const [];
  List<TreeCareGuide> _careGuides = const [];
  List<TreePlantation> _plantations = const [];
  List<AgroforestryScheme> _schemes = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    List<TreeArticle> articles = const [];
    List<NgoOrganization> ngos = const [];
    List<BiofuelTree> biofuel = const [];
    List<TreeCareGuide> guides = const [];
    List<TreePlantation> plantations = const [];
    List<AgroforestryScheme> schemes = const [];
    try {
      articles = await _api.listArticles();
    } catch (_) {}
    try {
      ngos = await _api.listNgos();
    } catch (_) {}
    try {
      biofuel = await _api.listBiofuel();
    } catch (_) {}
    try {
      guides = await _api.listCareGuides();
      guides = [...guides]..sort((a, b) => a.stepNumber.compareTo(b.stepNumber));
    } catch (_) {}
    try {
      plantations = await _api.listMyPlantations();
    } catch (_) {}
    try {
      schemes = await _api.listSchemes();
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _articles = articles;
      _ngos = ngos;
      _biofuelTrees = biofuel;
      _careGuides = guides;
      _plantations = plantations;
      _schemes = schemes;
      _loading = false;
    });
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(message)));
  }

  void _call(String phone) {
    if (phone.isEmpty) return;
    unawaited(
        launchUrl(Uri(scheme: 'tel', path: phone)).catchError((_) => false));
  }

  void _openRequestSaplingsDialog(NgoOrganization ngo) {
    showDialog(
      context: context,
      builder: (ctx) => SaplingRequestDialog(
        ngo: ngo,
        state: widget.state,
        farmerLabel:
            "${widget.state.profile.name} (${widget.state.profile.village})",
        onValidationError: _snack,
        onSubmit: (treeType, count) => _requestSaplings(ngo, treeType, count),
      ),
    );
  }

  Future<void> _requestSaplings(
      NgoOrganization ngo, String treeType, int count) async {
    try {
      await _api.requestSaplings(ngo.id, treeType: treeType, count: count);
      _snack(widget.state.tr('tree.saplingRequestSent'));
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  void _openArticleDetail(TreeArticle art) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => TreeArticleDetailSheet(
        article: art,
        state: widget.state,
        onRequestSaplings: () => setState(() => _selectedTab = 1),
      ),
    );
  }

  void _openRegisterPlantationDialog() {
    showDialog(
      context: context,
      builder: (ctx) => RegisterPlantationDialog(
        state: widget.state,
        onSubmit: ({
          required String parcelName,
          required String treeSpecies,
          required String vernacularSpecies,
          required int treeCount,
          required String plantingDate,
          required String landType,
          required double latitude,
          required double longitude,
          required double initialHeightCm,
          required String irrigationType,
        }) async {
          try {
            final created = await _api.registerPlantation(
              parcelName: parcelName,
              treeSpecies: treeSpecies,
              vernacularSpecies: vernacularSpecies,
              treeCount: treeCount,
              plantingDate: plantingDate,
              landType: landType,
              latitude: latitude,
              longitude: longitude,
              initialHeightCm: initialHeightCm,
              irrigationType: irrigationType,
            );
            setState(() => _plantations = [created, ..._plantations]);
            _snack("✅ वृक्षारोपण यशस्वीरित्या नोंदवले गेले!");
          } on ApiException catch (e) {
            _snack(e.message.isNotEmpty ? e.message : e.code);
          }
        },
      ),
    );
  }

  void _openAddGrowthLogDialog(TreePlantation pl) {
    showDialog(
      context: context,
      builder: (ctx) => AddGrowthLogDialog(
        plantation: pl,
        onSubmit: ({
          required double heightCm,
          required double girthCm,
          required int survivalCount,
          required String healthStatus,
          required String notes,
        }) async {
          try {
            await _api.addPlantationLog(
              pl.id,
              heightCm: heightCm,
              girthCm: girthCm,
              survivalCount: survivalCount,
              healthStatus: healthStatus,
              notes: notes,
            );
            // Refresh plantations
            final updated = await _api.listMyPlantations();
            setState(() => _plantations = updated);
            _snack("✅ वाढ व आरोग्य नोंद जतन झाली!");
          } on ApiException catch (e) {
            _snack(e.message.isNotEmpty ? e.message : e.code);
          }
        },
      ),
    );
  }

  void _openPlantationDetail(TreePlantation pl) async {
    try {
      final detail = await _api.getPlantation(pl.id);
      if (!mounted) return;
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (ctx) => PlantationDetailSheet(
          plantation: detail,
          state: widget.state,
          onAddLog: () => _openAddGrowthLogDialog(detail),
        ),
      );
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Hero Plantation Banner
          StaggeredSlideFade(
            delayMs: 0,
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F3923), Color(0xFF1B5E20), Color(0xFF2E7D32)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF1B5E20).withValues(alpha: 0.35),
                    blurRadius: 18,
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
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE9C46A),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.park_rounded, size: 14, color: Color(0xFF112A1F)),
                            const SizedBox(width: 4),
                            Text(widget.state.tr('tree.biofuelHubBadge'), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF112A1F))),
                          ],
                        ),
                      ),
                      AudioButton(text: widget.state.tr('tree.hubAudioIntro')),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    widget.state.tr('tree.heroTitle'),
                    style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.3),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.state.tr('tree.heroSubtitle'),
                    style: const TextStyle(fontSize: 12, color: Color(0xFFD8F3DC), height: 1.35),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _heroStatBadge("5.2 लाख+", widget.state.tr('tree.treesPlanted')),
                      const SizedBox(width: 8),
                      _heroStatBadge("₹120/${widget.state.tr('tree.perSapling')}", widget.state.tr('tree.govtSubsidy')),
                      const SizedBox(width: 8),
                      _heroStatBadge("100% ${widget.state.tr('freeLabel')}", widget.state.tr('tree.ngoSaplings')),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // 2. Sub-Navigation Switcher
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                _tabPill(0, "📰 लेख व तंत्रज्ञान (${_articles.length})"),
                _tabPill(1, "🤝 सामाजिक संस्था (${_ngos.length})"),
                _tabPill(2, "⚡ Fuel झाड (${_biofuelTrees.length})"),
                _tabPill(3, "🌿 संगोपन मार्गदर्शक (${_careGuides.length})"),
                _tabPill(4, "🌳 माझी झाडे & MRV (${_plantations.length})"),
                _tabPill(5, "🌱 कार्बन कॅल्क्युलेटर (ROI)"),
                _tabPill(6, "🏛️ शासकीय योजना (${_schemes.length})"),
                _tabPill(7, "🎯 जमीन सल्लागार"),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 3. Tab Contents
          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: CircularProgressIndicator(color: Color(0xFF1B5E20)),
              ),
            )
          else ...[
            if (_selectedTab == 0)
              Column(
                children: _articles
                    .map((art) => TreeArticleCard(
                          article: art,
                          state: widget.state,
                          onReadMore: () => _openArticleDetail(art),
                        ))
                    .toList(),
              ),
            if (_selectedTab == 1)
              Column(
                children: _ngos
                    .map((ngo) => NgoCard(
                          ngo: ngo,
                          state: widget.state,
                          onCall: () => _call(ngo.contactPhone),
                          onRequestSaplings: () =>
                              _openRequestSaplingsDialog(ngo),
                        ))
                    .toList(),
              ),
            if (_selectedTab == 2)
              Column(
                children: _biofuelTrees
                    .map((tree) => BiofuelTreeCard(tree: tree, state: widget.state))
                    .toList(),
              ),
            if (_selectedTab == 3)
              Column(
                children: _careGuides
                    .map((guide) => CareGuideCard(guide: guide, state: widget.state))
                    .toList(),
              ),
            if (_selectedTab == 4) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("माझी नोंदणीकृत झाडे (My Plantations)", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14.5, color: Color(0xFF112A1F))),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1B5E20),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: _openRegisterPlantationDialog,
                    icon: const Icon(Icons.add_location_alt_outlined, size: 16),
                    label: const Text("नवीन लागवड", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (_plantations.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.forest_outlined, size: 48, color: Color(0xFF2E7D32)),
                      const SizedBox(height: 8),
                      const Text(
                        "अद्याप कोणतीही वृक्षलागवड नोंदवलेली नाही",
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        "बांधावरील किंवा शेतातील झाडे जिओ-टॅग करून नोंदवा व कार्बन क्रेडिट्स मिळवा!",
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 11.5, color: Colors.grey),
                      ),
                      const SizedBox(height: 14),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1B5E20),
                          foregroundColor: Colors.white,
                        ),
                        onPressed: _openRegisterPlantationDialog,
                        child: const Text("पहिली लागवड नोंदवा (+100 नाणी)"),
                      ),
                    ],
                  ),
                )
              else
                ..._plantations.map((pl) => MyPlantationCard(
                      plantation: pl,
                      state: widget.state,
                      onLogGrowth: () => _openAddGrowthLogDialog(pl),
                      onViewDetails: () => _openPlantationDetail(pl),
                    )),
            ],
            if (_selectedTab == 5)
              CarbonCalculatorCard(
                state: widget.state,
                onCalculate: (species, count, years) => _api.estimateCarbon(
                  treeSpecies: species,
                  treeCount: count,
                  ageYears: years,
                ),
              ),
            if (_selectedTab == 6)
              Column(
                children: _schemes
                    .map((sc) => GovtSchemeCard(scheme: sc, state: widget.state))
                    .toList(),
              ),
            if (_selectedTab == 7)
              SpeciesSuitabilityAdvisorCard(
                state: widget.state,
                onFetch: (soil, water) => _api.getSpeciesSuitability(
                  soilType: soil,
                  waterAvailability: water,
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _heroStatBadge(String top, String bottom) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(top, style: const TextStyle(color: Color(0xFFE9C46A), fontSize: 11.5, fontWeight: FontWeight.w900)),
          Text(bottom, style: const TextStyle(color: Colors.white70, fontSize: 9, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _tabPill(int idx, String label) {
    final isSel = _selectedTab == idx;
    return GestureDetector(
      onTap: () => setState(() => _selectedTab = idx),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFF1B5E20) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isSel ? const Color(0xFF1B5E20) : Colors.grey.shade300,
            width: isSel ? 1.5 : 1.0,
          ),
          boxShadow: [
            if (isSel)
              BoxShadow(
                color: const Color(0xFF1B5E20).withValues(alpha: 0.25),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
          ],
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSel ? FontWeight.w900 : FontWeight.w700,
            color: isSel ? Colors.white : const Color(0xFF374151),
          ),
        ),
      ),
    );
  }
}
