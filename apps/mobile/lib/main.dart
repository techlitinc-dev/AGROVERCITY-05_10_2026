// Kisan Setu (किसान सेतु) — Flutter Super App with Circular Radial Orbit Menu & Luxury Glassmorphic UI

import 'dart:ui';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';

import 'firebase_options.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'api/api_client.dart';
import 'components/auth/mpin_reentry_sheet.dart';
import 'core/debug_drawer.dart';
import 'core/navigation.dart';
import 'core/theme.dart';
import 'state/app_state.dart';

// Components
import 'components/layout/luxury_top_bar.dart';
import 'components/layout/animated_glass_background.dart';
import 'components/navigation/apple_plank_dock.dart';
import 'components/navigation/all_tools_sheet.dart';
import 'components/navigation/kisan_mitra_fab.dart';
import 'components/voice/voice_assistant_sheet.dart';
import 'components/voice/kisan_mitra_chatbot_sheet.dart';




// Onboarding Views
import 'views/onboarding/splash_screen.dart';
import 'views/onboarding/language_select_view.dart';
import 'views/onboarding/profile_select_view.dart';
import 'views/onboarding/auth_view.dart';
import 'views/onboarding/farm_map_marker_view.dart';

// Profile Home Views
import 'views/profile_home/landlord_home_view.dart';
import 'views/profile_home/transport_home_view.dart';
import 'views/profile_home/seller_home_view.dart';
import 'views/profile_home/equipment_owner_home_view.dart';
import 'views/profile_home/broker_home_view.dart';

// Main App Views
import 'views/home_view.dart';
import 'views/gyan_hub_view.dart';
import 'views/advisory_view.dart';
import 'views/mandi_view.dart';
import 'views/marketplace_view.dart';
import 'views/buyers_view.dart';
import 'views/profit_loss_view.dart';
import 'views/water_view.dart';
import 'views/schemes_view.dart';
import 'views/finance_view.dart';
import 'views/women_farmer_view.dart';
import 'views/fpo_engine_view.dart';
import 'views/equipment_view.dart';
import 'views/land_legal_view.dart';
import 'views/climate_carbon_view.dart';
import 'views/post_harvest_view.dart';
import 'views/krishi_ratna_view.dart';
import 'views/tree_plantation_view.dart';
import 'views/live_channels_view.dart';
import 'views/agri_news_view.dart';
import 'views/livestock_dairy_view.dart';
import 'views/farm_diary_view.dart';
import 'views/refer_earn_view.dart';
import 'views/crop_insurance_view.dart';
import 'views/common/profile_edit_view.dart';
import 'views/common/address_book_view.dart';
import 'views/farmer/sell_produce_view.dart';
import 'views/order_tracking_view.dart';
import 'views/transporter/trip_detail_view.dart';
import 'views/transporter/vehicle_manage_view.dart';
import 'views/transporter/vehicle_calendar_view.dart';
import 'views/transporter/booking_inbox_view.dart';
import 'views/equipment_owner/machine_manage_view.dart';
import 'views/equipment_owner/slot_calendar_manage_view.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
    PlatformDispatcher.instance.onError = (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
      return true;
    };
  } catch (e) {
    debugPrint('Firebase not configured yet, Crashlytics disabled: $e');
  }
  late final AppState appState;
  final apiClient = ApiClient(
    languageProvider: () => appState.language,
    sessionRestorer: MpinSessionRestorer(
      contextProvider: () => rootNavigatorKey.currentContext,
    ),
  );
  appState = AppState(apiClient: apiClient);
  await appState.loadPersistedState();
  runApp(KisanSetuApp(appState: appState));
}

class KisanSetuApp extends StatefulWidget {
  final AppState? appState;
  const KisanSetuApp({super.key, this.appState});

  @override
  State<KisanSetuApp> createState() => _KisanSetuAppState();
}

class _KisanSetuAppState extends State<KisanSetuApp> {
  late final AppState _appState;

