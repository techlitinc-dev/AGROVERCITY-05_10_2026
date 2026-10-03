import 'package:flutter/material.dart';

import '../../data/translations.dart';
import '../../state/app_state.dart';
import '../../views/onboarding/register_form_data.dart';
import 'field_widgets.dart';

// Per-role registration details captured on register step 3 for non-farmer
// personas (X1). Keys in toJson match the backend role_profiles models.
class RoleProfileFormData {
  String vehicleType = 'Tata Ace';
  final rcNumber = TextEditingController();
  final transportBusinessName = TextEditingController();
  String transporterType = 'owner_driver';
  final transportGstin = TextEditingController();
  final List<String> transportRoutes = [];
  final List<String> transportSpecializations = [];
  final shopName = TextEditingController();
  final gstNumber = TextEditingController();
  final apmcLicense = TextEditingController();
  double totalLandAcres = 5.0;
  final List<String> marketsServed = [];
  String machineType = 'Tractor';
  int machineCount = 1;
  final List<String> expertise = [];
  final qualification = TextEditingController();
  final centerName = TextEditingController();
  final licenseNumber = TextEditingController();
  double dailyCapacityLiters = 1000.0;
  bool isGaushalaOperator = true;
  bool isVetPractitioner = true;
  final companyName = TextEditingController();
  String buyerType = 'retailer';
  final gstin = TextEditingController();
  final licenseNo = TextEditingController();
  double capacityPerMonth = 100.0;
  final List<String> categories = [];
  final List<String> operatingStates = [];
  int creditTermsDays = 0;

  static const buyerTypes = [
    'retailer',
    'wholesaler',
    'processor',
    'exporter',
    'hotel',
    'institutional',
  ];

  static const vehicleTypes = ['Tata Ace', 'Bolero Maxi', 'Tractor Trolley'];
  static const marketOptions = ['Nashik', 'Pimpalgaon', 'Lasalgaon', 'Vashi'];
  static const machineTypes = [
    'Tractor',
    'Thresher',
    'Sprayer',
    'Rotavator',
    'Harvester',
    'Cultivator',
  ];
  static const expertiseOptions = [
    'Agronomy',
    'Pest Management',
    'Dairy & Livestock',
    'Horticulture',
    'Soil Health',
    'Farm Machinery',
    'Organic Farming',
    'Agri Business',
  ];

  String? validate(String profileType, [String lang = 'hi']) {
    return switch (profileType) {
      'transport' when rcNumber.text.trim().isEmpty =>
        AppTranslations.get('onboarding.errRcRequired', lang),
      'seller' when shopName.text.trim().isEmpty =>
        AppTranslations.get('onboarding.errShopNameRequired', lang),
      'broker' when marketsServed.isEmpty =>
        AppTranslations.get('onboarding.errMarketRequired', lang),
      'equipmentRental' when machineCount < 1 =>
        AppTranslations.get('onboarding.errMachineRequired', lang),
      'instructor' when expertise.isEmpty =>
        AppTranslations.get('onboarding.errExpertiseRequired', lang),
      'dairyManager' when centerName.text.trim().isEmpty =>
        AppTranslations.get('onboarding.errCenterNameRequired', lang),
      'directBuyer' when companyName.text.trim().isEmpty =>
        AppTranslations.get('direct.errCompanyRequired', lang),
      _ => null,
    };
  }

