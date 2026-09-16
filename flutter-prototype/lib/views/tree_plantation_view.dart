// Tree / वृक्षारोपण (Plantation Hub) — Blogs, NGOs, Fuel Trees & Care Guides

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';
import '../components/common/motion_animations.dart';

class TreePlantationView extends StatefulWidget {
  final AppState state;
  const TreePlantationView({super.key, required this.state});

  @override
  State<TreePlantationView> createState() => _TreePlantationViewState();
}

class _TreePlantationViewState extends State<TreePlantationView> {
  int _selectedTab = 0; // 0: Articles, 1: NGOs, 2: Fuel Trees, 3: Care Guides

  final _saplingCountController = TextEditingController(text: "50");
  String _selectedTreeType = "सागवान व महोगनी (Timber)";

  void _openRequestSaplingsDialog(NgoOrganization ngo) {
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          backgroundColor: Colors.white,
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.park_rounded, color: Color(0xFF2E7D32), size: 24),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  "मोफत रोपे मागणी अर्ज\n(${ngo.name})",
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("झाडांचा प्रकार निवडा:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedTreeType,
                    isExpanded: true,
                    items: const [
                      DropdownMenuItem(value: "सागवान व महोगनी (Timber)", child: Text("सागवान व महोगनी (Timber)")),
                      DropdownMenuItem(value: "करंज व मलबार कडुलिंब (Biofuel)", child: Text("करंज व मलबार कडुलिंब (Biofuel)")),
                      DropdownMenuItem(value: "केसर आंबा व आवळा (Fruit)", child: Text("केसर आंबा व आवळा (Fruit)")),
                      DropdownMenuItem(value: "माणगा व तुळदा बांबू (Bamboo)", child: Text("माणगा व तुळदा बांबू (Bamboo)")),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        setDialogState(() => _selectedTreeType = val);
                      }
                    },
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Text("आवश्यक रोपांची संख्या:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              TextField(
                controller: _saplingCountController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  hintText: "उदा. 50 किंवा 100",
                  prefixIcon: const Icon(Icons.forest_rounded, color: Color(0xFF2E7D32), size: 18),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                "शेतकऱ्याचे नाव: ${widget.state.profile.name} (${widget.state.profile.village})",
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text("रद्द करा", style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w700)),
            ),
            ElevatedButton(
              onPressed: () {
                final count = int.tryParse(_saplingCountController.text) ?? 50;
                Navigator.pop(ctx);
                widget.state.requestSaplings(
                  ngoName: ngo.name,
                  count: count,
                  treeType: _selectedTreeType,
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B4332),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              ),
              child: const Text("अर्ज पाठवा (Submit)", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
            ),
          ],
        ),
      ),
    );
  }

  void _openArticleDetail(TreeArticle art) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.82,
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      art.category,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32)),
                    ),
                  ),
                  AudioButton(text: "${art.vernacularTitle}. ${art.summary}"),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                art.vernacularTitle,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF112A1F), height: 1.3),
              ),
              const SizedBox(height: 6),
              Text(
                "लेखक: ${art.author} • वाचन वेळ: ${art.readTime} • ${art.publishedDate}",
                style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F8E9),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFC8E6C9)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.eco_rounded, color: Color(0xFF2E7D32), size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "फायदे: ${art.benefits}",
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF1B5E20)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                art.fullContent,
                style: const TextStyle(fontSize: 14, height: 1.6, color: Color(0xFF263238)),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  setState(() => _selectedTab = 1); // switch to NGOs tab
                },
                icon: const Icon(Icons.nature_people_rounded, color: Colors.white, size: 18),
                label: const Text("या झाडांसाठी मोफत रोपे मिळवा (Request Saplings)", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B4332),
                  minimumSize: const Size(double.infinity, 46),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
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
                        child: const Row(
                          children: [
                            Icon(Icons.park_rounded, size: 14, color: Color(0xFF112A1F)),
                            SizedBox(width: 4),
                            Text("वृक्षारोपण • Tree & Biofuel Hub", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF112A1F))),
                          ],
                        ),
                      ),
                      const AudioButton(text: "वृक्षारोपण हब मध्ये आपले स्वागत आहे. बांधावर झाडे, बायोफ्युएल वृक्षांची माहिती, सामाजिक संस्थांची मोफत रोपे आणि संगोपन मार्गदर्शक येथे उपलब्ध आहेत."),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    "बांधावरील वृक्षलागवड व समृद्धी",
                    style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.3),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    "बायोफ्युएल झाडे, महोगनी-सागवान, सामाजिक संस्थांची मोफत रोपे आणि संगोपन सल्ला",
                    style: TextStyle(fontSize: 12, color: Color(0xFFD8F3DC), height: 1.35),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _heroStatBadge("5.2 लाख+", "झाडे लावली"),
                      const SizedBox(width: 8),
                      _heroStatBadge("₹120/रोप", "शासकीय अनुदान"),
                      const SizedBox(width: 8),
                      _heroStatBadge("100% मोफत", "संस्था रोपे"),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // 2. 4-Pill Sub-Navigation Switcher
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                _tabPill(0, "📰 लेख व तंत्रज्ञान (${widget.state.treeArticles.length})"),
                _tabPill(1, "🤝 सामाजिक संस्था (${widget.state.ngos.length})"),
                _tabPill(2, "⚡ Fuel झाड (${widget.state.biofuelTrees.length})"),
                _tabPill(3, "🌿 संगोपन मार्गदर्शक (${widget.state.treeCareGuides.length})"),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 3. Tab Contents
          if (_selectedTab == 0) _buildArticlesTab(),
          if (_selectedTab == 1) _buildNgosTab(),
          if (_selectedTab == 2) _buildBiofuelTreesTab(),
          if (_selectedTab == 3) _buildCareGuidesTab(),
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

  // Tab 0: Articles
  Widget _buildArticlesTab() {
    return Column(
      children: widget.state.treeArticles.map((art) {
        return GlassCard(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      art.category,
                      style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32)),
                    ),
                  ),
                  Text("वाचन: ${art.readTime}", style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                art.vernacularTitle,
                style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
              ),
              const SizedBox(height: 4),
              Text(
                art.summary,
                style: const TextStyle(fontSize: 12, color: Color(0xFF4B5563), height: 1.4),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text("✍️ ${art.author}", style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
                  BouncyPressable(
                    onTap: () => _openArticleDetail(art),
                    child: const Text(
                      "संपूर्ण वाचा →",
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF2E7D32)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  // Tab 1: NGOs Directory
  Widget _buildNgosTab() {
    return Column(
      children: widget.state.ngos.map((ngo) {
        return GlassCard(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.nature_people_rounded, color: Color(0xFF1B5E20), size: 24),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ngo.vernacularName,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                        ),
                        Text(
                          "कार्यक्षेत्र: ${ngo.location}",
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                        ),
                        Row(
                          children: [
                            const Icon(Icons.star_rounded, size: 14, color: Color(0xFFEAB308)),
                            Text(" ${ngo.rating} • ${ngo.treesPlantedCount ~/ 1000}K+ झाडे लावली", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (ngo.providesFreeSaplings)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF86EFAC)),
                      ),
                      child: const Text("मोफत रोपे 🌱", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFF15803D))),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: ngo.servicesOffered.map((s) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(s, style: const TextStyle(fontSize: 10.5, color: Color(0xFF374151), fontWeight: FontWeight.w600)),
                )).toList(),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => widget.state.showToast("संस्थेशी संपर्क: ${ngo.contactPhone}"),
                      icon: const Icon(Icons.phone_rounded, size: 14),
                      label: const Text("कॉल करा", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF1B4332),
                        side: const BorderSide(color: Color(0xFF1B4332)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      onPressed: () => _openRequestSaplingsDialog(ngo),
                      icon: const Icon(Icons.forest_rounded, size: 15, color: Colors.white),
                      label: const Text("मोफत रोपे अर्ज करा", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Colors.white)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2E7D32),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  // Tab 2: Fuel Trees (Biofuel)
  Widget _buildBiofuelTreesTab() {
    return Column(
      children: widget.state.biofuelTrees.map((tree) {
        return GlassCard(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    tree.name,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: Text(
                      tree.oilContentPercent,
                      style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: Color(0xFF92400E)),
                    ),
                  ),
                ],
              ),
              Text(
                "शास्त्रीय नाव: ${tree.botanicalName}",
                style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 8),
              Text(
                tree.vernacularName,
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF1B5E20)),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF9FAFB),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Column(
                  children: [
                    _infoRow("अपेक्षित नफा:", tree.expectedReturnPerAcre, Colors.green.shade800),
                    _infoRow("कालावधी:", tree.gestationPeriod, Colors.black87),
                    _infoRow("जमीन उपयुक्तता:", tree.suitability, Colors.black87),
                    _infoRow("अनुदान योजना:", tree.subsidyScheme, const Color(0xFF1D4ED8)),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Text(
                "खरेदीदार बाजारपेठ: ${tree.buyerMarket}",
                style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _infoRow(String label, String value, Color valColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 105,
            child: Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w600)),
          ),
          Expanded(
            child: Text(value, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: valColor)),
          ),
        ],
      ),
    );
  }

  // Tab 3: Care Guides
  Widget _buildCareGuidesTab() {
    return Column(
      children: widget.state.treeCareGuides.map((guide) {
        return GlassCard(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1B4332),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      guide.stepNumber,
                      style: const TextStyle(color: Color(0xFFE9C46A), fontSize: 12, fontWeight: FontWeight.w900),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          guide.vernacularTitle,
                          style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                        ),
                        Text("कालावधी: ${guide.stage}", style: const TextStyle(fontSize: 11, color: Color(0xFF2E7D32), fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(guide.instructions, style: const TextStyle(fontSize: 12.5, color: Color(0xFF263238), height: 1.4)),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _careDetailRow(Icons.water_drop_rounded, "पाणी:", guide.wateringRule, const Color(0xFF0284C7)),
                    const SizedBox(height: 4),
                    _careDetailRow(Icons.science_rounded, "खत वेळापत्रक:", guide.fertilizerSchedule, const Color(0xFF15803D)),
                    const SizedBox(height: 4),
                    _careDetailRow(Icons.shield_rounded, "कीड संरक्षण:", guide.pestProtection, const Color(0xFFB45309)),
                  ],
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _careDetailRow(IconData icon, String title, String detail, Color iconColor) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 14, color: iconColor),
        const SizedBox(width: 6),
        Text(title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF1F2937))),
        const SizedBox(width: 4),
        Expanded(
          child: Text(detail, style: const TextStyle(fontSize: 11, color: Color(0xFF4B5563), height: 1.3)),
        ),
      ],
    );
  }
}
