// Per-Profile Bottom Menu Bar — persona-aware primary navigation
//
// Fixed 5-slot layout for every profile: [Home, Work A, Work B, Wallet, Profile].
// Navigates through the AppState state-machine router (state.navigateTo), so
// the ProfileRoutes access gate and navigation history keep working. "Wallet"
// and "Profile" are universal placeholder modules registered in ProfileRoutes.

import 'package:flutter/material.dart';
import '../../models/user_profile_type.dart';
import '../../state/app_state.dart';
import '../../state/profile_routes.dart';
import '../common/motion_animations.dart';

class _MenuItem {
  final String route;
  final String labelKey;
  final IconData icon;

  const _MenuItem(this.route, this.labelKey, this.icon);
}

class BottomMenuBar extends StatelessWidget {
  final AppState state;

  const BottomMenuBar({super.key, required this.state});

  /// Persona-specific middle tabs (existing, fully implemented modules only).
  static const Map<UserProfileType, List<_MenuItem>> _personaTabs = {
    UserProfileType.farmer: [
      _MenuItem('mandi', 'navigation.liveApmc', Icons.trending_up_rounded),
      _MenuItem('sellProduce', 'sellYourProduce', Icons.sell_rounded),
    ],
    UserProfileType.farmLandlord: [
      _MenuItem('landlordPlots', 'landlord.myPlots', Icons.map_rounded),
      _MenuItem('landlordLeases', 'landlord.leasesTitle', Icons.assignment_rounded),
    ],
    UserProfileType.transport: [
      _MenuItem('loadBoard', 'navigation.loadBoard', Icons.local_shipping_rounded),
      _MenuItem('bookingInbox', 'transporter.bookingRequests', Icons.inbox_rounded),
    ],
    UserProfileType.seller: [
      _MenuItem('mandi', 'navigation.liveApmc', Icons.trending_up_rounded),
      _MenuItem('sellerProducts', 'emarket.myProducts', Icons.inventory_2_rounded),
    ],
    UserProfileType.equipmentRental: [
      _MenuItem('machineManage', 'equipment.myMachines', Icons.construction_rounded),
      _MenuItem('slotCalendarManage', 'equipment.slotCalendar', Icons.calendar_month_rounded),
    ],
    UserProfileType.broker: [
      _MenuItem('mandi', 'navigation.liveApmc', Icons.trending_up_rounded),
      _MenuItem('buyers', 'buyers', Icons.handshake_rounded),
    ],
    UserProfileType.instructor: [
      _MenuItem('courses', 'coursesTitle', Icons.school_rounded),
      _MenuItem('myLibrary', 'myLibraryK', Icons.menu_book_rounded),
    ],
    UserProfileType.dairyManager: [
      _MenuItem('livestockDairy', 'livestockDairy', Icons.pets_rounded),
      _MenuItem('dairyConsole', 'livestock.mgmt.consoleTitle', Icons.dashboard_rounded),
    ],
    UserProfileType.customer: [
      _MenuItem('marketplace', 'marketplace', Icons.storefront_rounded),
      _MenuItem('orderTracking', 'bookings.orderTrackingTitle', Icons.local_shipping_rounded),
    ],
    UserProfileType.directBuyer: [
      _MenuItem('demands', 'direct.demandsTitle', Icons.request_quote_rounded),
      _MenuItem('purchases', 'direct.purchasesTitle', Icons.shopping_basket_rounded),
    ],
    UserProfileType.bankManager: [
      _MenuItem('loanDashboard', 'loans.queueTitle', Icons.account_balance_rounded),
      _MenuItem('settlements', 'bookings.settlementsTitle', Icons.payments_rounded),
    ],
    UserProfileType.insuranceProvider: [
      _MenuItem('cropInsurance', 'cropInsurance', Icons.shield_rounded),
      _MenuItem('settlements', 'bookings.settlementsTitle', Icons.payments_rounded),
    ],
    UserProfileType.coldStorageProvider: [
      _MenuItem('postHarvest', 'navigation.coldChain', Icons.warehouse_rounded),
      _MenuItem('myBookings', 'myBookings', Icons.assignment_turned_in_rounded),
    ],
  };

  static const _walletTab = _MenuItem(
    'wallet',
    'navigation.wallet',
    Icons.account_balance_wallet_rounded,
  );
  static const _profileTab = _MenuItem(
    'profileHub',
    'navigation.profile',
    Icons.person_rounded,
  );

  List<_MenuItem> _itemsFor(UserProfileType profile) {
    return [
      _MenuItem(
        ProfileRoutes.defaultRouteFor(profile),
        'home',
        Icons.home_rounded,
      ),
      ...?_personaTabs[profile],
      _walletTab,
      _profileTab,
    ];
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        final profile = state.activeProfile;
        final meta = UserProfileRegistry.meta(profile);
        final personaColor = meta.primaryColor;
        final items = _itemsFor(profile);

        return Positioned(
          bottom: 12,
          left: 14,
          right: 14,
          child: Container(
            height: 66,
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 5),
            decoration: BoxDecoration(
              color: const Color(0xFF0F2419),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: personaColor.withValues(alpha: 0.6),
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.4),
                  blurRadius: 22,
                  offset: const Offset(0, 8),
                ),
                BoxShadow(
                  color: personaColor.withValues(alpha: 0.28),
                  blurRadius: 18,
                  spreadRadius: 1,
                ),
              ],
            ),
            child: Row(
              children: [
                for (final item in items)
                  Expanded(
                    child: _buildItem(
                      item: item,
                      isActive: state.currentRoute == item.route,
                      personaColor: personaColor,
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildItem({
    required _MenuItem item,
    required bool isActive,
    required Color personaColor,
  }) {
    return BouncyPressable(
      onTap: () => state.navigateTo(item.route),
      child: SizedBox(
        height: 56,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              padding: EdgeInsets.symmetric(
                horizontal: isActive ? 13 : 0,
                vertical: 4,
              ),
              decoration: BoxDecoration(
                color: isActive
                    ? personaColor.withValues(alpha: 0.95)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(18),
                boxShadow: isActive
                    ? [
                        BoxShadow(
                          color: personaColor.withValues(alpha: 0.5),
                          blurRadius: 10,
                          spreadRadius: 0.5,
                        ),
                      ]
                    : null,
              ),
              child: Icon(
                item.icon,
                size: 21,
                color: isActive
                    ? Colors.white
                    : Colors.white.withValues(alpha: 0.55),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              state.tr(item.labelKey),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: isActive ? FontWeight.w900 : FontWeight.w600,
                letterSpacing: 0.1,
                color: isActive
                    ? Colors.white
                    : Colors.white.withValues(alpha: 0.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
