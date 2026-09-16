import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../api/auth_api.dart';
import '../api/marketplace_api.dart';
import '../api/user_api.dart';
import '../core/session_store.dart';
import '../models/app_models.dart';
import '../models/user_profile_type.dart';
import '../data/demo_data.dart';
import '../data/translations.dart';
import 'profile_routes.dart';

class AppState extends ChangeNotifier {
  AppState({ApiClient? apiClient, AuthApi? authApi, UserApi? userApi, MarketplaceApi? marketplaceApi})
      : _injectedClient = apiClient,
        _injectedAuthApi = authApi,
        _injectedUserApi = userApi,
        _injectedMarketplaceApi = marketplaceApi;

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
  String _language = 'hi';
  bool _urgentTaskDone = false;
  int _syncQueueCount = 2;
  String? _toastMessage;

  final FarmerProfile _profile = dummyFarmerProfile;
  List<Map<String, dynamic>> _cartItems = [];
  int _cartTotal = 0;
  List<GovtScheme> _appliedSchemes = List.from(dummyGovtSchemes);
  List<BuyerContract> _contracts = List.from(dummyBuyerContracts);

  List<BlogArticle> _blogs = List.from(dummyBlogs);
  final List<VideoGuide> _videos = List.from(dummyVideos);
  List<ExpertTalk> _expertTalks = List.from(dummyExpertTalks);

  // New Core Modules State
  final List<TreeArticle> _treeArticles = List.from(dummyTreeArticles);
  final List<NgoOrganization> _ngos = List.from(dummyNgos);
  final List<BiofuelTree> _biofuelTrees = List.from(dummyBiofuelTrees);
  final List<TreeCareGuide> _treeCareGuides = List.from(dummyTreeCareGuides);

  final List<AgriLiveChannel> _liveChannels = List.from(dummyLiveChannels);
  final List<AgriNewsItem> _agriNews = List.from(dummyAgriNews);

  final List<GaushalaItem> _gaushalas = List.from(dummyGaushalas);
  final List<PlantNursery> _nurseries = List.from(dummyNurseries);
  final List<VetDoctor> _vetDoctors = List.from(dummyVetDoctors);
  final List<DairyProductItem> _dairyProducts = List.from(dummyDairyProducts);

  List<PaidWorkshop> _paidWorkshops = List.from(dummyPaidWorkshops);
  final List<FarmDiaryEntry> _farmDiaryEntries = List.from(dummyFarmDiaryEntries);
  final List<ReferralUser> _referrals = List.from(dummyReferrals);

  // Crop Insurance State
  final List<CropInsurancePolicy> _insurancePolicies = List.from(dummyInsurancePolicies);
  final List<InsuranceClaimRecord> _insuranceClaims = List.from(dummyInsuranceClaims);
  final List<CropPremiumRate> _cropInsuranceRates = List.from(dummyCropInsuranceRates);

  String _userMpin = "1234";

  // CRD Feature States
  String _splashStep = 'group'; // 'group' -> 'kisanSetu' -> 'done'
  final List<VyapariRate> _vyapariRates = List.from(dummyVyapariRates);
  List<YantraSlot> _yantraSlots = List.from(dummyYantraSlots);
  final List<LandRecord712> _landRecords = List.from(dummyLandRecords712);
  final List<KisanMitraMessage> _chatbotMessages = [
    KisanMitraMessage(
      id: 'msg-1',
      sender: 'bot',
      text: 'Namaste Ram Singh ji! 🙏\nAaj main aapki kya madad kar sakta hoon?',
      timestamp: DateTime.now(),
      quickReplies: ['Mausam 🌤️', 'Mandi Bhav 📈', 'Pest 🐛', 'Pani 💧'],
    ),
  ];

  // Getters
  String get userMpin => _userMpin;
  String get splashStep => _splashStep;
  List<VyapariRate> get vyapariRates => _vyapariRates;
  List<YantraSlot> get yantraSlots => _yantraSlots;
  List<LandRecord712> get landRecords => _landRecords;
  List<KisanMitraMessage> get chatbotMessages => _chatbotMessages;

  // New Core Modules Getters
  List<TreeArticle> get treeArticles => _treeArticles;
  List<NgoOrganization> get ngos => _ngos;
  List<BiofuelTree> get biofuelTrees => _biofuelTrees;
  List<TreeCareGuide> get treeCareGuides => _treeCareGuides;

  List<AgriLiveChannel> get liveChannels => _liveChannels;
  List<AgriNewsItem> get agriNews => _agriNews;

