import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../api/auth_api.dart';
import '../api/chatbot_api.dart';
import '../api/marketplace_api.dart';
import '../api/user_api.dart';
import '../api/vet_api.dart';
import '../core/session_store.dart';
import '../models/app_models.dart';
import '../models/land_market_models.dart';
import '../models/land_models.dart';
import '../models/user_profile_type.dart';
import '../data/translations.dart';
import 'profile_routes.dart';

class AppState extends ChangeNotifier {
  AppState({
    ApiClient? apiClient,
    AuthApi? authApi,
    UserApi? userApi,
    MarketplaceApi? marketplaceApi,
    String initialLanguage = 'en',
  })  : _injectedClient = apiClient,
        _injectedAuthApi = authApi,
        _injectedUserApi = userApi,
        _injectedMarketplaceApi = marketplaceApi,
        _language = initialLanguage;

  final ApiClient? _injectedClient;
  final AuthApi? _injectedAuthApi;
  final UserApi? _injectedUserApi;
  final MarketplaceApi? _injectedMarketplaceApi;
  ApiClient? _defaultClient;

  ApiClient get _apiClient => _defaultClient ??=
      _injectedClient ?? ApiClient(languageProvider: () => _language);
  AuthApi get _authApi => _injectedAuthApi ?? AuthApi(client: _apiClient);
  UserApi get _userApi => _injectedUserApi ?? UserApi(client: _apiClient);
  MarketplaceApi get _marketplaceApi =>
      _injectedMarketplaceApi ?? MarketplaceApi(client: _apiClient);
  ChatbotApi get _chatbotApi => ChatbotApi(client: _apiClient);
  VetApi get _vetApi => VetApi(client: _apiClient);

  // True when the signed-in user has claimed a vet profile
  // (GET /livestock/vets/me returns 200).
  bool _isVet = false;
  bool get isVet => _isVet;

  /// Hydrates [_isVet] from the vet workspace endpoint. Any failure (404/403
  /// when no claimed profile exists, network errors) leaves it false.
  Future<void> loadVetProfile() async {
    try {
      await _vetApi.getMyVetProfile();
      if (!_isVet) {
        _isVet = true;
        notifyListeners();
      }
    } catch (_) {
      if (_isVet) {
        _isVet = false;
        notifyListeners();
      }
    }
  }

  // Onboarding flow: 'splash' -> 'language' -> 'profileSelect' -> 'register' -> 'map' -> 'dashboard'
  String _onboardingStep = 'splash';
  bool _isOnboarded = false;

  // Multi-Profile State
  UserProfileType _activeProfile = UserProfileType.farmer;
  final List<UserProfileType> _linkedProfiles = [UserProfileType.farmer];

  Map<String, dynamic>? _currentUser;

  String _currentRoute = 'home';
  bool _isOffline = false;
  bool _isWomenMode = false;
  bool _isHighContrast = false;
  bool _isDarkMode = false;
  String _language = 'en';
  // Derived from the real offline write queue (OfflineQueue.onPendingCountChanged
  // in main.dart); never seeded with a fabricated count.
  int _syncQueueCount = 0;
  String? _toastMessage;

  // Blank until applyAuthUser() hydrates it from the backend user doc.
  final FarmerProfile _profile = FarmerProfile.empty();
  List<Map<String, dynamic>> _cartItems = [];
  int _cartTotal = 0;

  final List<KisanMitraMessage> _chatbotMessages = [];

  String _userMpin = '';
  String _splashStep = 'group'; // 'group' -> 'kisanSetu' -> 'done'

  // Getters
  String get userMpin => _userMpin;
  String get splashStep => _splashStep;
  List<KisanMitraMessage> get chatbotMessages => _chatbotMessages;

  String get onboardingStep => _onboardingStep;
  bool get isOnboarded => _isOnboarded;
  String get currentRoute => _currentRoute;
  bool get isOffline => _isOffline;
  bool get isWomenMode => _isWomenMode;
  bool get isHighContrast => _isHighContrast;
  bool get isDarkMode => _isDarkMode;
  String get language => _language;
  int get syncQueueCount => _syncQueueCount;
  String? get toastMessage => _toastMessage;
  FarmerProfile get profile => _profile;
  List<Map<String, dynamic>> get cartItems => _cartItems;

