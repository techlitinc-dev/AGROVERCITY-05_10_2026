import 'dart:ui';
import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../state/profile_routes.dart';
import '../common/motion_animations.dart';

class AllToolsSheet extends StatelessWidget {
  final AppState state;

  const AllToolsSheet({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    // All Modules Master List (titles reuse base module keys via state.tr(m.id);
    // subtitles carry their own translation key, resolved below)
    final allModules = [
      _ToolItem('home', 'navigation.homeHub', Icons.home_rounded, const Color(0xFF16A34A)),
      _ToolItem('gyanHub', 'navigation.workshopsMedia', Icons.school_rounded, const Color(0xFFD97706)),
      _ToolItem('treePlantation', 'navigation.treeHub', Icons.park_rounded, const Color(0xFF15803D)),
      _ToolItem('liveChannels', 'navigation.liveStreams', Icons.live_tv_rounded, const Color(0xFFE11D48)),
      _ToolItem('agriNews', 'agriNews', Icons.newspaper_rounded, const Color(0xFF0284C7)),
      _ToolItem('livestockDairy', 'navigation.dairyEcosystem', Icons.pets_rounded, const Color(0xFFD97706)),
      _ToolItem('farmDiary', 'farmDiary', Icons.menu_book_rounded, const Color(0xFF4F46E5)),
      _ToolItem('referEarn', 'referEarn', Icons.card_giftcard_rounded, const Color(0xFFCA8A04)),
      _ToolItem('advisory', 'aiScan', Icons.camera_alt_rounded, const Color(0xFF0284C7)),
      _ToolItem('mandi', 'navigation.liveApmc', Icons.trending_up_rounded, const Color(0xFFEA580C)),
      _ToolItem('marketplace', 'eMarket', Icons.storefront_rounded, const Color(0xFF84CC16)),
      _ToolItem('myProducts', 'emarket.myProductsSubtitle', Icons.inventory_2_rounded, const Color(0xFFEA580C)),
      _ToolItem('buyers', 'buyers', Icons.handshake_rounded, const Color(0xFFD97706)),
      _ToolItem('profitLoss', 'navigation.financeCeo', Icons.pie_chart_rounded, const Color(0xFF10B981)),
      _ToolItem('water', 'navigation.smartWater', Icons.water_drop_rounded, const Color(0xFF06B6D4)),
      _ToolItem('schemes', 'schemes', Icons.account_balance_rounded, const Color(0xFF6366F1)),
      _ToolItem('finance', 'navigation.loanCredit', Icons.credit_card_rounded, const Color(0xFF8B5CF6)),
      _ToolItem('cropInsurance', 'cropInsurance', Icons.health_and_safety_rounded, const Color(0xFF047857)),
      _ToolItem('myBookings', 'myBookings', Icons.assignment_turned_in, const Color(0xFF0D9488)),
      _ToolItem('womenFarmer', 'navigation.womenHub', Icons.favorite_rounded, const Color(0xFFEC4899)),
      _ToolItem('fpo', 'navigation.fpoGrowth', Icons.groups_rounded, const Color(0xFF14B8A6)),
      _ToolItem('equipment', 'navigation.tractorRent', Icons.agriculture_rounded, const Color(0xFFF59E0B)),
      _ToolItem('landLegal', 'navigation.landRecords', Icons.description_rounded, const Color(0xFF78716C)),
      _ToolItem('climate', 'navigation.carbonEco', Icons.eco_rounded, const Color(0xFF22C55E)),
      _ToolItem('postHarvest', 'navigation.coldChain', Icons.inventory_2_rounded, const Color(0xFF3B82F6)),
      _ToolItem('krishiRatna', 'navigation.coinRewards', Icons.military_tech_rounded, const Color(0xFFEAB308)),
    ];

    // Home is universal — every profile gets its own home route
    final homeRoute = ProfileRoutes.defaultRouteFor(state.activeProfile);

    // Filter according to active profile permissions (Home always stays)
    final modules = allModules
        .where((m) => m.id == 'home' || ProfileRoutes.canAccess(state.activeProfile, m.id))
        .toList();

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 25, sigmaY: 25),
        child: Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.86,
          ),
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 28),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.96),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
            border: Border.all(color: Colors.white.withValues(alpha: 0.6), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2),
                blurRadius: 36,
                offset: const Offset(0, -8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Top Pull Handle
              Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.grey.shade400,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              const SizedBox(height: 12),

              // Tray Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.apps_rounded, color: Color(0xFF2E7D32), size: 22),
                      const SizedBox(width: 8),
                      Text(
                        "${state.tr('appName')}: ${state.tr('allTools')}",
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF1B4332),
                        ),
                      ),
                    ],
                  ),
                  BouncyPressable(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close_rounded, size: 18, color: Colors.black87),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // 3 Columns × 6 Rows Animated Grid
              Flexible(
                child: GridView.builder(
                  shrinkWrap: true,
                  physics: const BouncingScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3, // 3 Columns
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    childAspectRatio: 1.12,
                  ),
                  itemCount: modules.length,
                  itemBuilder: (context, index) {
                    final m = modules[index];
                    final target = m.id == 'home' ? homeRoute : m.id;
                    final isActive = state.currentRoute == target;

                    return StaggeredSlideFade(
                      delayMs: (index * 30),
                      duration: const Duration(milliseconds: 400),
                      offset: const Offset(0.0, 0.08),
                      child: BouncyPressable(
                        onTap: () {
                          state.navigateTo(target);
                          Navigator.pop(context);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                          decoration: BoxDecoration(
                            color: isActive ? const Color(0xFFD8F3DC) : Colors.white,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: isActive ? const Color(0xFF2D6A4F) : const Color(0xFFE2E8F0),
                              width: isActive ? 1.8 : 1.0,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: isActive
                                    ? const Color(0xFF2D6A4F).withValues(alpha: 0.2)
                                    : Colors.black.withValues(alpha: 0.04),
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
                                  color: m.color.withValues(alpha: 0.14),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(m.icon, size: 20, color: m.color),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                state.tr(m.id),
                                textAlign: TextAlign.center,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: isActive ? FontWeight.w900 : FontWeight.w700,
                                  color: isActive ? const Color(0xFF1B4332) : const Color(0xFF263238),
                                ),
                              ),
                              Text(
                                state.tr(m.subtitleKey),
                                textAlign: TextAlign.center,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.grey.shade600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ToolItem {
  final String id;
  final String subtitleKey;
  final IconData icon;
  final Color color;

  _ToolItem(this.id, this.subtitleKey, this.icon, this.color);
}