  @override
  void initState() {
    super.initState();
    _appState = widget.appState ?? AppState();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _appState,
      builder: (context, _) {
        return MaterialApp(
          navigatorKey: rootNavigatorKey,
          title: 'AGROVERCITY',
          debugShowCheckedModeBanner: false,
          theme: buildAppTheme(),
          home: _buildCurrentFlowScreen(context),
        );
      },
    );
  }

  Widget _buildCurrentFlowScreen(BuildContext context) {
    // 1. If not onboarded yet, show the animated onboarding journey with cinematic page transitions
    if (!_appState.isOnboarded) {
      return AnimatedSwitcher(
        duration: const Duration(milliseconds: 550),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (child, animation) {
          final slideIn = Tween<Offset>(
            begin: const Offset(0.04, 0.0),
            end: Offset.zero,
          ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));

          final scaleIn = Tween<double>(
            begin: 0.94,
            end: 1.0,
          ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));

          return FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position: slideIn,
              child: ScaleTransition(
                scale: scaleIn,
                child: child,
              ),
            ),
          );
        },
        child: KeyedSubtree(
          key: ValueKey<String>(_appState.onboardingStep),
          child: _renderOnboardingStep(_appState.onboardingStep),
        ),
      );
    }

    // 2. Once onboarded, show the full Dashboard with Luxury Top Bar, Bottom Launcher Dock & Floating Kisan Mitra AI
    return Scaffold(
      endDrawer: const DebugDrawer(),
      body: SafeArea(
        child: AnimatedGlassBackground(
          isWomenMode: _appState.isWomenMode,
          child: Stack(
            children: [
              // Main Body Layout
              Column(
                children: [
                  // 🌿 Luxury Top Header with Dynamic Island & Status Capsule
                  LuxuryTopBar(
                    state: _appState,
                    onOpenVoice: () => _openVoiceAssistant(context),
                    onOpenAllTools: () => _openAllTools(context),
                  ),

                  // Active View Container with Dynamic Spatial Page Transitions
                  Expanded(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 400),
                      switchInCurve: Curves.easeOutCubic,
                      switchOutCurve: Curves.easeInCubic,
                      transitionBuilder: (child, animation) {
                        final slideIn = Tween<Offset>(
                          begin: const Offset(0.0, 0.04),
                          end: Offset.zero,
                        ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));

                        final scaleIn = Tween<double>(
                          begin: 0.94,
                          end: 1.0,
                        ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));

                        return FadeTransition(
                          opacity: animation,
                          child: SlideTransition(
                            position: slideIn,
                            child: ScaleTransition(
                              scale: scaleIn,
                              child: child,
                            ),
                          ),
                        );
                      },
                      child: KeyedSubtree(
                        key: ValueKey<String>(_appState.currentRoute),
                        child: _renderActiveView(_appState),
                      ),
                    ),
                  ),
                ],
              ),

              // 🪵 Minimal Bottom Floating Dock (Launchpad Only - Mic Removed)
              ApplePlankDock(
                state: _appState,
                onOpenVoice: () => _openVoiceAssistant(context),
              ),

              // 🤖 Floating "Kisan Mitra AI" Button with assets/ai.png & animated name popup badge
              Positioned(
                bottom: 96,
                right: 18,
                child: KisanMitraFab(
                  isWomenMode: _appState.isWomenMode,
                  onTap: () => _openChatbot(context),
                ),
              ),

              // Toast Notification Banner
              if (_appState.toastMessage != null)
                Positioned(
                  top: 60,
                  left: 20,
                  right: 20,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                      decoration: BoxDecoration(

                        color: const Color(0xFF112A1F),
                        borderRadius: BorderRadius.circular(30),
                        border: Border.all(color: const Color(0xFFE9C46A), width: 1.2),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.3),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.auto_awesome_rounded, color: Color(0xFFE9C46A), size: 16),
                          SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              _appState.toastMessage!,
                              style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w700),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );

  }

  void _openVoiceAssistant(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => VoiceAssistantSheet(state: _appState),
    );
  }

  void _openChatbot(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => KisanMitraChatbotSheet(state: _appState),
    );
  }


  void _openAllTools(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => AllToolsSheet(state: _appState),
    );
  }

  Widget _renderOnboardingStep(String step) {
    switch (step) {
      case 'splash':
        return SplashScreen(state: _appState);
      case 'language':
        return LanguageSelectView(state: _appState);
      case 'profileSelect':
        return ProfileSelectView(state: _appState);
      case 'auth':
      case 'register':
        return AuthView(state: _appState, initialMode: _appState.authMode);
      case 'map':
        return FarmMapMarkerView(state: _appState);
      default:
        return SplashScreen(state: _appState);
    }
  }

  Widget _renderActiveView(AppState state) {
    switch (state.currentRoute) {
      case 'landlordHome':
        return LandlordHomeView(state: state);
      case 'transportHome':
        return TransportHomeView(state: state);
      case 'tripDetail':
        return TripDetailView(state: state);
      case 'vehicleManage':
        return VehicleManageView(state: state);
      case 'vehicleCalendar':
        return VehicleCalendarView(state: state);
      case 'bookingInbox':
        return BookingInboxView(state: state);
      case 'sellerHome':
        return SellerHomeView(state: state);
      case 'equipmentOwnerHome':
        return EquipmentOwnerHomeView(state: state);
      case 'machineManage':
        return MachineManageView(state: state);
      case 'slotCalendarManage':
        return SlotCalendarManageView(state: state);
      case 'brokerHome':
        return BrokerHomeView(state: state);
      case 'gyanHub':
        return GyanHubView(state: state);
      case 'advisory':
        return AdvisoryView(state: state);
      case 'mandi':
        return MandiView(state: state);
      case 'sellProduce':
        return SellProduceView(state: state);
      case 'orderTracking':
        return OrderTrackingView(state: state);
      case 'addressBook':
        return AddressBookView(state: state);
      case 'marketplace':
        return MarketplaceView(state: state);
      case 'buyers':
        return BuyersView(state: state);
      case 'profitLoss':
        return ProfitLossView(state: state);
      case 'water':
        return WaterView(state: state);
      case 'schemes':
        return SchemesView(state: state);
      case 'finance':
        return FinanceView(state: state);
      case 'womenFarmer':
        return WomenFarmerView(state: state);
      case 'fpo':
        return FpoEngineView(state: state);
      case 'equipment':
        return EquipmentView(state: state);
      case 'landLegal':
        return LandLegalView(state: state);
      case 'climate':
        return ClimateCarbonView(state: state);
      case 'postHarvest':
        return PostHarvestView(state: state);
      case 'krishiRatna':
        return KrishiRatnaView(state: state);
      case 'treePlantation':
        return TreePlantationView(state: state);
      case 'liveChannels':
        return LiveChannelsView(state: state);
      case 'agriNews':
        return AgriNewsView(state: state);
      case 'livestockDairy':
        return LivestockDairyView(state: state);
      case 'farmDiary':
        return FarmDiaryView(state: state);
      case 'referEarn':
        return ReferEarnView(state: state);
      case 'cropInsurance':
        return CropInsuranceView(state: state);
      case 'profileEdit':
        return ProfileEditView(state: state);
      case 'home':
      default:
        return HomeView(
          state: state,
          onOpenVoice: () => _openVoiceAssistant(context),
        );
    }
  }
}

