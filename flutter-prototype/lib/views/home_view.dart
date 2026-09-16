import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../components/common/glass_card.dart';
import '../components/common/motion_animations.dart';
import '../components/navigation/dashboard_profile_switcher_bar.dart';
import '../components/navigation/profile_switcher_sheet.dart';

class HomeView extends StatefulWidget {
  final AppState state;
  final VoidCallback onOpenVoice;

  const HomeView({
    super.key,
    required this.state,
    required this.onOpenVoice,
  });

  @override
  State<HomeView> createState() => _HomeViewState();
}

class _HomeViewState extends State<HomeView> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.06).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. 🌟 Luxury Animated Header Banner (with Rotating Vinyl Emblem & Shimmer Glow)
          StaggeredSlideFade(
            delayMs: 0,
            duration: const Duration(milliseconds: 550),
            child: _buildHeroHeader(context),
          ),
          const SizedBox(height: 14),

          // 1.5. 🔄 Dashboard Multi-Profile Quick Switcher Strip
          StaggeredSlideFade(
            delayMs: 50,
            duration: const Duration(milliseconds: 550),
            child: DashboardProfileSwitcherBar(state: widget.state),
          ),
          const SizedBox(height: 14),

          // 2. ⚡ Live Weather & Urgent Spray Alert Pill
          StaggeredSlideFade(
            delayMs: 80,
            duration: const Duration(milliseconds: 550),
            child: _buildWeatherAlertStrip(context),
          ),
          const SizedBox(height: 16),

          // 3. 🚜 "Our Services" 4-Card Luxury Grid with Staggered Spring reveals & Bouncy Press
          StaggeredSlideFade(
            delayMs: 160,
            duration: const Duration(milliseconds: 550),
            child: _buildOurServicesSection(context),
          ),
          const SizedBox(height: 18),

          // 3.5. 🌟 New Core Modules Quick Launcher Strip
          StaggeredSlideFade(
            delayMs: 260,
            duration: const Duration(milliseconds: 550),
            child: _buildNewCoreModulesSection(context),
          ),
          const SizedBox(height: 18),

          // 4. 🎁 "Hot Offer 50% OFF" Banner Card with Shimmer & 3D Pulsing basket
          StaggeredSlideFade(
            delayMs: 380,
            duration: const Duration(milliseconds: 550),
            child: _buildHotOfferBanner(context),
          ),
          const SizedBox(height: 18),

          // 5. 💰 CRD Change 7: Live Vyapari Rate Display Widget with Live Equalizer Waveform
          StaggeredSlideFade(
            delayMs: 480,
            duration: const Duration(milliseconds: 550),
            child: _buildLiveVyapariRateWidget(context),
          ),
          const SizedBox(height: 16),

          // 6. 🛡️ Today's Action & Spray Protocol Card
          StaggeredSlideFade(
            delayMs: 580,
            duration: const Duration(milliseconds: 550),
            child: _buildTodayActionCard(context),
          ),
          const SizedBox(height: 16),

          // 7. 🎁 Refer & Earn Point System Banner Card
          StaggeredSlideFade(
            delayMs: 680,
            duration: const Duration(milliseconds: 550),
            child: _buildNewReferralBanner(context),
          ),
        ],
      ),
    );
  }

  // 1. Luxury Header matching p3.png with Rotating Vinyl Emblem, Shimmer & Voice Search
  Widget _buildHeroHeader(BuildContext context) {
    return ShimmerGlowEffect(
      duration: const Duration(seconds: 4),
      shimmerColor: Colors.white,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF1B5E20), Color(0xFF2E7D32), Color(0xFF43A047)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF2E7D32).withValues(alpha: 0.4),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          children: [
            Row(
              children: [
                // 💿 Rotating Vinyl Disc / Crop Emblem (Inspired by Reference GIF)
                const SpinningVinylEmblem(
                  size: 58,
                  ringColors: [
                    Color(0xFFE8F5E9),
                    Color(0xFFA5D6A7),
                    Color(0xFF66BB6A),
                    Color(0xFF2E7D32),
                  ],
                  centerIcon: Text("🌾", style: TextStyle(fontSize: 22)),
                ),
                const SizedBox(width: 14),

                // Farmer Name & Location Subtitle
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            "Good Morning",
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.green.shade100,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.3,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const PulsingBeaconBadge(
                            label: "LIVE APMC",
                            color: Color(0xFF00E676),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.state.profile.name,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          letterSpacing: -0.2,
                        ),
                      ),
                      Text(
                        "${widget.state.profile.village} • ${widget.state.profile.landAreaAcres} एकड़ खेत",
                        style: TextStyle(
                          fontSize: 11.5,
                          color: Colors.white.withValues(alpha: 0.9),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),

                // Chatbot & Notification Action Icons
                BouncyPressable(
                  onTap: widget.onOpenVoice,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.chat_bubble_outline_rounded, color: Colors.white, size: 20),
                  ),
                ),
                const SizedBox(width: 6),
                BouncyPressable(
                  onTap: () => widget.state.showToast("4 naye mandi alert aaye hain!"),
                  child: Stack(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 20),
                      ),
                      Positioned(
                        right: 2,
                        top: 2,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: Color(0xFFFF3D00),
                            shape: BoxShape.circle,
                          ),
                          child: const Text(
                            "4",
                            style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // 🔄 Interactive Role Switcher Capsule Button
            BouncyPressable(
              onTap: () {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (ctx) => ProfileSwitcherSheet(state: widget.state),
                );
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.22),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Color(0xFFE9C46A),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.agriculture_rounded, size: 13, color: Color(0xFF1B5E20)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "सक्रिय भूमिका: किसान (${widget.state.linkedProfiles.length} प्रोफाइल जुड़ी हैं)",
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE9C46A),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.swap_horiz_rounded, size: 12, color: Color(0xFF1B5E20)),
                          SizedBox(width: 3),
                          Text(
                            "बदलें ▾",
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF1B5E20),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Search Bar matching p3.png with mic trigger
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(30),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  const Icon(Icons.search_rounded, color: Color(0xFF2E7D32), size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      decoration: InputDecoration(
                        hintText: widget.state.tr('searchPlaceholder'),
                        hintStyle: TextStyle(
                          fontSize: 12.5,
                          color: Colors.grey.shade400,
                          fontWeight: FontWeight.w500,
                        ),
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                  BouncyPressable(
                    onTap: widget.onOpenVoice,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: const BoxDecoration(
                        color: Color(0xFFE8F5E9),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.mic_none_rounded, color: Color(0xFF2E7D32), size: 18),
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

  // 2. Weather & Alert Quick Capsule
  Widget _buildWeatherAlertStrip(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE0F2FE)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0284C7).withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFE0F2FE),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.wb_sunny_rounded, color: Color(0xFF0284C7), size: 20),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Nashik 27°C • Part Cloudy",
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF263238)),
                ),
                Text(
                  "Dopahar 1:00 PM varsha 65% sambhavna",
                  style: TextStyle(fontSize: 10.5, color: Color(0xFF0284C7), fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          const PulsingBeaconBadge(
            label: "Rain Radar 🌧️",
            color: Color(0xFFE65100),
          ),
        ],
      ),
    );
  }

  // 3. "Our Services" Grid matching p3.png (Transportation, Market Price, Chat us, Agricultural Loan)
  Widget _buildOurServicesSection(BuildContext context) {
    final services = [
      {
        'title': 'Transportation',
        'sub': 'Tractor & Vehicles',
        'icon': Icons.local_shipping_rounded,
        'bg': const Color(0xFFE8F5E9),
        'iconColor': const Color(0xFF2E7D32),
        'route': 'equipment',
        'badge': '1.8 km',
      },
      {
        'title': 'Market Price',
        'sub': 'Live APMC Rates',
        'icon': Icons.show_chart_rounded,
        'bg': const Color(0xFFFFF9C4),
        'iconColor': const Color(0xFFF57F17),
        'route': 'mandi',
        'badge': '+8.4% 📈',
      },
      {
        'title': 'Chat us',
        'sub': 'Kisan Mitra AI',
        'icon': Icons.auto_awesome_rounded,
        'bg': const Color(0xFFE8F5E9),
        'iconColor': const Color(0xFF2E7D32),
        'route': 'advisory',
        'badge': '24x7 ⚡',
      },
      {
        'title': 'Agricultural Loan',
        'sub': '0% BNPL & KCC',
        'icon': Icons.account_balance_rounded,
        'bg': const Color(0xFFFFF9C4),
        'iconColor': const Color(0xFFF57F17),
        'route': 'finance',
        'badge': 'Verified',
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              "Our Services",
              style: TextStyle(
                fontSize: 16.5,
                fontWeight: FontWeight.w900,
                color: Color(0xFF263238),
                letterSpacing: -0.2,
              ),
            ),
            Text(
              "4 Active Services",
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
            ),
          ],
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.32,
          ),
          itemCount: services.length,
          itemBuilder: (context, index) {
            final s = services[index];
            return StaggeredSlideFade(
              delayMs: 200 + (index * 50),
              duration: const Duration(milliseconds: 480),
              child: BouncyPressable(
                onTap: () => widget.state.navigateTo(s['route'] as String),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFECEFF1)),
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
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: s['bg'] as Color,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Icon(
                              s['icon'] as IconData,
                              color: s['iconColor'] as Color,
                              size: 22,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF5F7FA),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              s['badge'] as String,
                              style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF455A64)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        s['title'] as String,
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF263238),
                        ),
                      ),
                      Text(
                        s['sub'] as String,
                        style: const TextStyle(fontSize: 10.5, color: Color(0xFF90A4AE), fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  // 4. "Hot Offer 50% OFF" Banner matching p3.png with Shimmer & 3D Pulse
  Widget _buildHotOfferBanner(BuildContext context) {
    return ShimmerGlowEffect(
      duration: const Duration(seconds: 3),
      shimmerColor: Colors.white,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFFFF59D), Color(0xFFFDD835), Color(0xFFFBC02D)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(22),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFFBC02D).withValues(alpha: 0.35),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD32F2F),
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFD32F2F).withValues(alpha: 0.3),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Text(
                      "Hot Offer 🔥",
                      style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    "50% OFF",
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF263238),
                      letterSpacing: -0.5,
                    ),
                  ),
                  const Text(
                    "On first grab services & seeds",
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF5D4037),
                    ),
                  ),
                  const SizedBox(height: 10),
                  BouncyPressable(
                    onTap: () => widget.state.navigateTo('marketplace'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Text(
                        "Get Discount →",
                        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF263238)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            ScaleTransition(
              scale: _pulseAnimation,
              child: Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.6),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
                child: const Center(
                  child: Text("🧺", style: TextStyle(fontSize: 48)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // 5. CRD Change 7: Live Vyapari Rate Display Card with Animated Audio Waveform
  Widget _buildLiveVyapariRateWidget(BuildContext context) {
    final offlineNotice = widget.state.isOffline ? " (Offline Cached)" : "";

    return GlassCard(
      backgroundColor: Colors.white,
      border: Border.all(color: const Color(0xFFECEFF1)),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text("💰", style: TextStyle(fontSize: 16)),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    "AAJ KE BHAV$offlineNotice",
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF263238),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // 📊 Live Equalizer Waveform
                  const AnimatedAudioWaveform(
                    barCount: 5,
                    height: 14,
                    color: Color(0xFF43A047),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  "Nashik Mandi • 3 Vyapari",
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          ...List.generate(widget.state.vyapariRates.length, (index) {
            final vr = widget.state.vyapariRates[index];
            Color changeColor = Colors.grey;
            IconData arrow = Icons.remove_rounded;
            if (vr.changeDir == 'up') {
              changeColor = const Color(0xFF2E7D32);
              arrow = Icons.arrow_upward_rounded;
            } else if (vr.changeDir == 'down') {
              changeColor = const Color(0xFFD32F2F);
              arrow = Icons.arrow_downward_rounded;
            }

            return StaggeredSlideFade(
              delayMs: 500 + (index * 60),
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 4),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF9FAFB),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        vr.crop,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF263238)),
                      ),
                    ),
                    Text(
                      vr.rateDisplay,
                      style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF263238)),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: changeColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        children: [
                          Icon(arrow, size: 12, color: changeColor),
                          const SizedBox(width: 2),
                          Text(
                            vr.priceChange,
                            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: changeColor),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),

          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: BouncyPressable(
              onTap: () => widget.state.navigateTo('mandi'),
              child: const Text(
                "Poora Mandi Bhav Dekhein →",
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF43A047)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // 6. Today's Action Card with celebratory coin reward feedback
  Widget _buildTodayActionCard(BuildContext context) {
    return GlassCard(
      backgroundColor: widget.state.urgentTaskDone ? const Color(0xFFE8F5E9) : const Color(0xFFFFEBEE),
      border: Border.all(color: widget.state.urgentTaskDone ? const Color(0xFFA5D6A7) : const Color(0xFFFFCDD2)),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                widget.state.urgentTaskDone ? Icons.check_circle_rounded : Icons.warning_amber_rounded,
                color: widget.state.urgentTaskDone ? const Color(0xFF2E7D32) : Colors.red,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                widget.state.urgentTaskDone ? "TODAY'S ACTION COMPLETED ✅" : "TODAY'S ACTION REQUIRED",
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w900,
                  color: widget.state.urgentTaskDone ? const Color(0xFF2E7D32) : Colors.red.shade900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            widget.state.urgentTaskDone
                ? "Aapne subah Mancozeb spray ka chhidkav darj kar liya hai."
                : "Subah 6:00 - 9:00 AM ke beech Mancozeb spray ka chhidkav karein (65% varsha ki sambhavna).",
            style: const TextStyle(fontSize: 12, height: 1.4, color: Color(0xFF263238)),
          ),
          if (!widget.state.urgentTaskDone) ...[
            const SizedBox(height: 10),
            BouncyPressable(
              onTap: () => widget.state.markUrgentTaskDone(),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF43A047),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF43A047).withValues(alpha: 0.35),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: const Text(
                  "Kary Poora Kiya (+50 coins)",
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: Colors.white),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // 3.5. 🌟 New Core Modules Quick Grid (Tree, Live Channels, Livestock & Diary)
  Widget _buildNewCoreModulesSection(BuildContext context) {
    final modules = [
      {
        'title': 'फसल बीमा (PMFBY)',
        'sub': '72h Claim & Cover',
        'icon': Icons.health_and_safety_rounded,
        'bg': const Color(0xFFD1FAE5),
        'iconColor': const Color(0xFF047857),
        'route': 'cropInsurance',
        'badge': '72h Claim 🛡️',
      },
      {
        'title': 'वृक्षारोपण हब',
        'sub': 'Biofuel & Trees',
        'icon': Icons.park_rounded,
        'bg': const Color(0xFFDCFCE7),
        'iconColor': const Color(0xFF15803D),
        'route': 'treePlantation',
        'badge': 'मोफत रोपे 🌱',
      },
      {
        'title': 'लाईव्ह चॅनेल्स',
        'sub': 'Live APMC & KVK',
        'icon': Icons.live_tv_rounded,
        'bg': const Color(0xFFFFE4E6),
        'iconColor': const Color(0xFFE11D48),
        'route': 'liveChannels',
        'badge': 'LIVE 🔴',
      },
      {
        'title': 'पशुपालन व गोशाळा',
        'sub': 'Dairy & Dr. for Cow',
        'icon': Icons.pets_rounded,
        'bg': const Color(0xFFFEF3C7),
        'iconColor': const Color(0xFFD97706),
        'route': 'livestockDairy',
        'badge': '24x7 Vet 🩺',
      },
      {
        'title': 'शेती नोंदवही',
        'sub': 'Farm Diary & P&L',
        'icon': Icons.menu_book_rounded,
        'bg': const Color(0xFFEEF2FF),
        'iconColor': const Color(0xFF4F46E5),
        'route': 'farmDiary',
        'badge': '+15 Coins 🪙',
      },
      {
        'title': 'कृषी वार्ता',
        'sub': 'Daily Market News',
        'icon': Icons.newspaper_rounded,
        'bg': const Color(0xFFE0F2FE),
        'iconColor': const Color(0xFF0284C7),
        'route': 'agriNews',
        'badge': 'Audio News 🎙️',
      },
      {
        'title': 'ज्ञानसेतू कार्यशाळा',
        'sub': 'Paid Masterclasses',
        'icon': Icons.school_rounded,
        'bg': const Color(0xFFF3E8FF),
        'iconColor': const Color(0xFF9333EA),
        'route': 'gyanHub',
        'badge': 'ICAR Certified 🎓',
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              "नवीन विशेष सेवा (Special Modules)",
              style: TextStyle(
                fontSize: 16.5,
                fontWeight: FontWeight.w900,
                color: Color(0xFF263238),
                letterSpacing: -0.2,
              ),
            ),
            Text(
              "6 New Hubs",
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
            ),
          ],
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.05,
          ),
          itemCount: modules.length,
          itemBuilder: (context, index) {
            final m = modules[index];
            return BouncyPressable(
              onTap: () => widget.state.navigateTo(m['route'] as String),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: m['bg'] as Color,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(m['icon'] as IconData, size: 20, color: m['iconColor'] as Color),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      m['title'] as String,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                    ),
                    Text(
                      m['badge'] as String,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: m['iconColor'] as Color),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  // 7. 🎁 Refer & Earn Point System Banner Card
  Widget _buildNewReferralBanner(BuildContext context) {
    return ShimmerGlowEffect(
      duration: const Duration(seconds: 4),
      shimmerColor: Colors.white,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF713F12), Color(0xFF854D0E), Color(0xFFCA8A04)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(22),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFCA8A04).withValues(alpha: 0.35),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF08A),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      "शेतकरी मित्र जोडा आणि कमवा 🎁",
                      style: TextStyle(color: Color(0xFF713F12), fontSize: 10, fontWeight: FontWeight.w900),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    "+100 नाणी प्रति मित्र",
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Colors.white),
                  ),
                  const Text(
                    "मित्रांना जोडून मोफत माती परीक्षण व सवलती मिळवा",
                    style: TextStyle(fontSize: 11, color: Color(0xFFFEF3C7), height: 1.3),
                  ),
                  const SizedBox(height: 10),
                  BouncyPressable(
                    onTap: () => widget.state.navigateTo('referEarn'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        "रेफरल कोड पहा →",
                        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF713F12)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFFEF08A), width: 1.5),
              ),
              child: const Center(
                child: Text("🎁", style: TextStyle(fontSize: 34)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}



