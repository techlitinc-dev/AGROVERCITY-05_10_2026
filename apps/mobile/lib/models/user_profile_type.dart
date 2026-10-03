// Multi-Profile System — User Persona Enum & Metadata Registry

import 'package:flutter/material.dart';

import '../data/translations.dart';

enum UserProfileType {
  farmer,
  farmLandlord,
  transport,
  seller,
  equipmentRental,
  broker,
  instructor,
  dairyManager,
  customer,
  directBuyer,
  bankManager,
  insuranceProvider,
  coldStorageProvider,
}

class UserProfileMeta {
  final UserProfileType type;
  final String labelEn;
  final String labelHi;
  final String labelMr;
  final String taglineEn;
  final String taglineHi;
  final String taglineMr;
  final String descriptionEn;
  final String descriptionHi;
  final String descriptionMr;
  final IconData icon;
  final Color primaryColor;
  final Color accentColor;
  final String defaultHomeRoute;

  const UserProfileMeta({
    required this.type,
    required this.labelEn,
    required this.labelHi,
    required this.labelMr,
    required this.taglineEn,
    required this.taglineHi,
    required this.taglineMr,
    required this.descriptionEn,
    required this.descriptionHi,
    required this.descriptionMr,
    required this.icon,
    required this.primaryColor,
    required this.accentColor,
    required this.defaultHomeRoute,
  });

  String label(String lang) {
    return AppTranslations.get('persona.${type.name}.label', lang);
  }

  String tagline(String lang) {
    return AppTranslations.get('persona.${type.name}.tagline', lang);
  }

  String description(String lang) {
    return AppTranslations.get('persona.${type.name}.description', lang);
  }
}