  Map<String, dynamic> toJson(String profileType) {
    return switch (profileType) {
      'transport' => {
          'vehicleType': vehicleType,
          'rcNumber': rcNumber.text.trim(),
          if (transportBusinessName.text.trim().isNotEmpty)
            'businessName': transportBusinessName.text.trim(),
          'transporterType': transporterType,
          if (transportGstin.text.trim().isNotEmpty)
            'gstin': transportGstin.text.trim(),
          if (transportRoutes.isNotEmpty)
            'operatingRoutes': List<String>.from(transportRoutes),
          if (transportSpecializations.isNotEmpty)
            'specializations': List<String>.from(transportSpecializations),
        },
      'seller' => {
          'shopName': shopName.text.trim(),
          if (gstNumber.text.trim().isNotEmpty)
            'gstNumber': gstNumber.text.trim(),
          if (apmcLicense.text.trim().isNotEmpty)
            'apmcLicense': apmcLicense.text.trim(),
        },
      'farmLandlord' => {'totalLandAcres': totalLandAcres},
      'broker' => {'marketsServed': List<String>.from(marketsServed)},
      'equipmentRental' => {
          'machineType': machineType,
          'machineCount': machineCount,
        },
      'instructor' => {
          'expertise': List<String>.from(expertise),
          if (qualification.text.trim().isNotEmpty)
            'qualification': qualification.text.trim(),
        },
      'dairyManager' => {
          'centerName': centerName.text.trim(),
          'licenseNumber': licenseNumber.text.trim(),
          'dailyCapacityLiters': dailyCapacityLiters,
          'isGaushalaOperator': isGaushalaOperator,
          'isVetPractitioner': isVetPractitioner,
        },
      'directBuyer' => {
          'companyName': companyName.text.trim(),
          'buyerType': buyerType,
          if (gstin.text.trim().isNotEmpty) 'gstin': gstin.text.trim(),
          if (licenseNo.text.trim().isNotEmpty)
            'licenseNo': licenseNo.text.trim(),
          'capacityPerMonth': capacityPerMonth,
          'categories': List<String>.from(categories),
          'operatingStates': List<String>.from(operatingStates),
          'creditTermsDays': creditTermsDays,
        },
      _ => <String, dynamic>{},
    };
  }

  void dispose() {
    rcNumber.dispose();
    transportBusinessName.dispose();
    transportGstin.dispose();
    shopName.dispose();
    gstNumber.dispose();
    apmcLicense.dispose();
    qualification.dispose();
    centerName.dispose();
    licenseNumber.dispose();
    companyName.dispose();
    gstin.dispose();
    licenseNo.dispose();
  }
}

class RoleProfileForm extends StatelessWidget {
  const RoleProfileForm({
    super.key,
    required this.profileType,
    required this.data,
    required this.onChanged,
    this.errorText,
    this.state,
  });

  final String profileType;
  final RoleProfileFormData data;
  final VoidCallback onChanged;
  final String? errorText;
  final AppState? state;

