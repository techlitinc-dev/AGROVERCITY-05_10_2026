// Livestock & Dairy Ecosystem — गौशाळा, रोपवाटिका, Dr. for गाय & दुग्धजन्य पदार्थ

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';
import '../components/common/motion_animations.dart';

class LivestockDairyView extends StatefulWidget {
  final AppState state;
  const LivestockDairyView({super.key, required this.state});

  @override
  State<LivestockDairyView> createState() => _LivestockDairyViewState();
}

class _LivestockDairyViewState extends State<LivestockDairyView> {
  int _selectedTab = 0; // 0: Gaushala, 1: Nursery, 2: Vet Doctor, 3: Dairy Products

  void _openVetBookingDialog(VetDoctor doc) {
    String selectedSlot = "दुपारी 2:00 ते 4:00 (Today)";
    bool isFarmVisit = doc.availableForFarmVisit;

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
                  color: const Color(0xFFE0F2FE),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.medical_services_rounded, color: Color(0xFF0284C7), size: 22),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  "पशुवैद्यकीय सल्ला बुकिंग\n(${doc.name})",
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "तज्ज्ञता: ${doc.specialization}",
                style: const TextStyle(fontSize: 12, color: Color(0xFF0369A1), fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              const Text("बुकिंग प्रकार निवडा:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: const Text("शेतावर प्रत्यक्ष भेट 🚜", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                      selected: isFarmVisit,
                      onSelected: (val) => setDialogState(() => isFarmVisit = true),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: ChoiceChip(
                      label: const Text("दवाखाना भेट 🏥", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                      selected: !isFarmVisit,
                      onSelected: (val) => setDialogState(() => isFarmVisit = false),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Text("वेळ स्लॉट निवडा:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: selectedSlot,
                    isExpanded: true,
                    items: const [
                      DropdownMenuItem(value: "दुपारी 2:00 ते 4:00 (Today)", child: Text("दुपारी 2:00 ते 4:00 (Today)")),
                      DropdownMenuItem(value: "संध्याकाळी 5:00 ते 7:00 (Today)", child: Text("संध्याकाळी 5:00 ते 7:00 (Today)")),
                      DropdownMenuItem(value: "उद्या सकाळी 9:00 ते 11:00", child: Text("उद्या सकाळी 9:00 ते 11:00")),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        setDialogState(() => selectedSlot = val);
                      }
                    },
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(10)),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text("सल्ला फी:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                    Text(
                      "₹${doc.consultationFeeRupees.toInt()} (शेतकरी सवलत)",
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF15803D)),
                    ),
                  ],
                ),
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
                Navigator.pop(ctx);
                widget.state.bookVetDoctor(
                  doctorName: doc.name,
                  slot: selectedSlot,
                  isFarmVisit: isFarmVisit,
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              ),
              child: const Text("अपॉइंटमेंट निश्चित करा", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
            ),
          ],
        ),
      ),
    );
  }

  void _openGaushalaManureDialog(GaushalaItem g) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Text("सेंद्रिय खत मागणी (${g.name})", style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("उपलब्ध: ${g.facilities}", style: const TextStyle(fontSize: 12, color: Colors.black87, height: 1.3)),
            const SizedBox(height: 12),
            const Text("खताचा प्रकार निवडा:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            ListTile(
              dense: true,
              leading: const Icon(Icons.eco_rounded, color: Color(0xFF2E7D32)),
              title: const Text("सेंद्रिय गोकृपामृत स्लरी (200L)", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
              subtitle: const Text("₹600 प्रति बॅरल"),
              onTap: () {
                Navigator.pop(ctx);
                widget.state.orderGaushalaManure(gaushalaName: g.name, item: "सेंद्रिय गोकृपामृत स्लरी");
              },
            ),
            ListTile(
              dense: true,
              leading: const Icon(Icons.grain_rounded, color: Color(0xFFD97706)),
              title: const Text("शुद्ध गांडूळ खत / शेणखत (1 टन)", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
              subtitle: const Text("₹3,500 प्रति टन थेट शेतावर डिलिव्हरी"),
              onTap: () {
                Navigator.pop(ctx);
                widget.state.orderGaushalaManure(gaushalaName: g.name, item: "गांडूळ खत / शेणखत");
              },
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("रद्द करा")),
        ],
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
          // 1. Hero Livestock Banner
          StaggeredSlideFade(
            delayMs: 0,
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF78350F), Color(0xFFB45309), Color(0xFFD97706)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFB45309).withValues(alpha: 0.35),
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
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.pets_rounded, size: 14, color: Color(0xFF78350F)),
                            SizedBox(width: 4),
                            Text("पशुपालन व दुग्ध परिसंस्था", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF78350F))),
                          ],
                        ),
                      ),
                      const AudioButton(text: "पशुपालन व दुग्ध परिसंस्थेत आपले स्वागत आहे. येथे गोशाळा, प्रमाणित रोपवाटिका, पशुवैद्यकीय डॉक्टर आणि शुद्ध दुग्धजन्य पदार्थ उपलब्ध आहेत."),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    "गोवंश संवर्धन, रोपवाटिका व डॉक्टर",
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.3),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    "स्थानिक देशी गोशाळा, प्रमाणित फळ रोपवाटिका, 24x7 पशुवैद्यकीय मदत व थेट A2 दुग्ध बाज़ार",
                    style: TextStyle(fontSize: 12, color: Color(0xFFFEF3C7), height: 1.35),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _heroBadge("380+ गोवंश", "पंचवटी केंद्र"),
                      const SizedBox(width: 8),
                      _heroBadge("24x7 मदत", "डॉक्टर हेल्पलाइन"),
                      const SizedBox(width: 8),
                      _heroBadge("100% शुद्ध", "A2 देशी तूप-दूध"),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // 2. 4 Sub-Tabs Pill Navigation
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                _tabPill(0, "🛕 गौशाळा (${widget.state.gaushalas.length})"),
                _tabPill(1, "🪴 रोपवाटिका (${widget.state.nurseries.length})"),
                _tabPill(2, "🩺 Dr. for गाय (${widget.state.vetDoctors.length})"),
                _tabPill(3, "🥛 दुग्धजन्य पदार्थ (${widget.state.dairyProducts.length})"),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 3. Tab Views
          if (_selectedTab == 0) _buildGaushalaSection(),
          if (_selectedTab == 1) _buildNurserySection(),
          if (_selectedTab == 2) _buildVetSection(),
          if (_selectedTab == 3) _buildDairyProductsSection(),
        ],
      ),
    );
  }

  Widget _heroBadge(String top, String bottom) {
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
          Text(top, style: const TextStyle(color: Color(0xFFFEF3C7), fontSize: 11.5, fontWeight: FontWeight.w900)),
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
          color: isSel ? const Color(0xFF78350F) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isSel ? const Color(0xFF78350F) : Colors.grey.shade300,
            width: isSel ? 1.5 : 1.0,
          ),
          boxShadow: [
            if (isSel)
              BoxShadow(
                color: const Color(0xFF78350F).withValues(alpha: 0.25),
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

  // 1. Gaushala Section
  Widget _buildGaushalaSection() {
    return Column(
      children: widget.state.gaushalas.map((g) {
        return GlassCard(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      g.vernacularName,
                      style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      "${g.cowCount} गोवंश",
                      style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: Color(0xFF92400E)),
                    ),
                  ),
                ],
              ),
              Text(
                "${g.trustName} • ${g.district} (${g.distanceKm} km)",
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: g.breeds.map((b) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(6)),
                  child: Text(b, style: const TextStyle(fontSize: 10.5, color: Color(0xFF374151), fontWeight: FontWeight.w700)),
                )).toList(),
              ),
              const SizedBox(height: 8),
              Text(
                "सुविधा: ${g.facilities}",
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF15803D), fontWeight: FontWeight.w600, height: 1.3),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => widget.state.showToast("गोशाळा संपर्क: ${g.phone}"),
                      icon: const Icon(Icons.phone_rounded, size: 14),
                      label: const Text("संपर्क", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF78350F),
                        side: const BorderSide(color: Color(0xFF78350F)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      onPressed: () => _openGaushalaManureDialog(g),
                      icon: const Icon(Icons.eco_rounded, size: 15, color: Colors.white),
                      label: const Text("शेणखत / स्लरी बुक करा", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Colors.white)),
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

  // 2. Nursery Section
  Widget _buildNurserySection() {
    return Column(
      children: widget.state.nurseries.map((n) {
        return GlassCard(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      n.vernacularName,
                      style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                    ),
                  ),
                  if (n.isGovtCertified)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text("शासकीय प्रमाणित ✅", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFF15803D))),
                    ),
                ],
              ),
              Text(
                "संचालक: ${n.ownerName} • ${n.location} (${n.distanceKm} km)",
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 8),
              const Text("उपलब्ध फळ व लाकूड रोपे:", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF1B5E20))),
              const SizedBox(height: 4),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: n.availableSaplings.map((s) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFFBBF7D0))),
                  child: Text(s, style: const TextStyle(fontSize: 10.5, color: Color(0xFF166534), fontWeight: FontWeight.w700)),
                )).toList(),
              ),
              const SizedBox(height: 8),
              Text("दर श्रेणी: ${n.priceRange}", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFFD97706))),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => widget.state.showToast("रोपवाटिका कॉल: ${n.phone}"),
                      icon: const Icon(Icons.call_rounded, size: 14, color: Colors.white),
                      label: const Text("रोपे उपलब्धता विचारा", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Colors.white)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1B4332),
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

  // 3. Vet Doctor Section
  Widget _buildVetSection() {
    return Column(
      children: [
        // 24x7 Emergency Help Bar
        Container(
          padding: const EdgeInsets.all(12),
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFFEF2F2),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFFECACA)),
          ),
          child: Row(
            children: [
              const Icon(Icons.phone_in_talk_rounded, color: Color(0xFFDC2626), size: 22),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("24x7 आपत्कालीन पशुवैद्यकीय मदत", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: Color(0xFF991B1B))),
                    Text("लंपी स्किन, विषबाधा व तत्काळ प्रसूतीसाठी थेट कॉल करा", style: TextStyle(fontSize: 11, color: Color(0xFF7F1D1D))),
                  ],
                ),
              ),
              ElevatedButton(
                onPressed: () => widget.state.showToast("24x7 आपत्कालीन डॉक्टर कॉल: 1800-233-0418"),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFDC2626),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text("कॉल 🚨", style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w900)),
              ),
            ],
          ),
        ),

        // Doctors List
        ...widget.state.vetDoctors.map((doc) {
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
                        color: const Color(0xFFE0F2FE),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.medical_services_rounded, color: Color(0xFF0284C7), size: 24),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(doc.name, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F))),
                          Text("${doc.qualification} • ${doc.experienceYears} वर्षे अनुभव", style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                          Text("तज्ज्ञता: ${doc.specialization}", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF0369A1))),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  "दवाखाना: ${doc.clinicAddress} (${doc.distanceKm} km)",
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.access_time_filled_rounded, size: 13, color: Color(0xFF15803D)),
                    const SizedBox(width: 4),
                    Text(doc.nextAvailableSlot, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF15803D))),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => widget.state.showToast("डॉक्टर कॉल: ${doc.phone}"),
                        icon: const Icon(Icons.phone_rounded, size: 14),
                        label: const Text("थेट कॉल", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF0284C7),
                          side: const BorderSide(color: Color(0xFF0284C7)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton.icon(
                        onPressed: () => _openVetBookingDialog(doc),
                        icon: const Icon(Icons.calendar_month_rounded, size: 14, color: Colors.white),
                        label: const Text("सल्ला / शेतावर भेट बुक करा", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Colors.white)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0284C7),
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
        }),
      ],
    );
  }

  // 4. Dairy Products Marketplace Section
  Widget _buildDairyProductsSection() {
    return Column(
      children: widget.state.dairyProducts.map((p) {
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
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        p.category.contains("Ghee") ? "🧈" : (p.category.contains("Milk") ? "🥛" : (p.category.contains("Paneer") ? "🧀" : "🪵")),
                        style: const TextStyle(fontSize: 24),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.vernacularTitle,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                        ),
                        Text(
                          "उत्पादक: ${p.farmName} • ${p.purityCertification}",
                          style: const TextStyle(fontSize: 10.5, color: Color(0xFF15803D), fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                p.description,
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF4B5563), height: 1.35),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "₹${p.price.toInt()} / ${p.unit}",
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF1B5E20)),
                      ),
                      Text("⭐ ${p.rating} (${p.reviewsCount} ग्राहक)", style: const TextStyle(fontSize: 10.5, color: Colors.grey, fontWeight: FontWeight.w600)),
                    ],
                  ),
                  ElevatedButton.icon(
                    onPressed: () => widget.state.orderDairyProduct(p),
                    icon: const Icon(Icons.shopping_bag_rounded, size: 14, color: Colors.white),
                    label: const Text("थेट खरेदी करा", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Colors.white)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1B5E20),
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
}
