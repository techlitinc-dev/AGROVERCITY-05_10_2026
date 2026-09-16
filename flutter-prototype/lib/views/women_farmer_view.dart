// Module I: Women Farmer Mode Flutter View

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../components/common/glass_card.dart';

class WomenFarmerView extends StatefulWidget {
  final AppState state;
  const WomenFarmerView({super.key, required this.state});

  @override
  State<WomenFarmerView> createState() => _WomenFarmerViewState();
}

class _WomenFarmerViewState extends State<WomenFarmerView> {
  int _selectedTab = 0; // 0: SHG, 1: Kitchen Garden, 2: Livestock, 3: Enterprise

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
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("🌸 महिला किसान प्रगति केंद्र (Mahila Kisan)", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                SizedBox(height: 4),
                Text("80% कृषि श्रम करने वाली महिला किसानों हेतु बचत गट, पोषण वाटिका, पशुधन व गृह उद्योग", style: TextStyle(color: Color(0xFFFFE4E6), fontSize: 12, height: 1.4)),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Tabs
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _tabBtn(0, "👥 SHG बचत गट"),
                _tabBtn(1, "🥗 पोषण वाटिका"),
                _tabBtn(2, "🐄 पशुधन स्वास्थ्य"),
                _tabBtn(3, "🏺 गृह उद्योग आय"),
              ],
            ),
          ),
          const SizedBox(height: 14),

          if (_selectedTab == 0) _buildShgView(),
          if (_selectedTab == 1) _buildGardenView(),
          if (_selectedTab == 2) _buildLivestockView(),
          if (_selectedTab == 3) _buildEnterpriseView(),
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
          border: Border.all(color: active ? const Color(0xFFE11D48) : Colors.grey.shade300),
        ),
        child: Text(label, style: TextStyle(fontSize: 12, fontWeight: active ? FontWeight.w800 : FontWeight.w600, color: active ? Colors.white : Colors.black87)),
      ),
    );
  }

  Widget _buildShgView() {
    return Column(
      children: [
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text("जय मल्हार महिला बचत गट", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFFBE123C))),
                  Text("14 सदस्य", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFBE123C))),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: const Color(0xFFFFF1F2), borderRadius: BorderRadius.circular(10)),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("कुल संचित बचत कोष", style: TextStyle(fontSize: 10.5, color: Color(0xFF9F1239))),
                          Text("₹84,500", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF881337))),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(10)),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("सक्रिय ऋण फंड", style: TextStyle(fontSize: 10.5, color: Color(0xFF166534))),
                          Text("₹25,000", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF14532D))),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: () => widget.state.showToast("मासिक बचत ₹200 सफलता से दर्ज हुई!"),
                icon: const Icon(Icons.add_rounded, size: 16),
                label: const Text("मासिक बचत ₹200 जमा करें", style: TextStyle(fontWeight: FontWeight.w700)),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE11D48), foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 40)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildGardenView() {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("🥗 पोषण वाटिका (Kitchen Garden Planner)", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFFBE123C))),
          const SizedBox(height: 10),
          _gardenItem("पालक व मेथी (25 दिन)", "आयरन व फोलिक एसिड", "तुड़ाई योग्य"),
          const Divider(),
          _gardenItem("देसी टमाटर व धनिया (60 दिन)", "विटामिन सी", "फलन अवस्था"),
          const Divider(),
          _gardenItem("सहजन / ड्रमस्टिक (बारहमासी)", "कैल्शियम व खनिज", "सक्रिय पेड़"),
        ],
      ),
    );
  }

  Widget _gardenItem(String veg, String nut, String st) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(veg, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
            Text("पोषण: $nut", style: const TextStyle(fontSize: 11, color: Color(0xFFE11D48))),
          ],
        ),
        Text(st, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF16A34A))),
      ],
    );
  }

  Widget _buildLivestockView() {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("🐄 पशुधन व मुर्गी पालन स्वास्थ्य", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFFBE123C))),
          const SizedBox(height: 10),
          _livestockItem("देसी गाय (गीर - लक्ष्मी)", "🥛 9.5 लीटर/दिन", "टीका: FMD 10 Sept"),
          const Divider(),
          _livestockItem("देशी मुर्गी (25 पक्षी)", "🥚 110 अंडे/सप्ताह", "दवा: 05 Sept"),
        ],
      ),
    );
  }

  Widget _livestockItem(String title, String yield, String date) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
            Text(date, style: const TextStyle(fontSize: 10.5, color: Colors.grey)),
          ],
        ),
        Text(yield, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
      ],
    );
  }

  Widget _buildEnterpriseView() {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("🏺 गृह उद्योग मासिक आय (Net Profit)", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFFBE123C))),
          const SizedBox(height: 10),
          _entItem("आम व नींबू अचार (45 kg)", "+₹4,950 / माह"),
          const Divider(),
          _entItem("उड़द व मूंग पापड़ (60 kg)", "+₹7,200 / माह"),
          const Divider(),
          _entItem("A2 देसी गाय बिलोना घी (8 L)", "+₹6,800 / माह"),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: const Color(0xFFFFF1F2), borderRadius: BorderRadius.circular(10)),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("कुल मासिक शुद्ध लाभ:", style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF881337))),
                Text("₹18,950", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF881337))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _entItem(String title, String profit) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
        Text(profit, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF16A34A))),
      ],
    );
  }
}
