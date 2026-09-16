// Multi-Profile System — User Persona Enum & Metadata Registry

import 'package:flutter/material.dart';

enum UserProfileType {
  farmer,
  farmLandlord,
  transport,
  seller,
  equipmentRental,
  broker,
}

class UserProfileMeta {
  final UserProfileType type;
  final String labelEn;
  final String labelHi;
  final String taglineHi;
  final String descriptionHi;
  final IconData icon;
  final Color primaryColor;
  final Color accentColor;
  final String defaultHomeRoute;

  const UserProfileMeta({
    required this.type,
    required this.labelEn,
    required this.labelHi,
    required this.taglineHi,
    required this.descriptionHi,
    required this.icon,
    required this.primaryColor,
    required this.accentColor,
    required this.defaultHomeRoute,
  });
}

class UserProfileRegistry {
  static const Map<UserProfileType, UserProfileMeta> all = {
    UserProfileType.farmer: UserProfileMeta(
      type: UserProfileType.farmer,
      labelEn: "Farmer",
      labelHi: "किसान",
      taglineHi: "फसल प्रबंधन, मंडी भाव व सलाह",
      descriptionHi: "कृषक जो फसल उत्पादन, सिंचाई, मंडी बिक्री और सरकारी योजनाओं का लाभ लेते हैं।",
      icon: Icons.agriculture_rounded,
      primaryColor: Color(0xFF43A047),
      accentColor: Color(0xFF2E7D32),
      defaultHomeRoute: 'home',
    ),
    UserProfileType.farmLandlord: UserProfileMeta(
      type: UserProfileType.farmLandlord,
      labelEn: "Farm Landlord",
      labelHi: "खेत मालिक",
      taglineHi: "जमीन लीज, 7/12 रिकॉर्ड व किराया",
      descriptionHi: "भूमि स्वामी जो खेत लीज/किराए पर देते हैं, भू-अभिलेख और आय का प्रबंधन करते हैं।",
      icon: Icons.landscape_rounded,
      primaryColor: Color(0xFF8B5CF6),
      accentColor: Color(0xFF7C3AED),
      defaultHomeRoute: 'landlordHome',
    ),
    UserProfileType.transport: UserProfileMeta(
      type: UserProfileType.transport,
      labelEn: "Transporter",
      labelHi: "परिवहन",
      taglineHi: "वाहन बुकिंग, माल ढुलाई व ट्रिप",
      descriptionHi: "ट्रक/ट्रैक्टर वाहन मालिक जो कृषि उपज को खेत से मंडी तक सुरक्षित पहुंचाते हैं।",
      icon: Icons.local_shipping_rounded,
      primaryColor: Color(0xFF0284C7),
      accentColor: Color(0xFF0369A1),
      defaultHomeRoute: 'transportHome',
    ),
    UserProfileType.seller: UserProfileMeta(
      type: UserProfileType.seller,
      labelEn: "Seller / Vyapari",
      labelHi: "व्यापारी",
      taglineHi: "मंडी खरीद-बिक्री, स्टॉक व लेजर",
      descriptionHi: "मंडी आढ़ती व व्यापारी जो किसानों से उपज खरीदते हैं और थोक बिक्री करते हैं।",
      icon: Icons.storefront_rounded,
      primaryColor: Color(0xFFEA580C),
      accentColor: Color(0xFFC2410C),
      defaultHomeRoute: 'sellerHome',
    ),
    UserProfileType.equipmentRental: UserProfileMeta(
      type: UserProfileType.equipmentRental,
      labelEn: "Equipment Owner",
      labelHi: "यंत्र किराया",
      taglineHi: "ट्रैक्टर, हार्वेस्टर बुकिंग व आय",
      descriptionHi: "कृषि यंत्र स्वामी जो ट्रैक्टर, थ्रेशर, ड्रोन किराए पर देकर सेवा प्रदान करते हैं।",
      icon: Icons.construction_rounded,
      primaryColor: Color(0xFFF59E0B),
      accentColor: Color(0xFFD97706),
      defaultHomeRoute: 'equipmentOwnerHome',
    ),
    UserProfileType.broker: UserProfileMeta(
      type: UserProfileType.broker,
      labelEn: "Broker / Dalal",
      labelHi: "दलाल / मध्यस्थ",
      taglineHi: "सौदा मध्यस्थता, लीड्स व कमीशन",
      descriptionHi: "कृषि दलाल जो खरीदार व किसान के बीच सौदे कराकर पारदर्शी कमीशन कमाते हैं।",
      icon: Icons.handshake_rounded,
      primaryColor: Color(0xFF14B8A6),
      accentColor: Color(0xFF0D9488),
      defaultHomeRoute: 'brokerHome',
    ),
  };

  static UserProfileMeta meta(UserProfileType type) {
    return all[type] ?? all[UserProfileType.farmer]!;
  }
}
