// ज्ञान सेतु: Krishi Gyan Media Hub (ज्ञानसेतू Paid Workshops, Blogs, Videos, ICAR Expert Masterclasses)

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';

class GyanHubView extends StatefulWidget {
  final AppState state;
  const GyanHubView({super.key, required this.state});

  @override
  State<GyanHubView> createState() => _GyanHubViewState();
}

class _GyanHubViewState extends State<GyanHubView> {
  int _selectedTab = 0; // 0: DnyanSetu Paid Workshops, 1: Expert Talks, 2: Videos, 3: Blogs
  final _questionController = TextEditingController();

  void _askScientistDialog(ExpertTalk talk) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text("वैज्ञानिक से सवाल पूछें (${talk.expertName})", style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _questionController,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: "अपना सवाल लिखें (उदा. क्या बारिश के 2 घंटे बाद स्प्रे असरदार होगा?)",
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("रद्द करें")),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _questionController.clear();
              widget.state.showToast("सवाल लाइव मास्टरक्लास हेतु सबमिट हुआ!");
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332)),
            child: const Text("भेजें (Submit)", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _openWorkshopDetailDialog(PaidWorkshop ws) {
    bool useCoins = true;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          height: MediaQuery.of(context).size.height * 0.86,
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
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
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Text(
                      "ज्ञानसेतू प्रीमियम कार्यशाळा 🎓",
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF92400E)),
                    ),
                  ),
                  if (ws.isCertified)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text("ICAR संलग्न प्रमाणपत्र ✅", style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF15803D))),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                ws.vernacularTitle,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF112A1F), height: 1.3),
              ),
              const SizedBox(height: 6),
              Text(
                "प्रशिक्षक: ${ws.instructor} (${ws.instructorRole}) • ${ws.institution}",
                style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700, fontWeight: FontWeight.w600),
              ),
              const Divider(height: 20),
              Expanded(
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Batch Details Box
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            _wsDetailCapsule(Icons.calendar_month_rounded, "दिनांक", ws.batchDate),
                            _wsDetailCapsule(Icons.access_time_rounded, "वेळ", ws.timing),
                            _wsDetailCapsule(Icons.timer_rounded, "कालावधी", ws.duration),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      const Text(
                        "📚 कार्यशाळा अभ्यासक्रम व सत्रे (Syllabus):",
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1B4332)),
                      ),
                      const SizedBox(height: 8),
                      ...ws.syllabusModules.map((m) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 16),
                            const SizedBox(width: 6),
                            Expanded(child: Text(m, style: const TextStyle(fontSize: 12, color: Color(0xFF374151), height: 1.35))),
                          ],
                        ),
                      )),
                      const SizedBox(height: 14),

                      const Text(
                        "🎁 तुम्हाला काय मिळेल (Deliverables):",
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1B4332)),
                      ),
                      const SizedBox(height: 6),
                      ...ws.deliverables.map((d) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2.5),
                        child: Row(
                          children: [
                            const Icon(Icons.stars_rounded, color: Color(0xFFEAB308), size: 16),
                            const SizedBox(width: 6),
                            Expanded(child: Text(d, style: const TextStyle(fontSize: 11.5, color: Color(0xFF4B5563), fontWeight: FontWeight.w600))),
                          ],
                        ),
                      )),
                    ],
                  ),
                ),
              ),
              const Divider(height: 16),

              // Fee and Coins Discount Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text("₹${ws.feeRupees}", style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF112A1F))),
                          const SizedBox(width: 6),
                          if (useCoins)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(4)),
                              child: Text("-₹${ws.coinsDiscountAllowed} Coins", style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFB45309))),
                            ),
                        ],
                      ),
                      Text("फक्त ₹${ws.feeRupees - ws.coinsDiscountAllowed} अंतिम फी", style: const TextStyle(fontSize: 11, color: Color(0xFF15803D), fontWeight: FontWeight.w700)),
                    ],
                  ),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      widget.state.enrollWorkshop(ws.id, useCoins);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ws.isEnrolled ? const Color(0xFF16A34A) : const Color(0xFF1B4332),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                    ),
                    child: Text(
                      ws.isEnrolled ? "प्रवेशित आहात ✅" : "प्रवेश निश्चित करा ⚡",
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _wsDetailCapsule(IconData icon, String label, String value) {
    return Column(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF2E7D32)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 9.5, color: Colors.grey, fontWeight: FontWeight.w600)),
        Text(value, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF112A1F))),
      ],
    );
  }

  void _playVideoModal(VideoGuide vid) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Color(0xFF112A1F),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: const Color(0xFFE9C46A), borderRadius: BorderRadius.circular(8)),
                  child: Text(vid.category, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF112A1F))),
                ),
                IconButton(icon: const Icon(Icons.close_rounded, color: Colors.white), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const SizedBox(height: 8),

            // Video Player Simulation Box
            Container(
              height: 180,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF52B788)),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  const Icon(Icons.play_circle_fill_rounded, size: 56, color: Color(0xFFE9C46A)),
                  Positioned(
                    bottom: 10,
                    left: 14,
                    right: 14,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text("03:42 / ${vid.duration}", style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                        const Row(
                          children: [
                            Icon(Icons.hd_rounded, color: Color(0xFF86EFAC), size: 18),
                            SizedBox(width: 6),
                            Icon(Icons.fullscreen_rounded, color: Colors.white, size: 20),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            Text(vid.vernacularTitle, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
            Text("प्रशिक्षक: ${vid.instructor} • ${vid.views}", style: const TextStyle(color: Color(0xFFD8F3DC), fontSize: 12)),
            const SizedBox(height: 10),
            Text(vid.summary, style: const TextStyle(color: Colors.white70, fontSize: 12.5, height: 1.4)),
            const SizedBox(height: 12),
            const Text("💡 मुख्य वैज्ञानिक बिंदु (Key Takeaways):", style: TextStyle(color: Color(0xFFE9C46A), fontSize: 12.5, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            ...vid.keyPoints.map((kp) => Text("• $kp", style: const TextStyle(color: Colors.white, fontSize: 12, height: 1.4))),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Banner
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1B4332), Color(0xFF2D6A4F), Color(0xFFBC6C25)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(22),
              boxShadow: [
                BoxShadow(color: const Color(0xFF1B4332).withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 6)),
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
                      child: const Text("🎓 ज्ञान सेतू • Krishi Gyan Media & Workshop Hub", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF112A1F))),
                    ),
                    const AudioButton(text: "ज्ञान सेतू मध्ये आपले स्वागत आहे. येथे सशुल्क कार्यशाळा, आयसीएआर प्रमाणपत्र, शास्त्रज्ञ लाईव्ह संवाद आणि कृषी व्हिडिओ उपलब्ध आहेत."),
                  ],
                ),
                const SizedBox(height: 10),
                const Text(
                  "ज्ञानसेतू: कार्यशाळा, व्हिडिओ व वेबिनार",
                  style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.3),
                ),
                const SizedBox(height: 4),
                const Text(
                  "ICAR-IARI व तज्ज्ञ संस्थांच्या सशुल्क कार्यशाळा, डिजिटल प्रमाणपत्रे आणि थेट वैज्ञानिक संवाद",
                  style: TextStyle(fontSize: 12, color: Color(0xFFD8F3DC), height: 1.4),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Sub-Tab Switcher (4 Tabs)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                _tabBtn(0, "🎓 सशुल्क कार्यशाळा (${widget.state.paidWorkshops.length})"),
                _tabBtn(1, "🎙️ वैज्ञानिक लाईव्ह टॉक (${widget.state.expertTalks.length})"),
                _tabBtn(2, "🎬 व्हिडिओ ट्यूटोरियल्स (${widget.state.videos.length})"),
                _tabBtn(3, "📰 अ‍ॅग्रोनॉमी ब्लॉग्स (${widget.state.blogs.length})"),
              ],
            ),
          ),
          const SizedBox(height: 16),

          if (_selectedTab == 0) _buildWorkshopsSection(),
          if (_selectedTab == 1) _buildExpertTalksSection(),
          if (_selectedTab == 2) _buildVideosSection(),
          if (_selectedTab == 3) _buildBlogsSection(),
        ],
      ),
    );
  }

  Widget _tabBtn(int idx, String label) {
    final isSel = _selectedTab == idx;
    return GestureDetector(
      onTap: () => setState(() => _selectedTab = idx),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8.5),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFF1B4332) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: isSel ? const Color(0xFF1B4332) : Colors.grey.shade300),
          boxShadow: [
            if (isSel)
              BoxShadow(color: const Color(0xFF1B4332).withValues(alpha: 0.25), blurRadius: 8, offset: const Offset(0, 3)),
          ],
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSel ? FontWeight.w800 : FontWeight.w600,
            color: isSel ? Colors.white : Colors.black87,
          ),
        ),
      ),
    );
  }

  // 0. DnyanSetu Paid Workshops Section
  Widget _buildWorkshopsSection() {
    return Column(
      children: widget.state.paidWorkshops.map((ws) {
        return GlassCard(
          margin: const EdgeInsets.only(bottom: 14),
          border: Border(left: BorderSide(color: ws.isEnrolled ? const Color(0xFF16A34A) : const Color(0xFFD97706), width: 4)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      "⭐ ${ws.rating} • ${ws.enrolledCount}/${ws.totalSeats} जागा भरल्या",
                      style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF92400E)),
                    ),
                  ),
                  if (ws.isEnrolled)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text("प्रवेश निश्चित ✅", style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF15803D))),
                    ),
                ],
              ),
              const SizedBox(height: 8),

              Text(
                ws.vernacularTitle,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
              ),
              const SizedBox(height: 4),
              Text(
                "मार्गदर्शक: ${ws.instructor} (${ws.instructorRole})",
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF1B5E20), fontWeight: FontWeight.w700),
              ),
              Text(
                "संस्था: ${ws.institution}",
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 10),

              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.calendar_month_rounded, size: 14, color: Color(0xFFD97706)),
                        const SizedBox(width: 4),
                        Text(ws.batchDate, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFD97706))),
                      ],
                    ),
                    Row(
                      children: [
                        const Icon(Icons.workspace_premium_rounded, size: 14, color: Color(0xFF15803D)),
                        const SizedBox(width: 4),
                        Text(ws.certificateTitle, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF15803D))),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("₹${ws.feeRupees}", style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF112A1F))),
                      Text("नाणी सवलत ₹${ws.coinsDiscountAllowed}", style: const TextStyle(fontSize: 10, color: Color(0xFFB45309), fontWeight: FontWeight.w700)),
                    ],
                  ),
                  ElevatedButton.icon(
                    onPressed: () => _openWorkshopDetailDialog(ws),
                    icon: const Icon(Icons.menu_book_rounded, size: 14, color: Colors.white),
                    label: Text(ws.isEnrolled ? "अभ्यासक्रम पहा" : "तपशील व प्रवेश", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Colors.white)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ws.isEnrolled ? const Color(0xFF16A34A) : const Color(0xFF1B4332),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
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

  // 1. Expert Talks Section
  Widget _buildExpertTalksSection() {
    return Column(
      children: widget.state.expertTalks.map((talk) {
        return GlassCard(
          margin: const EdgeInsets.only(bottom: 14),
          border: Border(left: BorderSide(color: talk.isLive ? Colors.red : const Color(0xFF52B788), width: 4)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: const Color(0xFF1B4332),
                        radius: 16,
                        child: Text(talk.expertAvatar, style: const TextStyle(color: Color(0xFFE9C46A), fontWeight: FontWeight.w900, fontSize: 11)),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(talk.expertName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
                          Text(talk.institution, style: const TextStyle(fontSize: 10.5, color: Colors.grey)),
                        ],
                      ),
                    ],
                  ),
                  if (talk.isLive)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(8)),
                      child: const Row(
                        children: [
                          Icon(Icons.fiber_manual_record_rounded, color: Colors.white, size: 10),
                          SizedBox(width: 4),
                          Text("LIVE", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 10)),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),

              Text(talk.vernacularTopic, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF112A1F))),
              const SizedBox(height: 4),
              Text(talk.description, style: const TextStyle(fontSize: 12, color: Colors.black87, height: 1.35)),
              const SizedBox(height: 10),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.access_time_rounded, size: 14, color: Color(0xFFD97706)),
                      const SizedBox(width: 4),
                      Text(talk.scheduledTime, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFFD97706))),
                    ],
                  ),
                  Text("👥 ${talk.registeredCount} किसान पंजीकृत", style: const TextStyle(fontSize: 11, color: Colors.grey)),
                ],
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => widget.state.registerForExpertTalk(talk.id),
                      icon: const Icon(Icons.event_available_rounded, size: 16),
                      label: const Text("पंजीकरण करें (+25 coins)", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 8)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: () => _askScientistDialog(talk),
                    icon: const Icon(Icons.help_outline_rounded, size: 16),
                    label: const Text("सवाल पूछें", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                    style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF1B4332), side: const BorderSide(color: Color(0xFF1B4332)), padding: const EdgeInsets.symmetric(vertical: 8)),
                  ),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  // 2. Videos Section
  Widget _buildVideosSection() {
    return Column(
      children: widget.state.videos.map((vid) {
        return GlassCard(
          margin: const EdgeInsets.only(bottom: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: () => _playVideoModal(vid),
                child: Container(
                  height: 140,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: const Color(0xFF112A1F),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      const Icon(Icons.play_circle_fill_rounded, size: 48, color: Color(0xFFE9C46A)),
                      Positioned(
                        top: 8,
                        left: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(6)),
                          child: Text(vid.category, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                        ),
                      ),
                      Positioned(
                        bottom: 8,
                        right: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(4)),
                          child: Text(vid.duration, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),

              Text(vid.vernacularTitle, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
              const SizedBox(height: 2),
              Text("${vid.instructor} • ${vid.views}", style: const TextStyle(fontSize: 11.5, color: Colors.grey)),
              const SizedBox(height: 6),
              Text(vid.summary, style: const TextStyle(fontSize: 12, color: Colors.black87, height: 1.3)),
              const SizedBox(height: 10),

              ElevatedButton.icon(
                onPressed: () => _playVideoModal(vid),
                icon: const Icon(Icons.play_arrow_rounded, size: 16),
                label: const Text("व्हिडिओ पहा (Watch Video)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 38)),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  // 3. Blogs Section
  Widget _buildBlogsSection() {
    return Column(
      children: widget.state.blogs.map((blog) {
        return GlassCard(
          margin: const EdgeInsets.only(bottom: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: const Color(0xFFD8F3DC), borderRadius: BorderRadius.circular(8)),
                    child: Text(blog.category, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF166534))),
                  ),
                  Row(
                    children: [
                      Text(blog.readTimeMinutes, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                      IconButton(
                        icon: Icon(
                          blog.isBookmarked ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
                          color: blog.isBookmarked ? const Color(0xFFE9C46A) : Colors.grey,
                          size: 20,
                        ),
                        onPressed: () => widget.state.toggleBookmarkBlog(blog.id),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 6),

              Text(blog.vernacularTitle, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
              const SizedBox(height: 2),
              Text("लेखक: ${blog.author} (${blog.authorRole}) • ${blog.publishedDate}", style: const TextStyle(fontSize: 11, color: Colors.grey)),
              const SizedBox(height: 8),
              Text(blog.content, style: const TextStyle(fontSize: 12.5, color: Colors.black87, height: 1.4)),
              const SizedBox(height: 10),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  AudioButton(text: "${blog.vernacularTitle}। ${blog.content}"),
                  Row(
                    children: [
                      const Icon(Icons.thumb_up_alt_rounded, size: 14, color: Color(0xFF1B4332)),
                      const SizedBox(width: 4),
                      Text("${blog.likesCount} पसंद", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF1B4332))),
                    ],
                  ),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
