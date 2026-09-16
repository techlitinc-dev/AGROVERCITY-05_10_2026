import 'package:flutter/material.dart';

import '../../components/onboarding/role_profile_form.dart';

class RegisterFormData {
  static const states = [
    'Maharashtra',
    'Madhya Pradesh',
    'Gujarat',
    'Uttar Pradesh',
    'Punjab',
    'Rajasthan',
  ];
  static const soilTypes = [
    'काली मिट्टी (Black Cotton)',
    'लाल मिट्टी (Red Loamy)',
    'रेतीली मिट्टी (Sandy Loam)',
    'जलोढ़ मिट्टी (Alluvial)',
  ];
  static const irrigationTypes = [
    'ड्रिप सिंचाई (Drip)',
    'स्प्रिंकलर (Sprinkler)',
    'नहर (Canal)',
    'बोरवेल (Borewell)',
    'वर्षा आधारित (Rainfed)',
  ];
  static const cropOptions = [
    'Tomato (टमाटर)',
    'Wheat (गेहूं)',
    'Onion (प्याज)',
    'Grapes (अंगूर)',
    'Soybean (सोयाबीन)',
    'Cotton (कपास)',
  ];

  final name = TextEditingController();
  final phone = TextEditingController();
  final otp = TextEditingController();
  final referralCode = TextEditingController();
  String stateName = 'Maharashtra';
  final village = TextEditingController(text: 'Pimpalgaon Baswant');
  final tehsil = TextEditingController(text: 'Niphad');
  final district = TextEditingController(text: 'Nashik');
  double landAcres = 3.5;
  String soilType = soilTypes.first;
  String irrigationType = irrigationTypes.first;
  List<String> crops = List.from(cropOptions.take(3));
  final mpin = TextEditingController();
  final mpinConfirm = TextEditingController();

  String? idToken;
  String? verificationId;
  bool otpSent = false;
  int otpCountdown = 0;
  String? referralError;
  String? submitError;
  final Map<String, RoleProfileFormData> roleProfiles = {};

  void dispose() {
    for (final c in [
      name, phone, otp, referralCode, village, tehsil, district, mpin,
      mpinConfirm,
    ]) {
      c.dispose();
    }
    for (final d in roleProfiles.values) {
      d.dispose();
    }
  }
}