class UserProfileRegistry {
  static const Map<UserProfileType, UserProfileMeta> all = {
    UserProfileType.farmer: UserProfileMeta(
      type: UserProfileType.farmer,
      labelEn: "Farmer",
      labelHi: "किसान",
      labelMr: "शेतकरी",
      taglineEn: "Crop management, mandi rates & advisory",
      taglineHi: "फसल प्रबंधन, मंडी भाव व सलाह",
      taglineMr: "पीक व्यवस्थापन, बाजारभाव व सल्ला",
      descriptionEn: "Farmer accessing crop production, irrigation, mandi sales and govt schemes.",
      descriptionHi: "कृषक जो फसल उत्पादन, सिंचाई, मंडी बिक्री और सरकारी योजनाओं का लाभ लेते हैं।",
      descriptionMr: "पीक उत्पादन, सिंचन, बाजार विक्री आणि सरकारी योजनांचा लाभ घेणारे शेतकरी.",
      icon: Icons.agriculture_rounded,
      primaryColor: Color(0xFF43A047),
      accentColor: Color(0xFF2E7D32),
      defaultHomeRoute: 'home',
    ),
    UserProfileType.farmLandlord: UserProfileMeta(
      type: UserProfileType.farmLandlord,
      labelEn: "Farm Landlord",
      labelHi: "खेत मालिक",
      labelMr: "जमीन मालक",
      taglineEn: "Land lease, 7/12 records & rent",
      taglineHi: "जमीन लीज, 7/12 रिकॉर्ड व किराया",
      taglineMr: "जमीन भाडेपट्टा, 7/12 व भाडे",
      descriptionEn: "Land owner managing land lease, land records and rental income.",
      descriptionHi: "भूमि स्वामी जो खेत लीज/किराए पर देते हैं, भू-अभिलेख और आय का प्रबंधन करते हैं।",
      descriptionMr: "जमीन भाड्याने देणारे, भूमी अभिलेख आणि उत्पन्न व्यवस्थापित करणारे जमीन मालक.",
      icon: Icons.landscape_rounded,
      primaryColor: Color(0xFF8B5CF6),
      accentColor: Color(0xFF7C3AED),
      defaultHomeRoute: 'landlordHome',
    ),
    UserProfileType.transport: UserProfileMeta(
      type: UserProfileType.transport,
      labelEn: "Transporter",
      labelHi: "परिवहन",
      labelMr: "वाहतूकदार",
      taglineEn: "Vehicle booking, freight & trips",
      taglineHi: "वाहन बुकिंग, माल ढुलाई व ट्रिप",
      taglineMr: "वाहन बुकिंग, मालवाहतूक व ट्रिप",
      descriptionEn: "Vehicle owner safely transporting agricultural produce from farm to mandi.",
      descriptionHi: "ट्रक/ट्रैक्टर वाहन मालिक जो कृषि उपज को खेत से मंडी तक सुरक्षित पहुंचाते हैं।",
      descriptionMr: "शेतीमाल शेतातून थेट बाजारापर्यंत सुरक्षित पोहोचवणारे वाहन मालक.",
      icon: Icons.local_shipping_rounded,
      primaryColor: Color(0xFF0284C7),
      accentColor: Color(0xFF0369A1),
      defaultHomeRoute: 'transportHome',
    ),
    UserProfileType.seller: UserProfileMeta(
      type: UserProfileType.seller,
      labelEn: "Seller / Vyapari",
      labelHi: "व्यापारी",
      labelMr: "व्यापारी",
      taglineEn: "Mandi trading, inventory & ledger",
      taglineHi: "मंडी खरीद-बिक्री, स्टॉक व लेजर",
      taglineMr: "बाजार खरेदी-विक्री, स्टॉक व खाते",
      descriptionEn: "Mandi trader and commission agent buying from farmers and wholesaling.",
      descriptionHi: "मंडी आढ़ती व व्यापारी जो किसानों से उपज खरीदते हैं और थोक बिक्री करते हैं।",
      descriptionMr: "शेतकऱ्यांकडून शेतमाल खरेदी करून घाऊक विक्री करणारे व्यापारी.",
      icon: Icons.storefront_rounded,
      primaryColor: Color(0xFFEA580C),
      accentColor: Color(0xFFC2410C),
      defaultHomeRoute: 'sellerHome',
    ),
    UserProfileType.equipmentRental: UserProfileMeta(
      type: UserProfileType.equipmentRental,
      labelEn: "Equipment Owner",
      labelHi: "यंत्र किराया",
      labelMr: "यंत्र मालक",
      taglineEn: "Tractor, harvester booking & rent",
      taglineHi: "ट्रैक्टर, हार्वेस्टर बुकिंग व आय",
      taglineMr: "ट्रॅक्टर, हार्वेस्टर बुकिंग व भाडे",
      descriptionEn: "Equipment owner renting tractors, threshers, drones to farmers.",
      descriptionHi: "कृषि यंत्र स्वामी जो ट्रैक्टर, थ्रेशर, ड्रोन किराए पर देकर सेवा प्रदान करते हैं।",
      descriptionMr: "ट्रॅक्टर, थ्रेशर, ड्रोन भाड्याने देणारे कृषी यंत्र मालक.",
      icon: Icons.construction_rounded,
      primaryColor: Color(0xFFF59E0B),
      accentColor: Color(0xFFD97706),
      defaultHomeRoute: 'equipmentOwnerHome',
    ),
    UserProfileType.broker: UserProfileMeta(
      type: UserProfileType.broker,
      labelEn: "Broker / Dalal",
      labelHi: "दलाल / मध्यस्थ",
      labelMr: "दलाल / मध्यस्थ",
      taglineEn: "Deal mediation, leads & commission",
      taglineHi: "सौदा मध्यस्थता, लीड्स व कमीशन",
      taglineMr: "सौदे मध्यस्थता, लीड्स व कमिशन",
      descriptionEn: "Agricultural broker facilitating transparent deals between buyers and farmers.",
      descriptionHi: "कृषि दलाल जो खरीदार व किसान के बीच सौदे कराकर पारदर्शी कमीशन कमाते हैं।",
      descriptionMr: "खरेदीदार आणि शेतकरी यांच्यात पारदर्शक सौदे घडवून आणणारे कृषी मध्यस्थ.",
      icon: Icons.handshake_rounded,
      primaryColor: Color(0xFF14B8A6),
      accentColor: Color(0xFF0D9488),
      defaultHomeRoute: 'brokerHome',
    ),
    UserProfileType.instructor: UserProfileMeta(
      type: UserProfileType.instructor,
      labelEn: "Instructor / Teacher",
      labelHi: "प्रशिक्षक / शिक्षक",
      labelMr: "प्रशिक्षक / शिक्षक",
      taglineEn: "Sell courses, audio & video podcasts",
      taglineHi: "कोर्स, ऑडियो व वीडियो पॉडकास्ट बेचें",
      taglineMr: "कोर्सेस, ऑडिओ व व्हिडिओ पॉडकास्ट विका",
      descriptionEn: "Agricultural expert creating and selling courses, audio and video podcasts to farmers.",
      descriptionHi: "कृषि विशेषज्ञ जो किसानों को कोर्स, ऑडियो व वीडियो पॉडकास्ट बनाकर बेचते हैं।",
      descriptionMr: "शेतकऱ्यांना कोर्सेस, ऑडिओ व व्हिडिओ पॉडकास्ट तयार करून विकणारे कृषी तज्ज्ञ.",
      icon: Icons.school_rounded,
      primaryColor: Color(0xFF7C3AED),
      accentColor: Color(0xFF6D28D9),
      defaultHomeRoute: 'instructorHome',
    ),
    UserProfileType.dairyManager: UserProfileMeta(
      type: UserProfileType.dairyManager,
      labelEn: "Dairy & Gaushala Manager / Vet",
      labelHi: "डेयरी, गौशाला व पशु चिकित्सक",
      labelMr: "डेअरी, गोशाळा व पशुवैद्यक व्यवस्थापक",
      taglineEn: "Milk procurement, gaushala, cattle & vet clinic",
      taglineHi: "दूध संकलन, गौशाला, पशुधन व क्लिनिक",
      taglineMr: "दूध संकलन, गोशाळा, पशुधन व क्लिनिक व्यवस्थापन",
      descriptionEn: "Manage milk procurement, Fat/SNF testing, gaushala cow adoptions, cattle health, and veterinary appointments.",
      descriptionHi: "दूध संकलन, फैट/एसएनएफ गणना, गौशाला गाय गोद लेना, मवेशी स्वास्थ्य और पशु चिकित्सा का प्रबंधन करें।",
      descriptionMr: "दूध संकलन, फॅट/एसएनएफ दर, गोशाळा गो-दत्तक, पशुधन आरोग्य आणि पशुवैद्यकीय भेटींचे व्यवस्थापन करा.",
      icon: Icons.pets_rounded,
      primaryColor: Color(0xFF0D9488),
      accentColor: Color(0xFF0F766E),
      defaultHomeRoute: 'dairyManagerHome',
    ),
    UserProfileType.customer: UserProfileMeta(
      type: UserProfileType.customer,
      labelEn: "E-Market Customer",
      labelHi: "ई-मार्केट ग्राहक",
      labelMr: "ई-मार्केट ग्राहक",
      taglineEn: "Shop agri products, track orders & save with coupons",
      taglineHi: "कृषि उत्पाद खरीदें, ऑर्डर ट्रैक करें व कूपन बचत",
      taglineMr: "कृषी उत्पादने विकत घ्या, ऑर्डर ट्रॅक करा व कूपन बचत",
      descriptionEn: "Online shopper buying verified agri inputs and produce from the E-Market with wishlist, coupons and order tracking.",
      descriptionHi: "विश्वसनीय कृषि निविष्ट व उपज ई-मार्केट से खरीदने वाले ऑनलाइन ग्राहक — विशलिस्ट, कूपन व ऑर्डर ट्रैकिंग सहित।",
      descriptionMr: "विश्वासार्ह कृषी इनपुट्स व शेतमाल ई-मार्केटमधून खरेदी करणारे ऑनलाइन ग्राहक — विशलिस्ट, कूपन व ऑर्डर ट्रॅकिंगसह.",
      icon: Icons.shopping_bag_rounded,
      primaryColor: Color(0xFFDB2777),
      accentColor: Color(0xFFBE185D),
      defaultHomeRoute: 'emarketHome',
    ),
    UserProfileType.directBuyer: UserProfileMeta(
      type: UserProfileType.directBuyer,
      labelEn: "Direct Buyer",
      labelHi: "प्रत्यक्ष खरीदार",
      labelMr: "थेट खरेदीदार",
      taglineEn: "Post buy-requirements, negotiate & procure from farmers",
      taglineHi: "खरीद मांग पोस्ट करें, मोलभाव करें व किसानों से खरीदें",
      taglineMr: "खरेदी माग नोंदवा, बोला करा व शेतकऱ्यांकडून खरेदी करा",
      descriptionEn: "Retailer, wholesaler, processor or institution procuring produce directly from farmers with QC-based settlement.",
      descriptionHi: "क्यूसी-आधारित निपटान के साथ किसानों से सीधे उपज खरीदने वाले रिटेलर, थोक व्यापारी, प्रोसेसर या संस्था।",
      descriptionMr: "QC-आधारित तटस्तता सह शेतकऱ्यांकडून थेट शेतमाल खरेदी करणारे रिटेलर, घाऊक व्यापारी, प्रक्रिया कर्ते वा संस्था.",
      icon: Icons.precision_manufacturing_rounded,
      primaryColor: Color(0xFF4F46E5),
      accentColor: Color(0xFF4338CA),
      defaultHomeRoute: 'directBuyerHome',
    ),
    UserProfileType.bankManager: UserProfileMeta(
      type: UserProfileType.bankManager,
      labelEn: "Bank Manager",
      labelHi: "बैंक मैनेजर",
      labelMr: "बँक व्यवस्थापक",
      taglineEn: "Review, sanction & disburse farmer loans",
      taglineHi: "किसान ऋण की समीक्षा, स्वीकृति व वितरण",
      taglineMr: "शेतकरी कर्जाचे आढावे, मंजुरी व वितरण",
      descriptionEn: "Bank officer reviewing loan applications, sanctioning credit and disbursing funds to farmers.",
      descriptionHi: "ऋण आवेदनों की समीक्षा करके किसानों को साख स्वीकृत करने और राशि वितरित करने वाले बैंक अधिकारी।",
      descriptionMr: "कर्ज अर्जांचा आढावा घेऊन शेतकऱ्यांना कर्ज मंजूर करणारे व रक्कम वितरित करणारे बँक अधिकारी.",
      icon: Icons.account_balance_rounded,
      primaryColor: Color(0xFF334155),
      accentColor: Color(0xFF1E293B),
      defaultHomeRoute: 'bankManagerHome',
    ),
    UserProfileType.insuranceProvider: UserProfileMeta(
      type: UserProfileType.insuranceProvider,
      labelEn: "Insurance Provider",
      labelHi: "बीमा प्रदाता",
      labelMr: "विमा प्रदाता",
      taglineEn: "Review policies, assess damages & approve claims",
      taglineHi: "पॉलिसी समीक्षा, नुकसान मूल्यांकन व दावा स्वीकृति",
      taglineMr: "विमा पॉलिसी आढावा, नुकसान मूल्यमापन व क्लेम मंजुरी",
      descriptionEn: "Insurance company representative reviewing policy applications, underwriting risk, scheduling surveys, and approving crop & livestock claim settlements.",
      descriptionHi: "बीमा कंपनी प्रतिनिधि जो फसल व पशुधन बीमा आवेदनों की समीक्षा, जोखिम मूल्यांकन, सर्वेक्षक नियुक्ति और दावों का निपटान करते हैं।",
      descriptionMr: "विमा कंपनी प्रतिनिधी जे शेतकरी विमा अर्जांचा आढावा घेतात, जोखीम मूल्यांकन करतात आणि क्लेम मंजूर करतात.",
      icon: Icons.shield_rounded,
      primaryColor: Color(0xFF0F766E),
      accentColor: Color(0xFF115E59),
      defaultHomeRoute: 'insuranceProviderHome',
    ),
    UserProfileType.coldStorageProvider: UserProfileMeta(
      type: UserProfileType.coldStorageProvider,
      labelEn: "Cold Storage Provider",
      labelHi: "कोल्ड स्टोरेज / गोदाम संचालक",
      labelMr: "कोल्ड स्टोरेज / गोदाम व्यवस्थापक",
      taglineEn: "Manage godown capacity, inward lots, gate passes & release",
      taglineHi: "गोदाम क्षमता, आवक लॉट, गेट पास व उपज निकासी प्रबंधन",
      taglineMr: "गोदाम क्षमता, आवक नोंद, गेट पास व साठा व्यवस्थापन",
      descriptionEn: "Warehouse and cold storage operator managing commodity intake, lot allocations, electronic warehouse receipts (e-NWR) and dispatch gate passes.",
      descriptionHi: "गोदाम और कोल्ड स्टोरेज संचालक जो उपज आवक, लॉट आवंटन, इलेक्ट्रॉनिक वेयरहाउस रसीद (e-NWR) और निकासी गेट पास का प्रबंधन करते हैं।",
      descriptionMr: "गोदाम आणि शीतगृह चालक जे शेतमाल आवक, लॉट वाटप, इलेक्ट्रॉनिक वेअरहाऊस पावती (e-NWR) आणि गेट पास व्यवस्थापित करतात.",
      icon: Icons.warehouse_rounded,
      primaryColor: Color(0xFF0284C7),
      accentColor: Color(0xFF0369A1),
      defaultHomeRoute: 'coldStorageHome',
    ),
  };

  static UserProfileMeta meta(UserProfileType type) {
    return all[type] ?? all[UserProfileType.farmer]!;
  }
}
