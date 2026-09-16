// Kisan Setu — Mobile+OTP Verification, 2x MPIN Setup, Forgot MPIN & Mobile+MPIN Login Suite

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../state/app_state.dart';
import '../../data/translations.dart';
import '../../components/common/motion_animations.dart';

class AuthView extends StatefulWidget {
  final AppState state;
  final String initialMode; // 'login' | 'register'

  const AuthView({
    super.key,
    required this.state,
    this.initialMode = 'login',
  });

  @override
  State<AuthView> createState() => _AuthViewState();
}

class _AuthViewState extends State<AuthView> with TickerProviderStateMixin {
  late String _authMode; // 'login' | 'register'

  // ==========================================
  // LOGIN CONTROLLERS & STATES
  // ==========================================
  final _loginPhoneController = TextEditingController(text: "9823456789");
  final _loginMpinController = TextEditingController(text: "1234");
  bool _isLoginMpinVisible = false;

  // ==========================================
  // REGISTRATION CONTROLLERS & STATES
  // ==========================================
  int _registerStep = 1; // 1: Mobile & OTP, 2: Set MPIN x2, 3: Farm Land & Crops
  final _regNameController = TextEditingController(text: "Ram Singh");
  final _regPhoneController = TextEditingController(text: "9823456789");
  final _regVillageController = TextEditingController(text: "Pimpalgaon Baswant");
  final _regTehsilController = TextEditingController(text: "Niphad");
  final _regStateController = TextEditingController(text: "Maharashtra");
  final _regAadhaarController = TextEditingController(text: "XXXX-XXXX-4589");

  // Registration OTP
  final _regOtpController = TextEditingController();
  bool _isRegOtpSent = false;
  int _regOtpCountdown = 30;
  Timer? _regOtpTimer;

  // Registration MPIN (2 times)
  final _regMpinController = TextEditingController();
  final _regConfirmMpinController = TextEditingController();
  bool _isRegMpinVisible = false;

  // Registration Farm & Crops
  double _regAcres = 3.5;
  String _selectedSoilType = "काली मिट्टी (Black Cotton)";
  String _selectedIrrigation = "ड्रिप सिंचाई (Drip)";
  final List<String> _selectedCrops = ["Tomato (टमाटर)", "Wheat (गेहूं)", "Onion (प्याज)"];
  final _customCropController = TextEditingController();
  bool _isAddingCustomCrop = false;
  final List<String> _customAddedCrops = [];

  final List<String> _availableSoilTypes = [
    "काली मिट्टी (Black Cotton)",
    "लाल मिट्टी (Red Loamy)",
    "रेतीली मिट्टी (Sandy Loam)",
    "जलोढ़ मिट्टी (Alluvial)",
  ];

  final List<String> _availableIrrigation = [
    "ड्रिप सिंचाई (Drip)",
    "स्प्रिंकलर (Sprinkler)",
    "नहर (Canal)",
    "बोरवेल (Borewell)",
    "वर्षा आधारित (Rainfed)",
  ];

  final List<String> _availableCrops = [
    "Tomato (टमाटर)",
    "Wheat (गेहूं)",
    "Onion (प्याज)",
    "Grapes (अंगूर)",
    "Cotton (कपास)",
    "Soybean (सोयाबीन)",
    "Sugarcane (गन्ना)",
    "Pomegranate (अनार)",
    "Maize (मक्का)",
  ];

  final List<String> _specialtyCropSuggestions = [
    "Dragon Fruit (ड्रैगन फ्रूट)",
    "Strawberry (स्ट्रॉबेरी)",
    "Ginger (अदरक)",
    "Garlic (लहसुन)",
    "Turmeric (हल्दी)",
    "Green Chili (हरी मिर्च)",
    "Marigold (गेंदा फूल)",
    "Papaya (पपीता)",
    "Mustard (सरसों)",
    "Bajra (बाजरा)",
  ];

  @override
  void initState() {
    super.initState();
    _authMode = widget.initialMode;
  }

  @override
  void dispose() {
    _regOtpTimer?.cancel();
    _loginPhoneController.dispose();
    _loginMpinController.dispose();
    _regNameController.dispose();
    _regPhoneController.dispose();
    _regOtpController.dispose();
    _regMpinController.dispose();
    _regConfirmMpinController.dispose();
    _regVillageController.dispose();
    _regTehsilController.dispose();
    _regStateController.dispose();
    _regAadhaarController.dispose();
    _customCropController.dispose();
    super.dispose();
  }

  // ==========================================
  // LOGIN ACTIONS
  // ==========================================
  void _handleLoginSubmit() {
    final phone = _loginPhoneController.text.trim();
    final mpin = _loginMpinController.text.trim();

    if (phone.length < 10) {
      widget.state.showToast("कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें");
      return;
    }
    if (mpin.length < 4) {
      widget.state.showToast("कृपया 4-अंकीय MPIN दर्ज करें");
      return;
    }

    widget.state.loginWithMobileAndMpin(phone, mpin);
  }

