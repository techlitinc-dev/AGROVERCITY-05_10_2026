import 'package:flutter/material.dart';

import 'field_widgets.dart';

// Per-role registration details captured on register step 3 for non-farmer
// personas (X1). Keys in toJson match the backend role_profiles models.
class RoleProfileFormData {
  String vehicleType = 'Tata Ace';
  final rcNumber = TextEditingController();
  final shopName = TextEditingController();
  final gstNumber = TextEditingController();
  final apmcLicense = TextEditingController();
  double totalLandAcres = 5.0;
  final List<String> marketsServed = [];

  static const vehicleTypes = ['Tata Ace', 'Bolero Maxi', 'Tractor Trolley'];
  static const marketOptions = ['Nashik', 'Pimpalgaon', 'Lasalgaon', 'Vashi'];

  String? validate(String profileType) {
    return switch (profileType) {
      'transport' when rcNumber.text.trim().isEmpty => 'RC नंबर आवश्यक है',
      'seller' when shopName.text.trim().isEmpty => 'दुकान का नाम आवश्यक है',
      'broker' when marketsServed.isEmpty => 'कम से कम एक बाज़ार चुनें',
      _ => null,
    };
  }

  Map<String, dynamic> toJson(String profileType) {
    return switch (profileType) {
      'transport' => {
          'vehicleType': vehicleType,
          'rcNumber': rcNumber.text.trim(),
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
      _ => <String, dynamic>{},
    };
  }

  void dispose() {
    rcNumber.dispose();
    shopName.dispose();
    gstNumber.dispose();
    apmcLicense.dispose();
  }
}

class RoleProfileForm extends StatelessWidget {
  const RoleProfileForm({
    super.key,
    required this.profileType,
    required this.data,
    required this.onChanged,
    this.errorText,
  });

  final String profileType;
  final RoleProfileFormData data;
  final VoidCallback onChanged;
  final String? errorText;

  static String headerFor(String profileType) {
    return switch (profileType) {
      'transport' => 'वाहन विवरण',
      'seller' => 'दुकान विवरण',
      'farmLandlord' => 'भूमि विवरण',
      'broker' => 'बाज़ार विवरण',
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
            headerFor(profileType),
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
            DropdownButtonFormField<String>(
              initialValue: data.vehicleType,
              decoration: InputDecoration(
                labelText: 'वाहन प्रकार',
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
              label: 'RC नंबर',
            ),
          ],
        ),
      'seller' => Column(
          children: [
            LabeledTextField(controller: data.shopName, label: 'दुकान का नाम'),
            const SizedBox(height: 10),
            LabeledTextField(
              controller: data.gstNumber,
              label: 'GST नंबर (वैकल्पिक)',
            ),
            const SizedBox(height: 10),
            LabeledTextField(
              controller: data.apmcLicense,
              label: 'APMC लाइसेंस (वैकल्पिक)',
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
                label: '${data.totalLandAcres.toStringAsFixed(1)} एकड़',
                onChanged: (v) {
                  data.totalLandAcres = v;
                  onChanged();
                },
              ),
            ),
            Text(
              '${data.totalLandAcres.toStringAsFixed(1)} एकड़',
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
          addLabel: 'अन्य बाज़ार जोड़ें',
          addHint: 'बाज़ार का नाम लिखें',
        ),
      _ => const SizedBox.shrink(),
    };
  }
}
