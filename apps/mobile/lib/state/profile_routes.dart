// Multi-Profile System — Route Access Control Layer

import '../models/user_profile_type.dart';

class ProfileRoutes {
  static const Map<UserProfileType, Set<String>> _accessMap = {
    UserProfileType.farmer: {
      'home',
      'profileEdit',
      'gyanHub',
      'krishiRatna',
      'mandi',
      'sellProduce',
      'marketplace',
      'orderTracking',
      'addressBook',
      'buyers',
      'advisory',
      'profitLoss',
      'water',
      'schemes',
      'finance',
      'womenFarmer',
      'fpo',
      'equipment',
      'landLegal',
      'climate',
      'postHarvest',
      'treePlantation',
      'liveChannels',
      'agriNews',
      'livestockDairy',
      'farmDiary',
      'referEarn',
      'cropInsurance',
    },
    UserProfileType.farmLandlord: {
      'landlordHome',
      'profileEdit',
      'landLegal',
      'schemes',
      'finance',
      'cropInsurance',
      'profitLoss',
      'krishiRatna',
      'gyanHub',
      'marketplace',
      'orderTracking',
      'addressBook',
      'treePlantation',
      'agriNews',
      'farmDiary',
      'referEarn',
    },
    UserProfileType.transport: {
      'transportHome',
      'tripDetail',
      'vehicleManage',
      'vehicleCalendar',
      'bookingInbox',
      'profileEdit',
      'postHarvest',
      'marketplace',
      'orderTracking',
      'addressBook',
      'finance',
      'krishiRatna',
      'gyanHub',
      'liveChannels',
      'agriNews',
      'referEarn',
    },
    UserProfileType.seller: {
      'sellerHome',
      'profileEdit',
      'mandi',
      'buyers',
      'marketplace',
      'orderTracking',
      'addressBook',
      'finance',
      'profitLoss',
      'krishiRatna',
      'gyanHub',
      'postHarvest',
      'livestockDairy',
      'treePlantation',
      'agriNews',
      'referEarn',
    },
    UserProfileType.equipmentRental: {
      'equipmentOwnerHome',
      'machineManage',
      'slotCalendarManage',
      'profileEdit',
      'equipment',
      'finance',
      'profitLoss',
      'krishiRatna',
      'gyanHub',
      'liveChannels',
      'agriNews',
      'referEarn',
    },
    UserProfileType.broker: {
      'brokerHome',
      'profileEdit',
      'mandi',
      'buyers',
      'finance',
      'profitLoss',
      'krishiRatna',
      'gyanHub',
      'liveChannels',
      'agriNews',
      'referEarn',
    },
  };

  /// Returns true if [profile] has permission to navigate to or view [route].
  static bool canAccess(UserProfileType profile, String route) {
    // Universal safe routes like 'womenFarmer' or profile homes
    final routes = _accessMap[profile];
    if (routes == null) return false;
    return routes.contains(route);
  }

  /// Returns the full set of accessible routes for [profile].
  static Set<String> routesFor(UserProfileType profile) {
    return _accessMap[profile] ?? _accessMap[UserProfileType.farmer]!;
  }

  /// Returns the default landing route for [profile].
  static String defaultRouteFor(UserProfileType profile) {
    return UserProfileRegistry.meta(profile).defaultHomeRoute;
  }
}