  // ==========================================
  // REGISTRATION ACTIONS
  // ==========================================
  void _sendRegOtp() {
    final phone = _regPhoneController.text.trim();
    if (phone.length < 10) {
      widget.state.showToast("कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें");
      return;
    }

    setState(() {
      _isRegOtpSent = true;
      _regOtpCountdown = 30;
    });

    _regOtpTimer?.cancel();
    _regOtpTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_regOtpCountdown > 0) {
        setState(() => _regOtpCountdown--);
      } else {
        timer.cancel();
      }
    });

    widget.state.showToast("📲 OTP भेजा गया: +91 $phone (डेमो कोड: 1234)");
  }

  void _autofillRegOtp() {
    setState(() {
      _regOtpController.text = "1234";
    });
    widget.state.showToast("⚡ ऑटोफिल: OTP 1234 दर्ज हुआ!");
  }

  void _verifyRegOtp() {
    if (_regOtpController.text.trim() != "1234" && _regOtpController.text.trim().length < 4) {
      widget.state.showToast("❌ अमान्य OTP! कृपया सही OTP (1234) दर्ज करें।");
      return;
    }

    setState(() {
      _registerStep = 2; // Move to MPIN Setup step
    });

    widget.state.showToast("✅ मोबाइल नंबर सत्यापित हुआ! अब 4-अंकीय MPIN सेट करें।");
  }

  void _handleMpinSetupContinue() {
    final mpin = _regMpinController.text.trim();
    final confirmMpin = _regConfirmMpinController.text.trim();

    if (mpin.length != 4) {
      widget.state.showToast("कृपया 4 अंकों का MPIN दर्ज करें");
      return;
    }
    if (confirmMpin.length != 4) {
      widget.state.showToast("कृपया पुष्टि के लिए दोबारा 4 अंकों का MPIN दर्ज करें");
      return;
    }
    if (mpin != confirmMpin) {
      widget.state.showToast("❌ दोनों MPIN मेल नहीं खा रहे हैं। कृपया दोबारा जांचें।");
      return;
    }

    setState(() {
      _registerStep = 3; // Move to Farm Details step
    });

    widget.state.showToast("🔒 सुरक्षित MPIN दर्ज हुआ! अब खेत का विवरण भरें।");
  }

  void _handleRegisterFinalSubmit() {
    if (_regNameController.text.trim().isEmpty) {
      widget.state.showToast("कृपया किसान का पूरा नाम दर्ज करें");
      return;
    }

    widget.state.completeRegistration(
      name: _regNameController.text.trim(),
      phone: "+91 ${_regPhoneController.text.trim()}",
      village: _regVillageController.text.trim(),
      tehsil: _regTehsilController.text.trim(),
      state: _regStateController.text.trim(),
      acres: _regAcres,
      soilType: _selectedSoilType,
      irrigationType: _selectedIrrigation,
      crops: _selectedCrops,
      mpin: _regMpinController.text.trim().isNotEmpty ? _regMpinController.text.trim() : "1234",
    );
  }

  void _addCustomCrop(String cropName) {
    final trimmed = cropName.trim();
    if (trimmed.isEmpty) {
      widget.state.showToast("कृपया फसल का नाम दर्ज करें");
      return;
    }

    if (!_availableCrops.contains(trimmed) && !_customAddedCrops.contains(trimmed)) {
      setState(() {
        _customAddedCrops.add(trimmed);
        if (!_selectedCrops.contains(trimmed)) {
          _selectedCrops.add(trimmed);
        }
        _customCropController.clear();
        _isAddingCustomCrop = false;
      });
      widget.state.showToast("🌾 '$trimmed' फसल सफलतापूर्वक जोड़ी गई!");
    } else {
      if (!_selectedCrops.contains(trimmed)) {
        setState(() {
          _selectedCrops.add(trimmed);
          _customCropController.clear();
          _isAddingCustomCrop = false;
        });
        widget.state.showToast("🌾 '$trimmed' सूची में चुनी गई!");
      } else {
        widget.state.showToast("यह फसल पहले से चुनी गई है");
      }
    }
  }

  void _removeCustomCrop(String cropName) {
    setState(() {
      _customAddedCrops.remove(cropName);
      _selectedCrops.remove(cropName);
    });
    widget.state.showToast("फसल '$cropName' हटाई गई");
  }

  // ==========================================
  // FORGOT MPIN MODAL FLOW
  // ==========================================
  void _openForgotMpinSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ForgotMpinModalSheet(
        state: widget.state,
        initialPhone: _loginPhoneController.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isWomen = widget.state.isWomenMode;
    final isContrast = widget.state.isHighContrast;
    final primaryColor = isWomen
        ? const Color(0xFFBE123C)
        : (isContrast ? const Color(0xFF1B5E20) : const Color(0xFF2E7D32));
    final accentGold = isWomen ? const Color(0xFFFBBF24) : const Color(0xFF43A047);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          children: [
            // 1. Top Header & Customization Controls Bar
            _buildTopCustomizationBar(primaryColor),

            // 2. Animated Segmented Switcher (Login <-> Register)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
              child: _buildSegmentedSwitcher(primaryColor, accentGold),
            ),

            // 3. Scrollable Main Content (Login or Register Wizard)
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 350),
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeInCubic,
                transitionBuilder: (child, animation) {
                  final slide = Tween<Offset>(
                    begin: _authMode == 'login' ? const Offset(-0.06, 0.0) : const Offset(0.06, 0.0),
                    end: Offset.zero,
                  ).animate(animation);
                  return FadeTransition(
                    opacity: animation,
                    child: SlideTransition(position: slide, child: child),
                  );
                },
                child: KeyedSubtree(
                  key: ValueKey<String>(_authMode),
                  child: _authMode == 'login'
                      ? _buildLoginView(primaryColor, accentGold)
                      : _buildRegisterWizardView(primaryColor, accentGold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ==========================================
  // 1. TOP HEADER & CUSTOMIZATION BAR
  // ==========================================
  Widget _buildTopCustomizationBar(Color primaryColor) {
    final isWomen = widget.state.isWomenMode;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          // Glowing Brand Emblem & App Title
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                padding: const EdgeInsets.all(2.5),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isWomen ? const Color(0xFFF472B6) : const Color(0xFF81C784),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: primaryColor.withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(9),
                  child: Image.asset(
                    'assets/app_icon.png',
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) => Icon(
                      isWomen ? Icons.spa_rounded : Icons.eco_rounded,
                      size: 20,
                      color: primaryColor,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    widget.state.tr('appName'),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: isWomen ? const Color(0xFFBE123C) : const Color(0xFF112A1F),
                      letterSpacing: 0.2,
                    ),
                  ),
                  Text(
                    isWomen ? "🌸 महिला किसान शक्ति" : "कृषि डिजिटल सेतु",
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: isWomen ? const Color(0xFFBE123C) : const Color(0xFF43A047),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const Spacer(),

          // AI Bot Icon & Controls
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 🌐 Language Dropdown
              PopupMenuButton<String>(
                initialValue: widget.state.language,
                tooltip: "भाषा बदलें (Select Language)",
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                onSelected: (lang) => widget.state.setLanguage(lang),
                itemBuilder: (ctx) => AppTranslations.languageNames.entries.map((e) {
                  return PopupMenuItem(
                    value: e.key,
                    child: Row(
                      children: [
                        if (widget.state.language == e.key)
                          const Icon(Icons.check_circle_rounded, color: Color(0xFF43A047), size: 16)
                        else
                          const SizedBox(width: 16),
                        const SizedBox(width: 8),
                        Text(e.value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                      ],
                    ),
                  );
                }).toList(),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.grey.shade300),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.g_translate_rounded, size: 14, color: Color(0xFF2E7D32)),
                      const SizedBox(width: 4),
                      Text(
                        widget.state.language.toUpperCase(),
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF2E7D32)),
                      ),
                      const Icon(Icons.arrow_drop_down_rounded, size: 16, color: Color(0xFF2E7D32)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 6),

              // 🌸 Women Farmer Mode Toggle
              BouncyPressable(
                onTap: () => widget.state.toggleWomenMode(),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: isWomen ? const Color(0xFFBE123C) : Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: isWomen ? const Color(0xFFF43F5E) : Colors.grey.shade300),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6),
                    ],
                  ),
                  child: Icon(
                    Icons.female_rounded,
                    size: 16,
                    color: isWomen ? Colors.white : const Color(0xFFE11D48),
                  ),
                ),
              ),
              const SizedBox(width: 6),

              // 🤖 Kisan Mitra AI Bot Icon with Pop-up
              BouncyPressable(
                onTap: () {
                  showDialog(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                      title: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF2E7D32).withValues(alpha: 0.12),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.smart_toy_rounded, color: Color(0xFF2E7D32), size: 24),
                          ),
                          const SizedBox(width: 10),
                          const Text("किसान मित्र AI", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                        ],
                      ),
                      content: const Text(
                        "नमस्ते! मैं किसान मित्र AI हूँ। लॉगिन या पंजीकरण में किसी भी सहायता के लिए मैं हमेशा उपलब्ध हूँ।",
                        style: TextStyle(fontSize: 13, color: Color(0xFF334155), height: 1.4),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text("ठीक है (Got It)", style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF2E7D32))),
                        ),
                      ],
                    ),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2E7D32),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF2E7D32).withValues(alpha: 0.35),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.smart_toy_rounded, size: 16, color: Colors.white),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ==========================================
  // 2. SEGMENTED SWITCHER (LOGIN / REGISTER)
  // ==========================================
  Widget _buildSegmentedSwitcher(Color primaryColor, Color accentGold) {
    final isLogin = _authMode == 'login';
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: Colors.grey.shade200, width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          // Login Pill
          Expanded(
            child: BouncyPressable(
              onTap: () => setState(() => _authMode = 'login'),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  gradient: isLogin
                      ? LinearGradient(
                          colors: [primaryColor, accentGold],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : null,
                  borderRadius: BorderRadius.circular(26),
                  boxShadow: isLogin
                      ? [
                          BoxShadow(
                            color: primaryColor.withValues(alpha: 0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.lock_person_rounded, size: 15, color: isLogin ? Colors.white : Colors.grey.shade700),
                    const SizedBox(width: 6),
                    Text(
                      "लॉगिन (Login)",
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w900,
                        color: isLogin ? Colors.white : Colors.grey.shade800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Register Pill
          Expanded(
            child: BouncyPressable(
              onTap: () => setState(() => _authMode = 'register'),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  gradient: !isLogin
                      ? LinearGradient(
                          colors: [primaryColor, accentGold],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : null,
                  borderRadius: BorderRadius.circular(26),
                  boxShadow: !isLogin
                      ? [
                          BoxShadow(
                            color: primaryColor.withValues(alpha: 0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.person_add_alt_1_rounded, size: 15, color: !isLogin ? Colors.white : Colors.grey.shade700),
                    const SizedBox(width: 6),
                    Text(
                      "नया पंजीकरण (Register)",
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w900,
                        color: !isLogin ? Colors.white : Colors.grey.shade800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ==========================================
  // 3. LOGIN VIEW (MOBILE NUMBER + 4-DIGIT MPIN)
  // ==========================================
  Widget _buildLoginView(Color primaryColor, Color accentGold) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Quick Demo Farmers Bar
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.grey.shade200),
              boxShadow: [
                BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8, offset: const Offset(0, 2)),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.flash_on_rounded, size: 15, color: Color(0xFFF59E0B)),
                    const SizedBox(width: 5),
                    Text(
                      "1-टैप त्वरित डेमो लॉगिन (Quick Demo):",
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Colors.grey.shade800),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: BouncyPressable(
                        onTap: () {
                          setState(() {
                            _loginPhoneController.text = "9823456789";
                            _loginMpinController.text = "1234";
                          });
                          widget.state.quickLoginDemo('ram');
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE8F5E9),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFA5D6A7)),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text("🌾", style: TextStyle(fontSize: 13)),
                              SizedBox(width: 4),
                              Flexible(
                                child: Text(
                                  "राम सिंह (1234)",
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF1B5E20)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: BouncyPressable(
                        onTap: () {
                          setState(() {
                            _loginPhoneController.text = "9423198765";
                            _loginMpinController.text = "1234";
                          });
                          widget.state.quickLoginDemo('sunita');
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF1F2),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFFECDD3)),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text("🌸", style: TextStyle(fontSize: 13)),
                              SizedBox(width: 4),
                              Flexible(
                                child: Text(
                                  "सुनीता बाई (1234)",
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF9F1239)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Main Login Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.grey.shade200, width: 1.2),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 18,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title Header
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: primaryColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(Icons.shield_outlined, color: primaryColor, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "किसान सुरक्षित लॉगिन",
                          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                        ),
                        Text(
                          "मोबाइल नंबर और 4-अंकीय MPIN दर्ज करें",
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                // 1. Mobile Number Field
                const Text(
                  "मोबाइल नंबर (Mobile Number) *",
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF334155)),
                ),
                const SizedBox(height: 6),
                _buildMobileInputField(_loginPhoneController, primaryColor),
                const SizedBox(height: 14),

                // 2. 4-Digit MPIN Field
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      "4-अंकीय सुरक्षा MPIN (Security PIN) *",
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF334155)),
                    ),
                    BouncyPressable(
                      onTap: _openForgotMpinSheet,
                      child: Text(
                        "MPIN भूल गए?",
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                          color: primaryColor,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                _buildMpinInputField(
                  controller: _loginMpinController,
                  primaryColor: primaryColor,
                  isVisible: _isLoginMpinVisible,
                  onToggleVisibility: () => setState(() => _isLoginMpinVisible = !_isLoginMpinVisible),
                  hintText: "4-अंकीय MPIN दर्ज करें (e.g. 1234)",
                ),
                const SizedBox(height: 20),

                // Login CTA Button
                BouncyPressable(
                  onTap: _handleLoginSubmit,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [primaryColor, accentGold],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: primaryColor.withValues(alpha: 0.35),
                          blurRadius: 14,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.login_rounded, color: Colors.white, size: 18),
                        SizedBox(width: 8),
                        Text(
                          "सुरक्षित लॉगिन करें (Secure Login) ➔",
                          style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w900, letterSpacing: 0.2),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Register Switcher Footer
          Center(
            child: BouncyPressable(
              onTap: () => setState(() => _authMode = 'register'),
              child: Padding(
                padding: const EdgeInsets.all(8.0),
                child: RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
                    children: [
                      const TextSpan(text: "नया खाता बनाना है? "),
                      TextSpan(
                        text: "नया किसान पंजीकरण करें ➔",
                        style: TextStyle(fontWeight: FontWeight.w900, color: primaryColor),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ==========================================
  // 4. REGISTRATION WIZARD VIEW
  // ==========================================
  Widget _buildRegisterWizardView(Color primaryColor, Color accentGold) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Step Progress Bar
          _buildRegisterProgressBar(primaryColor),
          const SizedBox(height: 14),

          // Wizard Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.grey.shade200, width: 1.2),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 18,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: _registerStep == 1
                ? _buildRegStep1IdentityAndOtp(primaryColor, accentGold)
                : (_registerStep == 2
                    ? _buildRegStep2MpinSetup(primaryColor, accentGold)
                    : _buildRegStep3FarmDetails(primaryColor, accentGold)),
          ),
          const SizedBox(height: 16),

          // Login Switcher Footer
          Center(
            child: BouncyPressable(
              onTap: () => setState(() => _authMode = 'login'),
              child: Padding(
                padding: const EdgeInsets.all(8.0),
                child: RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
                    children: [
                      const TextSpan(text: "पहले से खाता है? "),
                      TextSpan(
                        text: "सीधा लॉगिन करें ➔",
                        style: TextStyle(fontWeight: FontWeight.w900, color: primaryColor),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Step Indicator
  Widget _buildRegisterProgressBar(Color primaryColor) {
    final titles = ["1. मोबाइल व OTP", "2. MPIN सुरक्षा", "3. खेत व फसल"];

    return Row(
      children: List.generate(3, (index) {
        final stepNum = index + 1;
        final isDone = _registerStep > stepNum;
        final isCurrent = _registerStep == stepNum;

        return Expanded(
          child: Container(
            margin: EdgeInsets.only(right: index < 2 ? 6 : 0),
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
            decoration: BoxDecoration(
              color: isCurrent
                  ? primaryColor.withValues(alpha: 0.12)
                  : (isDone ? const Color(0xFFE8F5E9) : Colors.white),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isCurrent
                    ? primaryColor
                    : (isDone ? const Color(0xFF43A047) : Colors.grey.shade300),
                width: isCurrent ? 1.8 : 1.0,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  isDone ? Icons.check_circle_rounded : (isCurrent ? Icons.radio_button_checked_rounded : Icons.circle_outlined),
                  size: 13,
                  color: isCurrent ? primaryColor : (isDone ? const Color(0xFF2E7D32) : Colors.grey),
                ),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    titles[index],
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: isCurrent ? FontWeight.w900 : FontWeight.w700,
                      color: isCurrent ? primaryColor : (isDone ? const Color(0xFF1B5E20) : Colors.grey.shade600),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }

  // ==========================================
  // REG STEP 1: MOBILE & OTP VERIFICATION
  // ==========================================
  Widget _buildRegStep1IdentityAndOtp(Color primaryColor, Color accentGold) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: primaryColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(Icons.phonelink_ring_rounded, color: primaryColor, size: 20),
            ),
            const SizedBox(width: 10),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "मोबाइल नंबर सत्यापन (OTP)",
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                ),
                Text(
                  "कृपया अपना नाम और मोबाइल नंबर दर्ज करें",
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Full Name Field
        const Text("किसान का पूरा नाम (Full Name) *", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        _buildStandardInputField(
          controller: _regNameController,
          hintText: "उदा. राम सिंह पाटिल",
          icon: Icons.person_outline_rounded,
          primaryColor: primaryColor,
        ),
        const SizedBox(height: 14),

        // State Dropdown
        const Text("राज्य (State) *", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _regStateController.text,
              isExpanded: true,
              items: ["Maharashtra", "Madhya Pradesh", "Gujarat", "Uttar Pradesh", "Punjab", "Rajasthan"]
                  .map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))))
                  .toList(),
              onChanged: (v) {
                if (v != null) setState(() => _regStateController.text = v);
              },
            ),
          ),
        ),
        const SizedBox(height: 14),

        // Mobile Number Field with +91 Badge
        const Text("मोबाइल नंबर (Mobile Number) *", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        _buildMobileInputField(_regPhoneController, primaryColor),
        const SizedBox(height: 14),

        // OTP Section
        if (_isRegOtpSent) ...[
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF86EFAC)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      "4-अंकीय OTP दर्ज करें:",
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF166534)),
                    ),
                    if (_regOtpCountdown > 0)
                      Text(
                        "पुनः भेजें ($_regOtpCountdown s)",
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF166534)),
                      )
                    else
                      BouncyPressable(
                        onTap: _sendRegOtp,
                        child: const Text(
                          "OTP दोबारा भेजें",
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF15803D), decoration: TextDecoration.underline),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),

                // OTP Input Field + 1-Tap Autofill
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFF22C55E), width: 1.5),
                        ),
                        child: TextField(
                          controller: _regOtpController,
                          keyboardType: TextInputType.number,
                          inputFormatters: [LengthLimitingTextInputFormatter(4), FilteringTextInputFormatter.digitsOnly],
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: 8),
                          decoration: const InputDecoration(
                            hintText: "• • • •",
                            border: InputBorder.none,
                            hintStyle: TextStyle(letterSpacing: 8, color: Colors.grey),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    BouncyPressable(
                      onTap: _autofillRegOtp,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFF86EFAC)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.bolt_rounded, size: 15, color: Color(0xFF15803D)),
                            SizedBox(width: 3),
                            Text("1234", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF15803D))),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        // CTA: Send OTP or Verify OTP
        BouncyPressable(
          onTap: _isRegOtpSent ? _verifyRegOtp : _sendRegOtp,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [primaryColor, accentGold],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(color: primaryColor.withValues(alpha: 0.35), blurRadius: 12, offset: const Offset(0, 4)),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(_isRegOtpSent ? Icons.check_circle_rounded : Icons.sms_rounded, color: Colors.white, size: 18),
                const SizedBox(width: 8),
                Text(
                  _isRegOtpSent ? "OTP सत्यापित करें और आगे बढ़ें ➔" : "OTP भेजें (Send OTP) ➔",
                  style: const TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w900),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ==========================================
  // REG STEP 2: SET MPIN (ENTER 2 TIMES)
  // ==========================================
  Widget _buildRegStep2MpinSetup(Color primaryColor, Color accentGold) {
    final mpin = _regMpinController.text;
    final confirm = _regConfirmMpinController.text;
    final isMatching = mpin.isNotEmpty && mpin == confirm;
    final isMismatch = mpin.isNotEmpty && confirm.isNotEmpty && mpin != confirm;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: primaryColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(Icons.password_rounded, color: primaryColor, size: 20),
            ),
            const SizedBox(width: 10),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "सुरक्षित 4-अंकीय MPIN सेट करें",
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                ),
                Text(
                  "लॉगिन के लिए अपना 4-अंकीय गुप्त पिन बनाएं",
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 16),

        // 1. Enter MPIN
        const Text("4-अंकीय नया MPIN बनाएं (Create MPIN) *", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        _buildMpinInputField(
          controller: _regMpinController,
          primaryColor: primaryColor,
          isVisible: _isRegMpinVisible,
          onToggleVisibility: () => setState(() => _isRegMpinVisible = !_isRegMpinVisible),
          hintText: "4-अंकीय MPIN दर्ज करें (e.g. 1234)",
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 14),

        // 2. Confirm MPIN
        const Text("MPIN दोबारा दर्ज करें (Confirm MPIN) *", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        _buildMpinInputField(
          controller: _regConfirmMpinController,
          primaryColor: primaryColor,
          isVisible: _isRegMpinVisible,
          onToggleVisibility: () => setState(() => _isRegMpinVisible = !_isRegMpinVisible),
          hintText: "वही MPIN दोबारा दर्ज करें",
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 10),

        // Real-time Match Feedback Indicator
        if (isMatching)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF86EFAC)),
            ),
            child: const Row(
              children: [
                Icon(Icons.check_circle_rounded, size: 14, color: Color(0xFF16A34A)),
                SizedBox(width: 6),
                Text("✓ दोनों MPIN मेल खाते हैं!", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF15803D))),
              ],
            ),
          )
        else if (isMismatch)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFFECDD3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.cancel_rounded, size: 14, color: Color(0xFFDC2626)),
                SizedBox(width: 6),
                Text("✕ दोनों MPIN समान होने चाहिए!", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFFB91C1C))),
              ],
            ),
          ),
        const SizedBox(height: 18),

        // CTA: Save MPIN and Continue
        BouncyPressable(
          onTap: _handleMpinSetupContinue,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [primaryColor, accentGold],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(color: primaryColor.withValues(alpha: 0.35), blurRadius: 12, offset: const Offset(0, 4)),
              ],
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.lock_outline_rounded, color: Colors.white, size: 18),
                SizedBox(width: 8),
                Text(
                  "MPIN सहेजें और आगे बढ़ें ➔",
                  style: TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w900),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ==========================================
  // REG STEP 3: FARM LAND & CROPS
  // ==========================================
  Widget _buildRegStep3FarmDetails(Color primaryColor, Color accentGold) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: primaryColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(Icons.landscape_rounded, color: primaryColor, size: 20),
            ),
            const SizedBox(width: 10),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "खेत व फसल का विवरण",
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                ),
                Text(
                  "भूमि का आकार और उगाई जाने वाली फसलें चुनें",
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Village & Tehsil Fields
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("गाँव (Village) *", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  _buildStandardInputField(controller: _regVillageController, hintText: "गाँव", icon: Icons.home_work_outlined, primaryColor: primaryColor),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("तहसील (Tehsil)", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  _buildStandardInputField(controller: _regTehsilController, hintText: "तहसील", icon: Icons.location_city_rounded, primaryColor: primaryColor),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // Land Area (Acres) Slider
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text("खेत का क्षेत्रफल (Land Area):", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: primaryColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                "${_regAcres.toStringAsFixed(1)} एकड़ (Acres)",
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: primaryColor),
              ),
            ),
          ],
        ),
        Slider(
          value: _regAcres,
          min: 0.5,
          max: 25.0,
          divisions: 49,
          activeColor: primaryColor,
          inactiveColor: primaryColor.withValues(alpha: 0.15),
          onChanged: (v) => setState(() => _regAcres = v),
        ),
        const SizedBox(height: 10),

        // Soil Type
        const Text("मिट्टी का प्रकार (Soil Type):", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: _availableSoilTypes.map((soil) {
            final isSelected = _selectedSoilType == soil;
            return ChoiceChip(
              label: Text(soil, style: TextStyle(fontSize: 11, fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600, color: isSelected ? Colors.white : Colors.black87)),
              selected: isSelected,
              selectedColor: primaryColor,
              backgroundColor: const Color(0xFFF1F5F9),
              onSelected: (val) {
                if (val) setState(() => _selectedSoilType = soil);
              },
            );
          }).toList(),
        ),
        const SizedBox(height: 14),

        // Irrigation Type
        const Text("सिंचाई का प्रकार (Irrigation):", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: _availableIrrigation.map((irri) {
            final isSelected = _selectedIrrigation == irri;
            return ChoiceChip(
              label: Text(irri, style: TextStyle(fontSize: 11, fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600, color: isSelected ? Colors.white : Colors.black87)),
              selected: isSelected,
              selectedColor: primaryColor,
              backgroundColor: const Color(0xFFF1F5F9),
              onSelected: (val) {
                if (val) setState(() => _selectedIrrigation = irri);
              },
            );
          }).toList(),
        ),
        const SizedBox(height: 14),

        // Crops Multi-Select + Custom Crop Adder
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text("फसलें (Crops):", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            BouncyPressable(
              onTap: () => setState(() => _isAddingCustomCrop = !_isAddingCustomCrop),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFCD34D)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.add_circle_outline_rounded, size: 12, color: Color(0xFFB45309)),
                    SizedBox(width: 3),
                    Text("अन्य फसल जोड़ें +", style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: Color(0xFFB45309))),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),

        // Custom Crop Input Box
        if (_isAddingCustomCrop) ...[
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFFDE68A)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _customCropController,
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                        decoration: const InputDecoration(
                          hintText: "अपनी फसल का नाम लिखें...",
                          border: InputBorder.none,
                        ),
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () => _addCustomCrop(_customCropController.text),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD97706),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        elevation: 0,
                      ),
                      child: const Text("जोड़ें +", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _specialtyCropSuggestions.map((s) {
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ActionChip(
                          label: Text(s, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
                          backgroundColor: Colors.white,
                          onPressed: () => _addCustomCrop(s),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],

        // Available Crop Chips
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            ..._availableCrops.map((crop) {
              final isSelected = _selectedCrops.contains(crop);
              return FilterChip(
                label: Text(crop, style: TextStyle(fontSize: 11, fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600, color: isSelected ? Colors.white : Colors.black87)),
                selected: isSelected,
                selectedColor: primaryColor,
                backgroundColor: const Color(0xFFF1F5F9),
                onSelected: (val) {
                  setState(() {
                    if (val) {
                      _selectedCrops.add(crop);
                    } else {
                      _selectedCrops.remove(crop);
                    }
                  });
                },
              );
            }),
            ..._customAddedCrops.map((crop) {
              return Chip(
                label: Text("🌾 $crop", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white)),
                backgroundColor: const Color(0xFFD97706),
                deleteIcon: const Icon(Icons.close_rounded, size: 12, color: Colors.white),
                onDeleted: () => _removeCustomCrop(crop),
              );
            }),
          ],
        ),
        const SizedBox(height: 20),

        // Complete Registration CTA
        BouncyPressable(
          onTap: _handleRegisterFinalSubmit,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [primaryColor, accentGold],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(color: primaryColor.withValues(alpha: 0.35), blurRadius: 14, offset: const Offset(0, 4)),
              ],
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_circle_outline_rounded, color: Colors.white, size: 18),
                SizedBox(width: 8),
                Text(
                  "पंजीकरण पूर्ण करें (Complete) ➔",
                  style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w900, letterSpacing: 0.2),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ==========================================
  // SHARED INPUT FIELD BUILDERS
  // ==========================================
  Widget _buildMobileInputField(TextEditingController controller, Color primaryColor) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade300, width: 1.2),
      ),
      child: Row(
        children: [
          // +91 Country Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: const BorderRadius.horizontal(left: Radius.circular(15)),
              border: Border(right: BorderSide(color: Colors.grey.shade300)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text("🇮🇳", style: TextStyle(fontSize: 16)),
                SizedBox(width: 5),
                Text("+91", style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
              ],
            ),
          ),
          const SizedBox(width: 10),

          // Number Input
          Expanded(
            child: TextField(
              controller: controller,
              keyboardType: TextInputType.phone,
              inputFormatters: [LengthLimitingTextInputFormatter(10), FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
              decoration: const InputDecoration(
                hintText: "10-अंकीय मोबाइल नंबर",
                hintStyle: TextStyle(fontSize: 13, color: Colors.grey),
                border: InputBorder.none,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMpinInputField({
    required TextEditingController controller,
    required Color primaryColor,
    required bool isVisible,
    required VoidCallback onToggleVisibility,
    required String hintText,
    ValueChanged<String>? onChanged,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade300, width: 1.2),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: const BorderRadius.horizontal(left: Radius.circular(15)),
              border: Border(right: BorderSide(color: Colors.grey.shade300)),
            ),
            child: Icon(Icons.pin_rounded, size: 18, color: primaryColor),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: controller,
              obscureText: !isVisible,
              keyboardType: TextInputType.number,
              inputFormatters: [LengthLimitingTextInputFormatter(4), FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 4),
              onChanged: onChanged,
              decoration: InputDecoration(
                hintText: hintText,
                hintStyle: const TextStyle(fontSize: 12.5, color: Colors.grey, letterSpacing: 0),
                border: InputBorder.none,
              ),
            ),
          ),
          IconButton(
            icon: Icon(isVisible ? Icons.visibility_off_rounded : Icons.visibility_rounded, size: 18, color: Colors.grey),
            onPressed: onToggleVisibility,
          ),
        ],
      ),
    );
  }

  Widget _buildStandardInputField({
    required TextEditingController controller,
    required String hintText,
    required IconData icon,
    required Color primaryColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade300, width: 1.2),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: primaryColor),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: controller,
              style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
              decoration: InputDecoration(
                hintText: hintText,
                hintStyle: const TextStyle(fontSize: 12.5, color: Colors.grey),
                border: InputBorder.none,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ==========================================
// 5. FORGOT MPIN BOTTOM MODAL SHEET
// ==========================================
class _ForgotMpinModalSheet extends StatefulWidget {
  final AppState state;
  final String initialPhone;

  const _ForgotMpinModalSheet({required this.state, required this.initialPhone});

  @override
  State<_ForgotMpinModalSheet> createState() => _ForgotMpinModalSheetState();
}

class _ForgotMpinModalSheetState extends State<_ForgotMpinModalSheet> {
  int _step = 1; // 1: Mobile & OTP, 2: Enter New MPIN x2
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _newMpinController = TextEditingController();
  final _confirmMpinController = TextEditingController();

  bool _isOtpSent = false;
  int _otpCountdown = 30;
  Timer? _countdownTimer;
  bool _isMpinVisible = false;

  @override
  void initState() {
    super.initState();
    _phoneController.text = widget.initialPhone.isNotEmpty ? widget.initialPhone : "9823456789";
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _phoneController.dispose();
    _otpController.dispose();
    _newMpinController.dispose();
    _confirmMpinController.dispose();
    super.dispose();
  }

  void _sendOtp() {
    if (_phoneController.text.trim().length < 10) {
      widget.state.showToast("कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें");
      return;
    }
    setState(() {
      _isOtpSent = true;
      _otpCountdown = 30;
    });

    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_otpCountdown > 0) {
        setState(() => _otpCountdown--);
      } else {
        timer.cancel();
      }
    });

    widget.state.showToast("📲 OTP भेजा गया: +91 ${_phoneController.text} (डेमो कोड: 1234)");
  }

  void _verifyOtpAndProceed() {
    if (_otpController.text.trim() != "1234" && _otpController.text.trim().length < 4) {
      widget.state.showToast("❌ अमान्य OTP! कृपया सही OTP (1234) दर्ज करें।");
      return;
    }

    setState(() {
      _step = 2; // Move to Set New MPIN step
    });

    widget.state.showToast("✅ OTP सत्यापित! अब नया 4-अंकीय MPIN सेट करें।");
  }

  void _submitNewMpin() {
    final mpin = _newMpinController.text.trim();
    final confirm = _confirmMpinController.text.trim();

    if (mpin.length != 4) {
      widget.state.showToast("कृपया 4 अंकों का नया MPIN दर्ज करें");
      return;
    }
    if (confirm.length != 4) {
      widget.state.showToast("कृपया पुष्टि के लिए दोबारा 4 अंकों का MPIN दर्ज करें");
      return;
    }
    if (mpin != confirm) {
      widget.state.showToast("❌ दोनों MPIN मेल नहीं खा रहे हैं");
      return;
    }

    widget.state.resetMpinWithOtp(
      phone: _phoneController.text.trim(),
      otp: _otpController.text.trim(),
      newMpin: mpin,
    );

    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF2E7D32);

    return Container(
      padding: EdgeInsets.only(
        top: 18,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 44,
              height: 4.5,
              decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(7),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.lock_reset_rounded, color: Color(0xFFB45309), size: 20),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    "MPIN रीसेट करें (Reset MPIN)",
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                  ),
                ],
              ),
              IconButton(icon: const Icon(Icons.close_rounded, size: 20), onPressed: () => Navigator.pop(context)),
            ],
          ),
          const SizedBox(height: 14),

          if (_step == 1) ...[
            // STEP 1: Mobile + OTP
            const Text("पंजीकृत मोबाइल नंबर *", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: const BorderRadius.horizontal(left: Radius.circular(15)),
                      border: Border(right: BorderSide(color: Colors.grey.shade300)),
                    ),
                    child: const Text("🇮🇳 +91", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                      decoration: const InputDecoration(hintText: "10-अंकीय मोबाइल नंबर", border: InputBorder.none),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            if (_isOtpSent) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF86EFAC)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text("OTP दर्ज करें:", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF166534))),
                        BouncyPressable(
                          onTap: () => setState(() => _otpController.text = "1234"),
                          child: const Text("ऑटोफिल 1234", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF15803D), decoration: TextDecoration.underline)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _otpController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 6),
                      decoration: const InputDecoration(hintText: "1234", border: InputBorder.none),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
            ],

            BouncyPressable(
              onTap: _isOtpSent ? _verifyOtpAndProceed : _sendOtp,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 13),
                decoration: BoxDecoration(
                  color: primaryColor,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Center(
                  child: Text(
                    _isOtpSent ? "OTP सत्यापित करें ➔" : "OTP भेजें (Send OTP)",
                    style: const TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w900),
                  ),
                ),
              ),
            ),
          ] else ...[
            // STEP 2: Set New MPIN x2
            const Text("नया 4-अंकीय MPIN दर्ज करें *", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: TextField(
                controller: _newMpinController,
                obscureText: !_isMpinVisible,
                keyboardType: TextInputType.number,
                inputFormatters: [LengthLimitingTextInputFormatter(4), FilteringTextInputFormatter.digitsOnly],
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 4),
                decoration: InputDecoration(
                  hintText: "नया MPIN",
                  border: InputBorder.none,
                  suffixIcon: IconButton(
                    icon: Icon(_isMpinVisible ? Icons.visibility_off : Icons.visibility, size: 18),
                    onPressed: () => setState(() => _isMpinVisible = !_isMpinVisible),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),

            const Text("MPIN दोबारा दर्ज करें (पुष्टि करें) *", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: TextField(
                controller: _confirmMpinController,
                obscureText: !_isMpinVisible,
                keyboardType: TextInputType.number,
                inputFormatters: [LengthLimitingTextInputFormatter(4), FilteringTextInputFormatter.digitsOnly],
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 4),
                decoration: const InputDecoration(hintText: "MPIN पुष्टि करें", border: InputBorder.none),
              ),
            ),
            const SizedBox(height: 18),

            BouncyPressable(
              onTap: _submitNewMpin,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 13),
                decoration: BoxDecoration(
                  color: primaryColor,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Center(
                  child: Text(
                    "नया MPIN सहेजें (Save New MPIN) ➔",
                    style: TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w900),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
