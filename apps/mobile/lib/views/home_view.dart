import 'package:flutter/material.dart';
import '../api/weather_api.dart';
import '../state/app_state.dart';
import '../components/common/motion_animations.dart';
import '../components/mandi/aaj_ke_bhav_widget.dart';
import '../components/direct/farmer_buy_demands_entry.dart';
import '../components/navigation/dashboard_profile_switcher_bar.dart';
import '../components/navigation/profile_switcher_sheet.dart';

class HomeView extends StatefulWidget {
  final AppState state;
  final VoidCallback onOpenVoice;
  final WeatherApi? weatherApi;

  const HomeView({
    super.key,
    required this.state,
    required this.onOpenVoice,
    this.weatherApi,
  });

  @override
  State<HomeView> createState() => _HomeViewState();
}

class _HomeViewState extends State<HomeView> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  late final WeatherApi _weatherApi = widget.weatherApi ?? WeatherApi();
  Map<String, dynamic>? _weather;
  bool _weatherOffline = false;

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

    _loadWeather();
  }

  Future<void> _loadWeather() async {
    final (lat, lng) = _weatherCoords();
    try {
      final data = await _weatherApi.getWeather(lat, lng);
      if (mounted) setState(() => _weather = data);
    } catch (_) {
      if (mounted) setState(() => _weatherOffline = true);
    }
  }

  (double, double) _weatherCoords() {
    final points = widget.state.profile.farmBoundaryPoints;
    if (points.isEmpty) return (20.0, 73.8); // Nashik default
    final lat =
        points.map((p) => p['lat'] ?? 0.0).reduce((a, b) => a + b) /
            points.length;
    final lng =
        points.map((p) => p['lng'] ?? 0.0).reduce((a, b) => a + b) /
            points.length;
    return (lat, lng);
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

          // 1.6. 🩺 Vet Workspace banner (only for users with a claimed vet profile)
          if (widget.state.isVet)
            StaggeredSlideFade(
              delayMs: 60,
              duration: const Duration(milliseconds: 550),
              child: _buildVetWorkspaceBanner(context),
            ),
          if (widget.state.isVet) const SizedBox(height: 14),

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

          // 3.6. 🛒 Buy-demands banner — companies buying produce, farmer can offer
          StaggeredSlideFade(
            delayMs: 300,
            duration: const Duration(milliseconds: 550),
            child: FarmerBuyDemandsEntry(state: widget.state),
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
            child: AajKeBhavWidget(state: widget.state),
          ),
          const SizedBox(height: 16),

          // 6. 🎁 Refer & Earn Point System Banner Card
          StaggeredSlideFade(
            delayMs: 580,
            duration: const Duration(milliseconds: 550),
            child: _buildNewReferralBanner(context),
          ),
        ],
      ),
    );
  }

  // Profile fields may be blank until GET /users/me hydrates them — fall back
  // to the phone number or a neutral greeting instead of a fabricated name.
  String get _displayName {
    final p = widget.state.profile;
    if (p.name.isNotEmpty) return p.name;
    if (p.phone.isNotEmpty) return p.phone;
    return widget.state.tr('profile.nameFallback');
  }

  String get _locationLine {
    final p = widget.state.profile;
    final acres =
        p.landAreaAcres > 0 ? '${p.landAreaAcres} ${widget.state.tr('acresOfLand')}' : '';
    if (p.village.isEmpty) return acres;
    if (acres.isEmpty) return p.village;
    return '${p.village} • $acres';
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
                            widget.state.tr('goodMorning'),
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.green.shade100,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.3,
                            ),
                          ),
                          const SizedBox(width: 8),
                          PulsingBeaconBadge(
                            label: widget.state.tr('profile.liveApmc'),
                            color: Color(0xFF00E676),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _displayName,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          letterSpacing: -0.2,
                        ),
                      ),
                      if (_locationLine.isNotEmpty)
                        Text(
                          _locationLine,
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
                  onTap: () => widget.state.navigateTo('notifications'),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 20),
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
                        "${widget.state.tr('activeRole')}: ${widget.state.activeProfileMeta.label(widget.state.language)} (${widget.state.linkedProfiles.length} ${widget.state.tr('roleProfiles')})",
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
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.swap_horiz_rounded, size: 12, color: Color(0xFF1B5E20)),
                          const SizedBox(width: 3),
                          Text(
                            widget.state.tr('change'),
                            style: const TextStyle(
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

  // 1.6. Vet Workspace banner — claimed vets jump straight to their clinic inbox.
  Widget _buildVetWorkspaceBanner(BuildContext context) {
    return BouncyPressable(
      onTap: () => widget.state.navigateTo('vetHome'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF00838F), Color(0xFF006064)],
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF00838F).withValues(alpha: 0.3),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            const Icon(Icons.medical_services_rounded,
                color: Colors.white, size: 24),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.state.tr('livestock.claim.workspaceTitle'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    widget.state.tr('livestock.claim.workspaceSubtitle'),
                    style:
                        const TextStyle(color: Colors.white70, fontSize: 11),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios_rounded,
                color: Colors.white, size: 14),
          ],
        ),
      ),
    );
  }

  // 2. Weather & Alert Quick Capsule (live /v1/weather; explicit error/retry
  // state on failure — no fabricated temperature fallback).
  Widget _buildWeatherAlertStrip(BuildContext context) {
    final weather = _weather;
    if (weather == null && _weatherOffline) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF7ED),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFFDBA74)),
        ),
        child: Row(
          children: [
            const Icon(Icons.cloud_off_rounded, color: Color(0xFFEA580C), size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                widget.state.tr('profile.weatherLoadFailed'),
                style: const TextStyle(
                    fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF9A3412)),
              ),
            ),
            TextButton(
              onPressed: _loadWeather,
              child: Text(
                widget.state.tr('retry'),
                style: const TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFFEA580C)),
              ),
            ),
          ],
        ),
      );
    }
    if (weather == null) {
      return Container(
        height: 52,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE0F2FE)),
        ),
        child: const Center(
          child: SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0284C7)),
          ),
        ),
      );
    }

    final tempC = (weather['tempC'] as num?)?.round() ?? 0;
    final rainProbability = (weather['rainProbability'] as num?)?.round() ?? 0;
    final condition = weather['condition'] as String? ?? '';
    final radarAvailable = weather['radarAvailable'] == true;

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
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        "$tempC° • $rainProbability% ${widget.state.tr('rain')}",
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF263238)),
                      ),
                    ),
                    if (_weatherOffline) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFFDBA74)),
                        ),
                        child: Text(
                          widget.state.tr('offlineWithCount'),
                          style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: Color(0xFFEA580C)),
                        ),
                      ),
                    ],
                  ],
                ),
                if (condition.isNotEmpty)
                  Text(
                    condition,
                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF0284C7), fontWeight: FontWeight.w600),
                  ),
              ],
            ),
          ),
          if (radarAvailable)
            PulsingBeaconBadge(
              label: widget.state.tr('profile.rainRadar'),
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
        'title': widget.state.tr('transportation'),
        'sub': widget.state.tr('profile.subTractorVehicles'),
        'icon': Icons.local_shipping_rounded,
        'bg': const Color(0xFFE8F5E9),
        'iconColor': const Color(0xFF2E7D32),
        'route': 'equipment',
      },
      {
        'title': widget.state.tr('marketPrice'),
        'sub': widget.state.tr('profile.subLiveApmcRates'),
        'icon': Icons.show_chart_rounded,
        'bg': const Color(0xFFFFF9C4),
        'iconColor': const Color(0xFFF57F17),
        'route': 'mandi',
      },
      {
        'title': widget.state.tr('chatUs'),
        'sub': 'Kisan Mitra AI',
        'icon': Icons.auto_awesome_rounded,
        'bg': const Color(0xFFE8F5E9),
        'iconColor': const Color(0xFF2E7D32),
        'route': 'advisory',
      },
      {
        'title': widget.state.tr('myBookings'),
        'sub': widget.state.tr('profile.subEquipmentRides'),
        'icon': Icons.assignment_turned_in,
        'bg': const Color(0xFFE0F2F1),
        'iconColor': const Color(0xFF0D9488),
        'route': 'myBookings',
      },
      {
        'title': widget.state.tr('agriculturalLoan'),
        'sub': '0% BNPL & KCC',
        'icon': Icons.account_balance_rounded,
        'bg': const Color(0xFFFFF9C4),
        'iconColor': const Color(0xFFF57F17),
        'route': 'finance',
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              widget.state.tr('ourServices'),
              style: const TextStyle(
                fontSize: 16.5,
                fontWeight: FontWeight.w900,
                color: Color(0xFF263238),
                letterSpacing: -0.2,
              ),
            ),
            Text(
              "${services.length} ${widget.state.tr('activeServices')}",
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
                    child: Text(
                      widget.state.tr('hotOffer'),
                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    widget.state.tr('discountFifty'),
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF263238),
                      letterSpacing: -0.5,
                    ),
                  ),
                  Text(
                    widget.state.tr('offerSub'),
                    style: const TextStyle(
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
                      child: Text(
                        widget.state.tr('getDiscount'),
                        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF263238)),
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

  // 3.5. 🌟 New Core Modules Quick Grid (Tree, Live Channels, Livestock & Diary)
  Widget _buildNewCoreModulesSection(BuildContext context) {
    final modules = [
      {
        'title': widget.state.tr('cropInsurance'),
        'sub': widget.state.tr('profile.subClaimCover'),
        'icon': Icons.health_and_safety_rounded,
        'bg': const Color(0xFFD1FAE5),
        'iconColor': const Color(0xFF047857),
        'route': 'cropInsurance',
      },
      {
        'title': widget.state.tr('treePlantation'),
        'sub': widget.state.tr('profile.subBiofuelTrees'),
        'icon': Icons.park_rounded,
        'bg': const Color(0xFFDCFCE7),
        'iconColor': const Color(0xFF15803D),
        'route': 'treePlantation',
      },
      {
        'title': widget.state.tr('liveChannels'),
        'sub': widget.state.tr('profile.subLiveApmcKvk'),
        'icon': Icons.live_tv_rounded,
        'bg': const Color(0xFFFFE4E6),
        'iconColor': const Color(0xFFE11D48),
        'route': 'liveChannels',
      },
      {
        'title': widget.state.tr('livestockDairy'),
        'sub': widget.state.tr('profile.subDairyVetCow'),
        'icon': Icons.pets_rounded,
        'bg': const Color(0xFFFEF3C7),
        'iconColor': const Color(0xFFD97706),
        'route': 'livestockDairy',
      },
      {
        'title': widget.state.tr('farmDiary'),
        'sub': widget.state.tr('profile.subFarmDiaryPnl'),
        'icon': Icons.menu_book_rounded,
        'bg': const Color(0xFFEEF2FF),
        'iconColor': const Color(0xFF4F46E5),
        'route': 'farmDiary',
      },
      {
        'title': widget.state.tr('agriNews'),
        'sub': widget.state.tr('profile.subDailyMarketNews'),
        'icon': Icons.newspaper_rounded,
        'bg': const Color(0xFFE0F2FE),
        'iconColor': const Color(0xFF0284C7),
        'route': 'agriNews',
      },
      {
        'title': widget.state.tr('dnyanSetu'),
        'sub': widget.state.tr('profile.subPaidMasterclasses'),
        'icon': Icons.school_rounded,
        'bg': const Color(0xFFF3E8FF),
        'iconColor': const Color(0xFF9333EA),
        'route': 'gyanHub',
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              widget.state.tr('specialModules'),
              style: const TextStyle(
                fontSize: 16.5,
                fontWeight: FontWeight.w900,
                color: Color(0xFF263238),
                letterSpacing: -0.2,
              ),
            ),
            Text(
              "6 ${widget.state.tr('profile.newHubs')}",
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
                      m['sub'] as String,
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
                    child: Text(
                      widget.state.tr('referralBannerBadge'),
                      style: const TextStyle(color: Color(0xFF713F12), fontSize: 10, fontWeight: FontWeight.w900),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    widget.state.tr('referralCoinsTitle'),
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Colors.white),
                  ),
                  Text(
                    widget.state.tr('referralBannerDesc'),
                    style: const TextStyle(fontSize: 11, color: Color(0xFFFEF3C7), height: 1.3),
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
                      child: Text(
                        widget.state.tr('viewReferralCode'),
                        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF713F12)),
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