  String tr(String key) => AppTranslations.get(key, _language);

  int get cartTotal => _cartTotal;
  int get cartItemCount =>
      _cartItems.fold(0, (sum, i) => sum + ((i['quantity'] as num).toInt()));

  // Multi-Profile Getters
  UserProfileType get activeProfile => _activeProfile;
  UserProfileMeta get activeProfileMeta => UserProfileRegistry.meta(_activeProfile);
  List<UserProfileType> get linkedProfiles => _linkedProfiles;
  Map<String, dynamic>? get currentUser => _currentUser;

  static UserProfileType _profileTypeFromKey(String key) =>
      UserProfileType.values.firstWhere(
        (t) => t.name == key,
        orElse: () => UserProfileType.farmer,
      );

  void applyAuthUser(Map<String, dynamic> user, {bool isNewUser = false}) {
    _currentUser = user;
    final linked = (user['linkedProfiles'] as List?)?.cast<String>();
    if (linked != null && linked.isNotEmpty) {
      _linkedProfiles
        ..clear()
        ..addAll(linked.map(_profileTypeFromKey));
    }
    final active = user['activeProfile'] as String?;
    if (active != null) {
      final activeType = _profileTypeFromKey(active);
      // Adopt the backend's active profile only when it is actually linked;
      // otherwise a stale/mismatched value would clobber the user's choice.
      if (_linkedProfiles.contains(activeType)) {
        _activeProfile = activeType;
      }
    }
    _profile.name = (user['name'] as String?) ?? _profile.name;
    _profile.vernacularName =
        (user['vernacularName'] as String?) ?? _profile.vernacularName;
    _profile.phone = (user['phone'] as String?) ?? _profile.phone;
    _profile.village = (user['village'] as String?) ?? _profile.village;
    _profile.tehsil = (user['tehsil'] as String?) ?? _profile.tehsil;
    _profile.district = (user['district'] as String?) ?? _profile.district;
    _profile.state = (user['state'] as String?) ?? _profile.state;
    _profile.soilType = (user['soilType'] as String?) ?? _profile.soilType;
    _profile.irrigationType =
        (user['irrigationType'] as String?) ?? _profile.irrigationType;
    _profile.krishiRatnaTitle =
        (user['krishiRatnaTitle'] as String?) ?? _profile.krishiRatnaTitle;
    _profile.bankName = (user['bankName'] as String?) ?? _profile.bankName;
    _profile.creditTier = (user['creditTier'] as String?) ?? _profile.creditTier;
    final acres = user['landAreaAcres'];
    if (acres is num) _profile.landAreaAcres = acres.toDouble();
    final crops = (user['activeCrops'] as List?)?.cast<String>();
    if (crops != null) _profile.activeCrops = crops;
    final coins = user['agriCoins'];
    if (coins is num) _profile.agriCoins = coins.toInt();
    final score = user['kisanCreditScore'];
    if (score is num) _profile.kisanCreditScore = score.toInt();
    final level = user['krishiRatnaLevel'];
    if (level is num) _profile.krishiRatnaLevel = level.toInt();
    final streak = user['streakDays'];
    if (streak is num) _profile.streakDays = streak.toInt();
    final kcc = user['kccLimit'];
    if (kcc is num) _profile.kccLimit = kcc.toInt();
    final boundary = (user['farmBoundaryPoints'] as List?)
        ?.map((e) => (e as Map).cast<String, dynamic>())
        .map((e) => {
              'lat': (e['lat'] as num?)?.toDouble() ?? 0.0,
              'lng': (e['lng'] as num?)?.toDouble() ?? 0.0,
            })
        .toList();
    if (boundary != null) _profile.farmBoundaryPoints = boundary;
    final userLang = (user['preferredLanguage'] ?? user['language']) as String?;
    if (userLang != null && userLang.isNotEmpty) {
      if (!isNewUser || _language == 'en') {
        _language = userLang;
      }
    }
    _persist();
    notifyListeners();
    unawaited(loadVetProfile());
  }