  String _headerFor(String profileType) {
    return switch (profileType) {
      'transport' =>
        state?.tr('onboarding.vehicleDetails') ?? 'वाहन विवरण',
      'seller' => state?.tr('onboarding.shopDetails') ?? 'दुकान विवरण',
      'farmLandlord' => state?.tr('onboarding.landDetails') ?? 'भूमि विवरण',
      'broker' => state?.tr('onboarding.marketDetails') ?? 'बाज़ार विवरण',
      'equipmentRental' =>
        state?.tr('onboarding.machineDetails') ?? 'यंत्र विवरण',
      'instructor' =>
        state?.tr('onboarding.instructorDetails') ?? 'प्रशिक्षक विवरण',
      'dairyManager' =>
        state?.tr('onboarding.dairyDetails') ?? 'डेयरी केंद्र विवरण',
      'customer' => state?.tr('emarket.shoppingProfile') ?? 'खरीदारी प्रोफाइल',
      'directBuyer' =>
        state?.tr('direct.companyDetails') ?? 'कंपनी विवरण',
      _ => '',
    };
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _headerFor(profileType),
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 10),
          _buildFields(),
          if (errorText != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                errorText!,
                style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildFields() {
    return switch (profileType) {
      'transport' => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LabeledTextField(
              controller: data.transportBusinessName,
              label: state?.tr('transporter.businessNameOptional') ?? 'ट्रांसपोर्ट व्यवसाय / फर्म नाम (वैकल्पिक)',
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: data.vehicleType,
              decoration: InputDecoration(
                labelText: state?.tr('onboarding.vehicleType') ?? 'वाहन प्रकार',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              items: [
                for (final type in RoleProfileFormData.vehicleTypes)
                  DropdownMenuItem(value: type, child: Text(type)),
              ],
              onChanged: (v) {
                data.vehicleType = v ?? data.vehicleType;
                onChanged();
              },
            ),
            const SizedBox(height: 10),
            LabeledTextField(
              controller: data.rcNumber,
              label: state?.tr('onboarding.rcNumber') ?? 'RC नंबर',
            ),
            const SizedBox(height: 10),
            LabeledTextField(
              controller: data.transportGstin,
              label: state?.tr('transporter.gstinOptional') ?? 'GSTIN नंबर (वैकल्पिक)',
            ),
          ],
        ),
      'seller' => Column(
          children: [
            LabeledTextField(
              controller: data.shopName,
              label: state?.tr('onboarding.shopName') ?? 'दुकान का नाम',
            ),
            const SizedBox(height: 10),
            LabeledTextField(
              controller: data.gstNumber,
              label: state?.tr('onboarding.gstNumberOptional') ??
                  'GST नंबर (वैकल्पिक)',
            ),
            const SizedBox(height: 10),
            LabeledTextField(
              controller: data.apmcLicense,
              label: state?.tr('onboarding.apmcLicenseOptional') ??
                  'APMC लाइसेंस (वैकल्पिक)',
            ),
          ],
        ),
      'farmLandlord' => Row(
          children: [
            Expanded(
              child: Slider(
                value: data.totalLandAcres,
                min: 0.5,
                max: 100,
                divisions: 199,
                label:
                    '${data.totalLandAcres.toStringAsFixed(1)} ${state?.tr('acresUnit') ?? 'एकड़'}',
                onChanged: (v) {
                  data.totalLandAcres = v;
                  onChanged();
                },
              ),
            ),
            Text(
              '${data.totalLandAcres.toStringAsFixed(1)} ${state?.tr('acresUnit') ?? 'एकड़'}',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
        ),
      'broker' => CropSelectorField(
          options: RoleProfileFormData.marketOptions,
          selected: data.marketsServed,
          onChanged: (v) {
            data.marketsServed
              ..clear()
              ..addAll(v);
            onChanged();
          },
          addLabel: state?.tr('onboarding.addMarket') ?? 'अन्य बाज़ार जोड़ें',
          addHint: state?.tr('onboarding.marketNameHint') ?? 'बाज़ार का नाम लिखें',
        ),
      'equipmentRental' => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DropdownButtonFormField<String>(
              initialValue: data.machineType,
              decoration: InputDecoration(
                labelText: state?.tr('onboarding.machineType') ?? 'यंत्र प्रकार',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              items: [
                for (final type in RoleProfileFormData.machineTypes)
                  DropdownMenuItem(value: type, child: Text(type)),
              ],
              onChanged: (v) {
                data.machineType = v ?? data.machineType;
                onChanged();
              },
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Slider(
                    value: data.machineCount.toDouble(),
                    min: 1,
                    max: 20,
                    divisions: 19,
                    label:
                        '${data.machineCount} ${state?.tr('onboarding.machineUnit') ?? 'यंत्र'}',
                    onChanged: (v) {
                      data.machineCount = v.round();
                      onChanged();
                    },
                  ),
                ),
                Text(
                  '${data.machineCount} ${state?.tr('onboarding.machineUnit') ?? 'यंत्र'}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ],
        ),
      'instructor' => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LabeledTextField(
              controller: data.qualification,
              label: state?.tr('onboarding.qualificationOptional') ??
                  'योग्यता (वैकल्पिक)',
            ),
            const SizedBox(height: 10),
            Text(
              state?.tr('onboarding.expertiseAreas') ??
                  'विषय-क्षेत्र (कम से कम एक)',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
            ),
            const SizedBox(height: 6),
            CropSelectorField(
              options: RoleProfileFormData.expertiseOptions,
              selected: data.expertise,
              onChanged: (v) {
                data.expertise
                  ..clear()
                  ..addAll(v);
                onChanged();
              },
            ),
          ],
        ),
      'dairyManager' => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LabeledTextField(
              controller: data.centerName,
              label: state?.tr('onboarding.centerName') ?? 'डेयरी केंद्र का नाम',
            ),
            const SizedBox(height: 10),
            LabeledTextField(
              controller: data.licenseNumber,
              label: state?.tr('onboarding.licenseNumberOptional') ??
                  'लाइसेंस नंबर (वैकल्पिक)',
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Slider(
                    value: data.dailyCapacityLiters,
                    min: 100,
                    max: 10000,
                    divisions: 99,
                    label:
                        '${data.dailyCapacityLiters.toStringAsFixed(0)} L',
                    onChanged: (v) {
                      data.dailyCapacityLiters = v;
                      onChanged();
                    },
                  ),
                ),
                Text(
                  '${data.dailyCapacityLiters.toStringAsFixed(0)} L',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ],
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text(state?.tr('onboarding.isGaushalaOperator') ??
                  'मैं गौशाला संचालक भी हूँ'),
              value: data.isGaushalaOperator,
              onChanged: (v) {
                data.isGaushalaOperator = v;
                onChanged();
              },
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text(state?.tr('onboarding.isVetPractitioner') ??
                  'मैं पशु चिकित्सक भी हूँ'),
              value: data.isVetPractitioner,
              onChanged: (v) {
                data.isVetPractitioner = v;
                onChanged();
              },
            ),
          ],
        ),
      'customer' => Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFFDF2F8),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFF9A8D4)),
          ),
          child: Text(
            state?.tr('emarket.customerNoExtraDetails') ??
                'ई-मार्केट खरीदारी के लिए कोई अतिरिक्त विवरण आवश्यक नहीं — आगे बढ़ें।',
            style: const TextStyle(
              fontSize: 12.5,
              height: 1.4,
              fontWeight: FontWeight.w700,
              color: Color(0xFF9D174D),
            ),
          ),
        ),
      'directBuyer' => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LabeledTextField(
              controller: data.companyName,
              label: state?.tr('direct.companyName') ?? 'कंपनी का नाम',
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: data.buyerType,
              decoration: InputDecoration(
                labelText: state?.tr('direct.buyerType') ?? 'खरीदार प्रकार',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              items: [
                for (final type in RoleProfileFormData.buyerTypes)
                  DropdownMenuItem(
                    value: type,
                    child: Text(
                      state?.tr('direct.buyerType_$type') ?? type,
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
              ],
              onChanged: (v) {
                data.buyerType = v ?? data.buyerType;
                onChanged();
              },
            ),
            const SizedBox(height: 10),
            LabeledTextField(
              controller: data.gstin,
              label: state?.tr('direct.gstinOptional') ?? 'GSTIN (वैकल्पिक)',
            ),
            const SizedBox(height: 10),
            LabeledTextField(
              controller: data.licenseNo,
              label: state?.tr('direct.licenseNoOptional') ??
                  'लाइसेंस नंबर (वैकल्पिक)',
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Expanded(
                  child: Slider(
                    value: data.capacityPerMonth,
                    min: 10,
                    max: 5000,
                    divisions: 499,
                    label:
                        '${data.capacityPerMonth.toStringAsFixed(0)} ${state?.tr('direct.quintalPerMonth') ?? 'क्विंटल/माह'}',
                    onChanged: (v) {
                      data.capacityPerMonth = v;
                      onChanged();
                    },
                  ),
                ),
                Text(
                  '${data.capacityPerMonth.toStringAsFixed(0)} ${state?.tr('direct.quintalPerMonth') ?? 'क्विंटल/माह'}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              state?.tr('direct.categoriesLabel') ?? 'खरीदी श्रेणियाँ',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
            ),
            const SizedBox(height: 6),
            CropSelectorField(
              options: RegisterFormData.cropOptions,
              selected: data.categories,
              onChanged: (v) {
                data.categories
                  ..clear()
                  ..addAll(v);
                onChanged();
              },
              addLabel: state?.tr('direct.addCategory') ?? 'अन्य श्रेणी जोड़ें',
              addHint: state?.tr('direct.categoryNameHint') ?? 'श्रेणी का नाम लिखें',
            ),
            const SizedBox(height: 10),
            Text(
              state?.tr('direct.operatingStatesLabel') ?? 'कार्यराज्य',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
            ),
            const SizedBox(height: 6),
            CropSelectorField(
              options: RegisterFormData.states,
              selected: data.operatingStates,
              onChanged: (v) {
                data.operatingStates
                  ..clear()
                  ..addAll(v);
                onChanged();
              },
              addLabel: state?.tr('direct.addState') ?? 'अन्य राज्य जोड़ें',
              addHint: state?.tr('direct.stateNameHint') ?? 'राज्य का नाम लिखें',
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Expanded(
                  child: Slider(
                    value: data.creditTermsDays.toDouble(),
                    min: 0,
                    max: 120,
                    divisions: 24,
                    label:
                        '${data.creditTermsDays} ${state?.tr('direct.creditDaysUnit') ?? 'दिन'}',
                    onChanged: (v) {
                      data.creditTermsDays = v.round();
                      onChanged();
                    },
                  ),
                ),
                Text(
                  '${data.creditTermsDays} ${state?.tr('direct.creditDaysUnit') ?? 'दिन'}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ],
        ),
      _ => const SizedBox.shrink(),
    };
  }
}