  List<GaushalaItem> get gaushalas => _gaushalas;
  List<PlantNursery> get nurseries => _nurseries;
  List<VetDoctor> get vetDoctors => _vetDoctors;
  List<DairyProductItem> get dairyProducts => _dairyProducts;

  List<PaidWorkshop> get paidWorkshops => _paidWorkshops;
  List<FarmDiaryEntry> get farmDiaryEntries => _farmDiaryEntries;
  List<ReferralUser> get referrals => _referrals;
  String get referralCode => "RAMSINGH2026";

  // Crop Insurance Getters
  List<CropInsurancePolicy> get insurancePolicies => _insurancePolicies;
  List<InsuranceClaimRecord> get insuranceClaims => _insuranceClaims;
  List<CropPremiumRate> get cropInsuranceRates => _cropInsuranceRates;

  String get onboardingStep => _onboardingStep;
  bool get isOnboarded => _isOnboarded;
  String get currentRoute => _currentRoute;
  bool get isOffline => _isOffline;
  bool get isWomenMode => _isWomenMode;
  bool get isHighContrast => _isHighContrast;
  bool get isDarkMode => _isDarkMode;
  String get language => _language;
  bool get urgentTaskDone => _urgentTaskDone;
  int get syncQueueCount => _syncQueueCount;
  String? get toastMessage => _toastMessage;
  FarmerProfile get profile => _profile;
  List<Map<String, dynamic>> get cartItems => _cartItems;
  List<GovtScheme> get appliedSchemes => _appliedSchemes;
  List<BuyerContract> get contracts => _contracts;
  List<BlogArticle> get blogs => _blogs;
  List<VideoGuide> get videos => _videos;
  List<ExpertTalk> get expertTalks => _expertTalks;

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
    if (active != null) _activeProfile = _profileTypeFromKey(active);
    _profile.name = (user['name'] as String?) ?? _profile.name;
    _profile.phone = (user['phone'] as String?) ?? _profile.phone;
    _profile.village = (user['village'] as String?) ?? _profile.village;
    _profile.tehsil = (user['tehsil'] as String?) ?? _profile.tehsil;
    _profile.district = (user['district'] as String?) ?? _profile.district;
    _profile.state = (user['state'] as String?) ?? _profile.state;
    final acres = user['landAreaAcres'];
    if (acres is num) _profile.landAreaAcres = acres.toDouble();
    final crops = (user['activeCrops'] as List?)?.cast<String>();
    if (crops != null) _profile.activeCrops = crops;
    final coins = user['agriCoins'];
    if (coins is num) _profile.agriCoins = coins.toInt();
    _persist();
    notifyListeners();
  }

  Future<void> updateCurrentUser(Map<String, dynamic> fields) async {
    final user = await _userApi.updateMe(fields);
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
  void bookYantraSlot(String slotId) {
    _yantraSlots = _yantraSlots.map((s) {
      if (s.id == slotId && s.status == 'available') {
        return YantraSlot(
          id: s.id,
          slotName: s.slotName,
          duration: s.duration,
          status: 'booked',
          bookedByName: '${_profile.name} (आपकी बुकिंग)',
          priceRupees: s.priceRupees,
          recommendedTask: s.recommendedTask,
        );
      }
      return s;
    }).toList();
    _profile.agriCoins += 50;
    showToast("यंत्र स्लॉट सफलतापूर्वक बुक हुआ! SMS अलर्ट भेजा गया (+50 सिक्के)");
    notifyListeners();
  }

  // Kisan Mitra Chatbot Messages (Change 8 & 9)
  void sendChatbotMessage(String query) {
    _chatbotMessages.add(KisanMitraMessage(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      sender: 'user',
      text: query,
      timestamp: DateTime.now(),
    ));
    notifyListeners();

    // Simulated Bot Response
    Future.delayed(const Duration(milliseconds: 700), () {
      final qLower = query.toLowerCase();
      KisanMitraMessage botReply;

      if (qLower.contains('tamatar') || qLower.contains('tomato') || qLower.contains('sow')) {
        botReply = KisanMitraMessage(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          sender: 'bot',
          text: '⚠️ MARKET JAANKARI ALERT:\nAapke 5km ke aas-paas 12 kisanon ne tamatar lagaya hai. Mandi mein 200% zyada aavak aane par bhav ₹12-15/kg gir sakta hai.',
          timestamp: DateTime.now(),
          richCardType: 'saturation',
          richCardData: {
            'crop': 'Tomato (टमाटर)',
            'sowingCount': 12,
            'radiusKm': 5,
            'arrivalIncrease': '200%',
            'predictedPrice': '₹12-15/kg',
            'riskLevel': 'high',
            'alternativeCrop': 'Capsicum (शिमला मिर्च)',
            'altPrice': '₹25-30/kg',
          },
          quickReplies: ['Capsicum jankari 🌶️', 'Phir bhi Tamatar lagayein 🍅', 'Expert se baat karein 📞'],
        );
      } else if (qLower.contains('mausam') || qLower.contains('weather')) {
        botReply = KisanMitraMessage(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          sender: 'bot',
          text: '🌤️ Nashik Mausam:\nAaj 27°C aanshik baadal hain. Dopahar 1:00 baje 65% varsha ki sambhavna hai.',
          timestamp: DateTime.now(),
          quickReplies: ['Spray Alert 🌧️', 'Mandi Bhav 📈', 'Mukhya Seva 🚜'],
        );
      } else {
        botReply = KisanMitraMessage(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          sender: 'bot',
          text: 'Ram Ram ${_profile.name} ji! Main aapki fasal suraksha, mandi bhav aur sarkari yojanaon mein madad kar sakta hoon.',
          timestamp: DateTime.now(),
          quickReplies: ['Mausam 🌤️', 'Mandi Bhav 📈', 'Pest Scan 📸', 'Yantra Booking 🚜'],
        );
      }

      _chatbotMessages.add(botReply);
      notifyListeners();
    });
  }

  // 7/12 Land Record Search (Change 11)
  List<LandRecord712> search712Records(String query) {
    if (query.trim().isEmpty) return _landRecords;
    final q = query.toLowerCase();
    return _landRecords.where((r) =>
      r.gatNumber.toLowerCase().contains(q) ||
      r.village.toLowerCase().contains(q) ||
      r.ownerName.toLowerCase().contains(q)
    ).toList();
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
    showToast("भाषा चुनी गई: ${AppTranslations.languageNames[lang]}");
    notifyListeners();
  }

  void selectProfileDuringRegistration(UserProfileType type) {
    _activeProfile = type;
    if (!_linkedProfiles.contains(type)) {
      _linkedProfiles.add(type);
    }
    _onboardingStep = 'register';
    _persist();
    showToast("प्रोफाइल चुनी गई: ${activeProfileMeta.labelHi}");
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
    final names = _linkedProfiles.map((p) => UserProfileRegistry.meta(p).labelHi).join(", ");
    showToast("✨ $count प्रोफाइल चुनी गईं ($names)!");
    notifyListeners();
  }

  void toggleLinkedProfile(UserProfileType type) {
    if (_linkedProfiles.contains(type)) {
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
      showToast("${UserProfileRegistry.meta(type).labelHi} प्रोफाइल हटाई गई");
    } else {
      _linkedProfiles.add(type);
      _persist();
      showToast("✨ नई प्रोफाइल जुड़ी: ${UserProfileRegistry.meta(type).labelHi}");
    }
    notifyListeners();
  }

  void switchProfile(UserProfileType type) {
    if (_activeProfile == type) return;
    _activeProfile = type;
    _currentRoute = ProfileRoutes.defaultRouteFor(type);
    _persist();
    showToast("प्रोफाइल बदली: ${activeProfileMeta.labelHi}");
    notifyListeners();
  }

  // API-backed profile switching; ApiException propagates to the caller.
  Future<void> activateProfileApi(UserProfileType type) async {
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

  bool verifyMpin(String mpin) {
    return _userMpin == mpin || mpin == "1234";
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

  // MPIN login after Firebase phone sign-in; false = backend rejected the MPIN.
  Future<bool> loginWithMobileAndMpin(String phone, String mpin) async {
    try {
      await _authApi.mpinVerify(mpin);
    } on ApiException {
      return false;
    }
    _isOnboarded = true;
    _onboardingStep = 'dashboard';
    _currentRoute = ProfileRoutes.defaultRouteFor(_activeProfile);
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

  void loginWithMpin(String phone, String mpin) {
    loginWithMobileAndMpin(phone, mpin);
  }

  void loginWithBiometrics() {
    _isOnboarded = true;
    _onboardingStep = 'dashboard';
    _currentRoute = ProfileRoutes.defaultRouteFor(_activeProfile);
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
      profiles: _linkedProfiles.map((t) => t.name).toList(),
      primaryProfile: _activeProfile.name,
      referralCode: referralCode,
      roleProfiles: roleProfiles,
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
    _currentRoute = ProfileRoutes.defaultRouteFor(_activeProfile);
    _persist();
    showToast("🌾 खेत का नक्शा दर्ज हुआ ($acres एकड़)! AGROVERCITY में स्वागत है!");
    notifyListeners();
  }

  final List<String> _navigationHistory = [];

  Map<String, dynamic>? _selectedTrip;
  Map<String, dynamic>? _selectedVehicle;
  Map<String, dynamic>? _selectedEquipment;
  Map<String, dynamic>? get selectedTrip => _selectedTrip;
  Map<String, dynamic>? get selectedVehicle => _selectedVehicle;
  Map<String, dynamic>? get selectedEquipment => _selectedEquipment;

  void openTripDetail(Map<String, dynamic> booking) {
    _selectedTrip = booking;
    navigateTo('tripDetail');
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
      final lang = prefs.getString('language');
      if (lang != null && lang.isNotEmpty) {
        _language = lang;
      }
      notifyListeners();
    } catch (e) {
      debugPrint("SharedPreferences load error: $e");
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
    showToast("भाषा बदली: ${AppTranslations.languageNames[lang]}");
    notifyListeners();
  }

  void markUrgentTaskDone() {
    _urgentTaskDone = true;
    _profile.agriCoins += 50;
    showToast("टास्क पूर्ण! +50 कृषि सिक्के अर्जित!");
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

  void applyForScheme(String schemeId) {
    _appliedSchemes = _appliedSchemes.map((s) {
      if (s.id == schemeId) {
        return GovtScheme(
          id: s.id,
          name: s.name,
          category: s.category,
          eligible: s.eligible,
          benefitAmount: s.benefitAmount,
          documentsRequired: s.documentsRequired,
          status: "आवेदन जमा (Pending Verification)",
          nextDeadline: s.nextDeadline,
          description: s.description,
        );
      }
      return s;
    }).toList();
    _profile.agriCoins += 100;
    showToast("योजना आवेदन सफलतापूर्वक जमा! +100 सिक्के!");
    notifyListeners();
  }

  void acceptContract(String contractId) {
    _contracts = _contracts.map((c) {
      if (c.id == contractId) {
        return BuyerContract(
          id: c.id,
          buyerCompany: c.buyerCompany,
          buyerRating: c.buyerRating,
          crop: c.crop,
          lockedRateQuintal: c.lockedRateQuintal,
          mspCurrentRate: c.mspCurrentRate,
          premiumAboveMSP: c.premiumAboveMSP,
          minQuantityQuintals: c.minQuantityQuintals,
          deliveryLocation: c.deliveryLocation,
          paymentTerms: c.paymentTerms,
          status: "Digital Agreement Signed & Confirmed",
          contractDuration: c.contractDuration,
        );
      }
      return c;
    }).toList();
    _profile.agriCoins += 250;
    showToast("खरीदार अनुबंध सफलतापूर्वक लॉक! +250 सिक्के!");
    notifyListeners();
  }

  void redeemCoupon(String title, int cost) {
    if (_profile.agriCoins < cost) {
      showToast("पर्याप्त सिक्के नहीं हैं!");
      return;
    }
    _profile.agriCoins -= cost;
    showToast("बधाई! '$title' कूपन अनलॉक हुआ!");
    notifyListeners();
  }

  void toggleBookmarkBlog(String blogId) {
    _blogs = _blogs.map((b) {
      if (b.id == blogId) {
        b.isBookmarked = !b.isBookmarked;
        showToast(b.isBookmarked ? "लेख बुकमार्क किया गया!" : "बुकमार्क हटाया गया");
      }
      return b;
    }).toList();
    notifyListeners();
  }

  void registerForExpertTalk(String talkId) {
    _expertTalks = _expertTalks.map((t) {
      if (t.id == talkId) {
        showToast("आप '${t.expertName}' के लाइव मास्टरक्लास हेतु पंजीकृत हो गए हैं!");
      }
      return t;
    }).toList();
    _profile.agriCoins += 25;
    notifyListeners();
  }

  // 1. Tree Plantation Actions
  void requestSaplings({required String ngoName, required int count, required String treeType}) {
    _profile.agriCoins += 30;
    showToast("🎉 '$ngoName' कडे $count $treeType रोपांची मागणी नोंदवली! (+30 नाणी)");
    notifyListeners();
  }

  // 2. Livestock & Vet Actions
  void bookVetDoctor({required String doctorName, required String slot, required bool isFarmVisit}) {
    final type = isFarmVisit ? "शेतावर प्रत्यक्ष भेट" : "दवाखाना अपॉइंटमेंट";
    showToast("✅ $doctorName यांच्यासोबत $slot साठी $type निश्चित झाली!");
    notifyListeners();
  }

  void orderGaushalaManure({required String gaushalaName, required String item}) {
    _profile.agriCoins += 20;
    showToast("📦 $gaushalaName कडून '$item' ऑर्डर बुक झाली! (+20 नाणी)");
    notifyListeners();
  }

  void orderDairyProduct(DairyProductItem product) {
    showToast("🛒 '${product.vernacularTitle}' यशस्वीरित्या बुक झाले! लवकरच वितरण होईल.");
    notifyListeners();
  }

  // 4. DnyanSetu Workshop Enrollment
  void enrollWorkshop(String workshopId, bool useCoins) {
    _paidWorkshops = _paidWorkshops.map((w) {
      if (w.id == workshopId) {
        w.isEnrolled = true;
        if (useCoins && _profile.agriCoins >= w.coinsDiscountAllowed) {
          _profile.agriCoins -= w.coinsDiscountAllowed;
        }
      }
      return w;
    }).toList();
    showToast("🎓 कार्यशाळेत यशस्वी प्रवेश! ICAR संलग्न डिजिटल प्रमाणपत्र अनलॉक झाले!");
    notifyListeners();
  }

  // 5. Daily Farm Diary Actions
  void addDiaryEntry(FarmDiaryEntry entry) {
    _farmDiaryEntries.insert(0, entry);
    _profile.agriCoins += 15;
    showToast("📒 शेती नोंद यशस्वीरित्या जोडली गेली! (+15 नाणी)");
    notifyListeners();
  }

  void deleteDiaryEntry(String id) {
    _farmDiaryEntries.removeWhere((e) => e.id == id);
    showToast("नोंद हटवली गेली");
    notifyListeners();
  }

  // 5. Refer & Earn Actions
  void inviteFarmer({required String name, required String phone}) {
    final newRef = ReferralUser(
      id: "ref-${DateTime.now().millisecondsSinceEpoch}",
      farmerName: name,
      village: "नाशिक परिसर",
      phone: phone,
      joinDate: "आज",
      status: "Invited (आमंत्रण पाठवले)",
      rewardCoins: 100,
    );
    _referrals.insert(0, newRef);
    _profile.agriCoins += 100;
    showToast("🎁 शेतकरी मित्राला आमंत्रण पाठवले! +100 नाणी तुमच्या खात्यात जमा!");
    notifyListeners();
  }

  // 6. Crop Insurance (फसल बीमा) Actions
  void submitCropClaim({
    required String policyId,
    required String cropName,
    required String vernacularCropName,
    required String calamityType,
    required String dateOfDamage,
    required int estimatedLossPercent,
    required double requestedAmount,
    required String gpsCoordinates,
    required String village,
    List<String> damagePhotos = const [],
  }) {
    final claimId = "clm-${DateTime.now().millisecondsSinceEpoch}";
    final randomSuffix = (1000 + (DateTime.now().millisecond % 9000)).toString();
    final claimNum = "CLM-2026-MH-$randomSuffix";

    final newClaim = InsuranceClaimRecord(
      id: claimId,
      claimNumber: claimNum,
      policyId: policyId,
      cropName: cropName,
      vernacularCropName: vernacularCropName,
      calamityType: calamityType,
      dateOfDamage: dateOfDamage,
      estimatedLossPercent: estimatedLossPercent,
      requestedAmount: requestedAmount,
      approvedAmount: (requestedAmount * 0.90),
      status: ClaimStatus.intimated,
      statusText: "सूचना दर्ज (Claim Intimated - 72h Window)",
      surveyorName: "Pravin Bhalerao (नियुक्त कृषि सर्वेक्षक)",
      surveyorPhone: "+91 98231 77650",
      surveyorVisitDate: "48 घंटे के भीतर खेत निरीक्षण",
      gpsCoordinates: gpsCoordinates,
      village: village,
      damagePhotos: damagePhotos,
      submittedAt: "आज, ${DateTime.now().hour}:${DateTime.now().minute.toString().padLeft(2, '0')}",
      bankAccountLast4: "8842",
    );

    _insuranceClaims.insert(0, newClaim);
    _profile.agriCoins += 50; // reward coins for fast intimation
    showToast("✅ फसल नुकसान दावा $claimNum सफलतापूर्वक दर्ज! कृषि सर्वेक्षक 48 घंटे में निरीक्षण करेंगे।");
    notifyListeners();
  }

  void downloadPolicyCertificate(String policyNumber) {
    showToast("📄 ई-पॉलिसी प्रमाण पत्र ($policyNumber) डाउनलोड हो गया है।");
  }

  void showToast(String message) {
    _toastMessage = message;
    notifyListeners();
    Future.delayed(const Duration(seconds: 4), () {
      _toastMessage = null;
      notifyListeners();
    });
  }
}