  Future<void> updateCurrentUser(Map<String, dynamic> fields) async {
    final user = await _userApi.updateMe(fields);
    applyAuthUser(user);
  }

  Future<void> refreshCurrentUser() async {
    final user = await _userApi.getMe();
    applyAuthUser(user);
  }
  bool get isFarmer => _activeProfile == UserProfileType.farmer;

  // Splash Step Controller (Change 2)
  void setSplashStep(String step) {
    _splashStep = step;
    notifyListeners();
  }

  void advanceFromSplash() {
    _onboardingStep = 'language';
    notifyListeners();
  }

  // Yantra Time-Slot Booking (Change 10)
  // Kisan Mitra Chatbot Messages (Gemini-Powered + Offline Fallback)
  Future<void> sendChatbotMessage(String query) async {
    _chatbotMessages.add(KisanMitraMessage(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      sender: 'user',
      text: query,
      timestamp: DateTime.now(),
    ));
    notifyListeners();

    try {
      final res = await _chatbotApi.sendMessage(
        text: query,
        language: _language,
        context: {
          'farmerName': _profile.name,
          'district': _profile.district,
          'village': _profile.village,
          'activeCrops': _profile.activeCrops,
        },
      );
      final replyText = res['text'] as String? ?? '';
      final quickReplies = (res['quickReplies'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          const <String>[];
      final richCardType = res['richCardType'] as String?;
      final richCardData = (res['richCardData'] as Map?)?.cast<String, dynamic>();

      _chatbotMessages.add(KisanMitraMessage(
        id: res['id']?.toString() ??
            DateTime.now().millisecondsSinceEpoch.toString(),
        sender: 'bot',
        text: replyText.isEmpty ? tr('chatbot.offlineNotice') : replyText,
        timestamp: DateTime.now(),
        richCardType: richCardType,
        richCardData: richCardData,
        quickReplies: quickReplies,
      ));
      notifyListeners();
    } catch (_) {
      // Never fabricate an answer: surface an explicit offline/error notice.
      _chatbotMessages.add(KisanMitraMessage(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        sender: 'bot',
        text: tr('chatbot.offlineNotice'),
        timestamp: DateTime.now(),
      ));
      notifyListeners();
    }
  }

  void updateProfileArea(double acres) {
    _profile.landAreaAcres = acres;
    notifyListeners();
  }



  String _authMode = 'login'; // 'login' | 'register'
  String get authMode => _authMode;

  void setAuthMode(String mode) {
    _authMode = mode;
    notifyListeners();
  }

  void selectLanguageAndProceed(String lang) {
    _language = lang;
    _onboardingStep = 'profileSelect';
    _persist();
    _syncLanguageToBackend(lang);
    final langName = AppTranslations.languageNames[lang] ?? lang;
    if (lang == 'mr') {
      showToast("भाषा निवडली: $langName");
    } else if (lang == 'hi') {
      showToast("भाषा चुनी गई: $langName");
    } else {
      showToast("Language selected: $langName");
    }
    notifyListeners();
  }

  void selectProfileDuringRegistration(UserProfileType type) {
    _activeProfile = type;
    if (!_linkedProfiles.contains(type)) {
      _linkedProfiles.add(type);
    }
    _onboardingStep = 'register';
    _persist();
    final label = activeProfileMeta.label(_language);
    if (_language == 'mr') {
      showToast("प्रोफाइल निवडली: $label");
    } else if (_language == 'hi') {
      showToast("प्रोफाइल चुनी गई: $label");
    } else {
      showToast("Profile selected: $label");
    }
    notifyListeners();
  }

  void selectMultipleProfilesDuringRegistration({
    required UserProfileType primary,
    required List<UserProfileType> selectedProfiles,
  }) {
    _activeProfile = primary;
    _linkedProfiles.clear();
    for (final p in selectedProfiles) {
      if (!_linkedProfiles.contains(p)) {
        _linkedProfiles.add(p);
      }
    }
    if (!_linkedProfiles.contains(primary)) {
      _linkedProfiles.insert(0, primary);
    }
    _onboardingStep = 'register';
    _persist();
    final count = _linkedProfiles.length;
    final names = _linkedProfiles.map((p) => UserProfileRegistry.meta(p).label(_language)).join(", ");
    if (_language == 'mr') {
      showToast("✨ $count प्रोफाइल निवडल्या ($names)!");
    } else if (_language == 'hi') {
      showToast("✨ $count प्रोफाइल चुनी गईं ($names)!");
    } else {
      showToast("✨ $count profiles selected ($names)!");
    }
    notifyListeners();
  }

  void toggleLinkedProfile(UserProfileType type) {
    if (_linkedProfiles.contains(type)) {
      if (_linkedProfiles.length <= 1) {
        showToast(tr('atLeastOneProfile'));
        return;
      }
      _linkedProfiles.remove(type);
      if (_activeProfile == type) {
        _activeProfile = _linkedProfiles.first;
        _currentRoute = ProfileRoutes.defaultRouteFor(_activeProfile);
      }
      _persist();
      showToast("${UserProfileRegistry.meta(type).label(_language)} प्रोफाइल हटाई गई");
    } else {
      _linkedProfiles.add(type);
      _persist();
      showToast("✨ नई प्रोफाइल जुड़ी: ${UserProfileRegistry.meta(type).label(_language)}");
    }
    notifyListeners();
  }

  void switchProfile(UserProfileType type) {
    if (_activeProfile == type) return;
    _activeProfile = type;
    _currentRoute = ProfileRoutes.defaultRouteFor(type);
    _persist();
    showToast("प्रोफाइल बदली: ${activeProfileMeta.label(_language)}");
    notifyListeners();
  }

  // API-backed profile switching; ApiException propagates to the caller.
  Future<void> activateProfileApi(UserProfileType type) async {
    if (_isOffline) {
      switchProfile(type);
      return;
    }
    try {
      final res = await _userApi.activateProfile(type.name);
      final user = (res['user'] as Map?)?.cast<String, dynamic>();
      if (user != null) applyAuthUser(user);
      final route = res['defaultHomeRoute'] as String?;
      _navigationHistory.clear();
      _currentRoute =
          route != null && ProfileRoutes.canAccess(_activeProfile, route)
              ? route
              : ProfileRoutes.defaultRouteFor(_activeProfile);
      _persist();
      showToast("प्रोफाइल बदली गई");
      notifyListeners();
    } on ApiException catch (e) {
      if (e.code == 'NETWORK_ERROR') {
        switchProfile(type);
        return;
      }
      rethrow;
    }
  }

  Future<void> linkProfileApi(UserProfileType type) async {
    final user = await _userApi.linkProfile(type.name);
    applyAuthUser(user);
    showToast("✨ नई प्रोफाइल जुड़ी: ${UserProfileRegistry.meta(type).labelHi}");
  }

  Future<void> unlinkProfileApi(UserProfileType type) async {
    final user = await _userApi.unlinkProfile(type.name);
    applyAuthUser(user);
    if (!_linkedProfiles.contains(_activeProfile)) {
      _activeProfile = _linkedProfiles.first;
      _currentRoute = ProfileRoutes.defaultRouteFor(_activeProfile);
      notifyListeners();
    }
    showToast("प्रोफाइल हटाई गई");
  }

  void linkNewProfile(UserProfileType type) {
    if (!_linkedProfiles.contains(type)) {
      _linkedProfiles.add(type);
      _persist();
      showToast("नई प्रोफाइल जोड़ी गई: ${UserProfileRegistry.meta(type).labelHi}");
      notifyListeners();
    }
  }

  void unlinkProfile(UserProfileType type) {
    if (_linkedProfiles.length <= 1) {
      showToast("कम से कम एक प्रोफाइल आवश्यक है");
      return;
    }
    _linkedProfiles.remove(type);
    if (_activeProfile == type) {
      _activeProfile = _linkedProfiles.first;
      _currentRoute = ProfileRoutes.defaultRouteFor(_activeProfile);
    }
    _persist();
    showToast("प्रोफाइल हटाई गई");
    notifyListeners();
  }

  void setUserMpin(String mpin) {
    _userMpin = mpin;
    _persist();
    notifyListeners();
  }

  Future<void> resetMpinWithOtp({
    required String idToken,
    required String newMpin,
  }) async {
    await _authApi.mpinReset(idToken, newMpin);
    _userMpin = newMpin;
    _persist();
    showToast("🎉 MPIN सफलतापूर्वक बदला गया! नए MPIN से लॉगिन करें।");
    notifyListeners();
  }

  // The farmer persona is the platform default: whenever it is linked, a new
  // session starts on the farmer dashboard. Other personas stay one tap away
  // via the profile switcher.
  Future<void> _applyDefaultLanding() async {
    if (_linkedProfiles.contains(UserProfileType.farmer) &&
        _activeProfile != UserProfileType.farmer) {
      _activeProfile = UserProfileType.farmer;
      try {
        await _userApi.activateProfile('farmer');
      } catch (e) {
        debugPrint("Default farmer activation failed: $e");
      }
    }
    _currentRoute = ProfileRoutes.defaultRouteFor(_activeProfile);
  }

  // MPIN login after Firebase phone sign-in; false = backend rejected the MPIN.
  Future<bool> loginWithMobileAndMpin(String phone, String mpin) async {
    try {
      await _authApi.mpinVerify(mpin);
    } on ApiException {
      return false;
    }
    // Hydrate the account from the backend so linked/active profiles (and the
    // rest of the user doc) are correct even on a fresh device/browser where
    // only defaults were persisted locally.
    try {
      await refreshCurrentUser();
    } catch (e) {
      debugPrint("Profile hydrate after MPIN login failed: $e");
    }
    _isOnboarded = true;
    _onboardingStep = 'dashboard';
    await _applyDefaultLanding();
    _persist();
    showToast("सुरक्षित MPIN लॉगिन सफल! स्वागत है ${_profile.name}।");
    notifyListeners();
    return true;
  }

  // Firebase phone sign-in produces the idToken; returns true for new users.
  Future<bool> loginWithPhone(String idToken) async {
    final res = await _authApi.firebaseVerify(idToken);
    final isNewUser = res['isNewUser'] == true;
    applyAuthUser(
      (res['user'] as Map?)?.cast<String, dynamic>() ?? {},
      isNewUser: isNewUser,
    );
    return isNewUser;
  }

  // Direct phone + MPIN login for returning users — no OTP. The backend
  // /auth/login endpoint verifies the MPIN and returns the token pair.
  // Throws ApiException; callers branch on code: USER_NOT_FOUND (route to
  // OTP registration), MPIN_NOT_SET (route to OTP then set MPIN),
  // WRONG_MPIN (show the pad error).
  Future<void> loginWithPhoneMpin(String phone, String mpin) async {
    final res = await _authApi.loginWithPhoneMpin(phone, mpin);
    applyAuthUser((res['user'] as Map?)?.cast<String, dynamic>() ?? {});
    _userMpin = mpin;
    _isOnboarded = true;
    _onboardingStep = 'dashboard';
    await _applyDefaultLanding();
    _persist();
    showToast("सुरक्षित MPIN लॉगिन सफल! स्वागत है ${_profile.name}।");
    notifyListeners();
  }

  // OTP-verified session (tokens already issued via firebaseVerify) where the
  // account never had an MPIN: store it, then complete onboarding.
  Future<void> setMpinForCurrentSession(String mpin) async {
    await _authApi.mpinSet(mpin);
    _userMpin = mpin;
    _isOnboarded = true;
    _onboardingStep = 'dashboard';
    await _applyDefaultLanding();
    _persist();
    showToast("MPIN सेट हो गया! स्वागत है ${_profile.name}।");
    notifyListeners();
  }

  void loginWithMpin(String phone, String mpin) {
    loginWithMobileAndMpin(phone, mpin);
  }

  void loginWithBiometrics() {
    _isOnboarded = true;
    _onboardingStep = 'dashboard';
    _applyDefaultLanding();
    _persist();
    showToast("⚡ बायोमेट्रिक प्रमाणीकरण सफल! स्वागत है ${_profile.name}।");
    notifyListeners();
  }

  Future<Map<String, dynamic>> completeRegistration({
    required String idToken,
    required String name,
    required String phone,
    required String village,
    required String tehsil,
    required String district,
    required String state,
    required double landAreaAcres,
    required String soilType,
    required String irrigationType,
    required List<String> crops,
    required String mpin,
    String? referralCode,
    Map<String, Map<String, dynamic>>? roleProfiles,
  }) async {
    final res = await _authApi.register(
      idToken: idToken,
      name: name,
      phone: phone,
      state: state,
      district: district,
      tehsil: tehsil,
      village: village,
      landAreaAcres: landAreaAcres,
      soilType: soilType,
      irrigationType: irrigationType,
      crops: crops,
      mpin: mpin,
      profiles: linkedProfiles.map((t) => t.name).toList(),
      primaryProfile: activeProfile.name,
      referralCode: referralCode,
      roleProfiles: roleProfiles,
      language: _language,
      preferredLanguage: _language,
    );
    applyAuthUser((res['user'] as Map?)?.cast<String, dynamic>() ?? {});
    _userMpin = mpin;
    _onboardingStep = 'map';
    _persist();
    showToast("पंजीकरण सफल! सुरक्षित MPIN सेट हुआ। अब खेत का नक्शा मार्क करें।");
    notifyListeners();
    return res;
  }

  Future<void> confirmFarmMap(List<Map<String, double>> points, double acres) async {
    final user = await _userApi.saveFarmBoundary(points, acres, null);
    applyAuthUser(user);
    _profile.farmBoundaryPoints = points;
    _profile.landAreaAcres = acres;
    _isOnboarded = true;
    _onboardingStep = 'dashboard';
    await _applyDefaultLanding();
    _persist();
    showToast("🌾 खेत का नक्शा दर्ज हुआ ($acres एकड़)! AGROVERCITY में स्वागत है!");
    notifyListeners();
  }

  final List<String> _navigationHistory = [];

  Map<String, dynamic>? _selectedTrip;
  Map<String, dynamic>? _selectedVehicle;
  Map<String, dynamic>? _selectedEquipment;
  LandLease? _selectedLease;
  LandListing? _selectedListing;
  int _cropInsuranceInitialTab = 0;
  String? _selectedDemandId;
  String? _selectedPurchaseId;
  String? _selectedLoanId;
  Map<String, dynamic>? get selectedTrip => _selectedTrip;
  Map<String, dynamic>? get selectedVehicle => _selectedVehicle;
  Map<String, dynamic>? get selectedEquipment => _selectedEquipment;
  LandLease? get selectedLease => _selectedLease;
  LandListing? get selectedListing => _selectedListing;
  int get cropInsuranceInitialTab => _cropInsuranceInitialTab;
  String? get selectedDemandId => _selectedDemandId;
  String? get selectedPurchaseId => _selectedPurchaseId;
  String? get selectedLoanId => _selectedLoanId;

  void openLoanDetail(String loanId) {
    _selectedLoanId = loanId;
    navigateTo('loanDetail');
  }

  void openLoanReview(String loanId) {
    _selectedLoanId = loanId;
    navigateTo('loanReview');
  }

  void openDemandDetail(String demandId) {
    _selectedDemandId = demandId;
    navigateTo('demandDetail');
  }

  void openPurchaseDetail(String purchaseId) {
    _selectedPurchaseId = purchaseId;
    navigateTo('purchaseDetail');
  }

  // Claim push/notification deep-link lands on the tracker tab (Day 11 B3).
  void openClaimTracker() {
    _cropInsuranceInitialTab = 3;
    navigateTo('cropInsurance');
  }

  void setSyncQueueCount(int count) {
    _syncQueueCount = count;
    notifyListeners();
  }

  void openTripDetail(Map<String, dynamic> booking) {
    _selectedTrip = booking;
    navigateTo('tripDetail');
  }

  void openLiveTracking(Map<String, dynamic> booking) {
    _selectedTrip = booking;
    navigateTo('liveTracking');
  }

  void openBilty(Map<String, dynamic> booking) {
    _selectedTrip = booking;
    navigateTo('biltyView');
  }

  void openLoadBoard() {
    navigateTo('loadBoard');
  }

  void openTransporterProfile() {
    navigateTo('transporterProfile');
  }

  void openRentTracking(LandLease lease) {
    _selectedLease = lease;
    navigateTo('landlordRent');
  }

  void openLeaseRequests(LandListing listing) {
    _selectedListing = listing;
    navigateTo('leaseRequests');
  }

  void openVehicleCalendar(Map<String, dynamic> vehicle) {
    _selectedVehicle = vehicle;
    navigateTo('vehicleCalendar');
  }

  void openSlotCalendarManage(Map<String, dynamic> machine) {
    _selectedEquipment = machine;
    navigateTo('slotCalendarManage');
  }

  bool get canGoBack => _navigationHistory.isNotEmpty || _currentRoute != ProfileRoutes.defaultRouteFor(_activeProfile);

  void navigateTo(String route) {
    if (!ProfileRoutes.canAccess(_activeProfile, route)) {
      showToast("यह मॉड्यूल इस प्रोफाइल में उपलब्ध नहीं है");
      return;
    }
    if (_currentRoute != route) {
      _navigationHistory.add(_currentRoute);
      _currentRoute = route;
      notifyListeners();
    }
  }

  void navigateBack() {
    if (_navigationHistory.isNotEmpty) {
      _currentRoute = _navigationHistory.removeLast();
    } else {
      _currentRoute = ProfileRoutes.defaultRouteFor(_activeProfile);
    }
    notifyListeners();
  }

  void logout() {
    SessionStore().clear();
    _isOnboarded = false;
    _isVet = false;
    _onboardingStep = 'register';
    _currentRoute = 'home';
    _navigationHistory.clear();
    _persist();
    showToast("सफलतापूर्वक लॉग आउट हुआ (Logged Out)");
    notifyListeners();
  }

  void restartOnboarding() {
    _isOnboarded = false;
    _onboardingStep = 'splash';
    _navigationHistory.clear();
    _persist();
    notifyListeners();
  }

  Future<void> loadPersistedState() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedMpin = prefs.getString('userMpin');
      if (savedMpin != null && savedMpin.isNotEmpty) {
        _userMpin = savedMpin;
      }
      final linkedList = prefs.getStringList('linkedProfiles');
      if (linkedList != null && linkedList.isNotEmpty) {
        _linkedProfiles.clear();
        for (final idxStr in linkedList) {
          final idx = int.tryParse(idxStr);
          if (idx != null && idx >= 0 && idx < UserProfileType.values.length) {
            final type = UserProfileType.values[idx];
            if (!_linkedProfiles.contains(type)) {
              _linkedProfiles.add(type);
            }
          }
        }
        if (_linkedProfiles.isEmpty) {
          _linkedProfiles.add(UserProfileType.farmer);
        }
      }
      final profileIndex = prefs.getInt('activeProfile');
      if (profileIndex != null && profileIndex >= 0 && profileIndex < UserProfileType.values.length) {
        _activeProfile = UserProfileType.values[profileIndex];
        if (!_linkedProfiles.contains(_activeProfile)) {
          _linkedProfiles.add(_activeProfile);
        }
      }
      final onboarded = prefs.getBool('isOnboarded');
      if (onboarded != null) {
        _isOnboarded = onboarded;
        if (_isOnboarded) {
          _onboardingStep = 'dashboard';
          _currentRoute = ProfileRoutes.defaultRouteFor(_activeProfile);
        }
      }
      final lang = prefs.getString('language') ??
          prefs.getString('preferred_language') ??
          prefs.getString('app_language');
      if (lang != null && lang.isNotEmpty) {
        _language = lang;
      } else {
        _language = 'en';
      }
      notifyListeners();
    } catch (e) {
      debugPrint("SharedPreferences load error: $e");
    }
  }

  Future<void> _syncLanguageToBackend(String lang) async {
    try {
      // Not signed in yet (e.g. picking a language during onboarding):
      // the language is sent with the registration payload instead, so
      // skip the authenticated settings call.
      if (await SessionStore().accessToken == null) return;
      await _userApi.updateSettings({
        'language': lang,
        'preferredLanguage': lang,
        'womenMode': _isWomenMode,
        'highContrast': _isHighContrast,
        'darkMode': _isDarkMode,
      });
    } catch (e) {
      debugPrint("Sync language to backend: $e");
    }
  }

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('userMpin', _userMpin);
      await prefs.setInt('activeProfile', _activeProfile.index);
      await prefs.setStringList(
        'linkedProfiles',
        _linkedProfiles.map((p) => p.index.toString()).toList(),
      );
      await prefs.setBool('isOnboarded', _isOnboarded);
      await prefs.setString('language', _language);
      await prefs.setString('preferred_language', _language);
      await prefs.setString('app_language', _language);
    } catch (e) {
      debugPrint("SharedPreferences save error: $e");
    }
  }

  void toggleOffline() {
    _isOffline = !_isOffline;
    if (_isOffline) {
      showToast("ऑफलाइन मोड सक्रिय। स्थानीय कैश सुरक्षित है।");
    } else {
      showToast("ऑनलाइन सिंक पूर्ण! सभी डेटा अपडेटेड हैं।");
      _syncQueueCount = 0;
    }
    notifyListeners();
  }

  void toggleWomenMode() {
    _isWomenMode = !_isWomenMode;
    if (_isWomenMode) {
      _currentRoute = 'womenFarmer';
      showToast("🌸 महिला किसान प्रगति केंद्र सक्रिय!");
    } else {
      _currentRoute = 'home';
    }
    notifyListeners();
  }

  void toggleHighContrast() {
    _isHighContrast = !_isHighContrast;
    notifyListeners();
  }

  void toggleDarkMode() {
    _isDarkMode = !_isDarkMode;
    notifyListeners();
  }

  void setLanguage(String lang) {
    _language = lang;
    _persist();
    _syncLanguageToBackend(lang);
    final langName = AppTranslations.languageNames[lang] ?? lang;
    if (lang == 'mr') {
      showToast("भाषा बदलली: $langName");
    } else if (lang == 'hi') {
      showToast("भाषा बदली: $langName");
    } else {
      showToast("Language changed: $langName");
    }
    notifyListeners();
  }

  Future<void> refreshCart() async {
    final res = await _marketplaceApi.getCart();
    _cartItems = (res['data'] as List).cast<Map<String, dynamic>>();
    _cartTotal = (res['cartTotal'] as num).round();
    notifyListeners();
  }

  Future<void> addToCartApi(String productId, {int quantity = 1}) async {
    await _marketplaceApi.addToCart(productId, quantity);
    await refreshCart();
    showToast("थैले में जोड़ा गया!");
  }

  Future<void> removeFromCartApi(String productId) async {
    await _marketplaceApi.removeCartItem(productId);
    await refreshCart();
    showToast("सामग्री थैले से हटाई गई");
  }

  Timer? _toastTimer;

  void clearToast() {
    _toastTimer?.cancel();
    _toastTimer = null;
    if (_toastMessage != null) {
      _toastMessage = null;
      notifyListeners();
    }
  }

  void showToast(String message) {
    _toastMessage = message;
    notifyListeners();
    _toastTimer?.cancel();
    _toastTimer = Timer(const Duration(seconds: 4), () {
      _toastMessage = null;
      _toastTimer = null;
      notifyListeners();
    });
  }

  @override
  void dispose() {
    _toastTimer?.cancel();
    _toastTimer = null;
    super.dispose();
  }
}
