import 'package:flutter/material.dart';
import '../../api/api_exception.dart';
import '../../api/transport_api.dart';
import '../../state/app_state.dart';
import '../profile_home/transport_home_widgets.dart';

class TransporterProfileView extends StatefulWidget {
  final AppState state;
  final TransportApi? transportApi;

  const TransporterProfileView({
    super.key,
    required this.state,
    this.transportApi,
  });

  @override
  State<TransporterProfileView> createState() => _TransporterProfileViewState();
}

class _TransporterProfileViewState extends State<TransporterProfileView> {
  late final TransportApi _api = widget.transportApi ?? TransportApi();

  bool _loading = true;
  bool _saving = false;
  Map<String, dynamic> _stats = const {};

  final _businessNameCtrl = TextEditingController();
  final _rcNumberCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _gstinCtrl = TextEditingController();
  final _panCtrl = TextEditingController();
  final _licenseCtrl = TextEditingController();
  final _upiCtrl = TextEditingController();

  String _transporterType = 'owner_driver';
  String _vehicleType = 'Tata Ace';
  int _fleetSize = 1;
  int _experienceYears = 4;
  bool _emergencyAvailable = true;

  final List<String> _selectedRoutes = [];
  final List<String> _selectedSpecializations = [];

  static const _allRouteOptions = [
    'पिंपलगाव ➔ नासिक APMC',
    'निफाड ➔ मुंबई वाशी',
    'नासिक ➔ सूरत सरदार मार्केट',
    'पुणे ➔ सांगली मंडी',
    'नासिक ➔ आज़ादपुर दिल्ली',
    'मालेगाव ➔ इंदौर मंडी',
    'अहिल्यानगर ➔ मुंबई',
  ];

  static const _allSpecializations = [
    'ताजी सब्जियां (Perishables)',
    'लाल प्याज व लहसुन (Onion/Garlic)',
    'अनाज व दलहन (Grains/Pulses)',
    'कोल्ड चेन (Reefer Produce)',
    'एक्सपोर्ट फल (Grapes/Pomegranate)',
    'कृषि खाद व बीज (Agro Inputs)',
  ];

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _businessNameCtrl.dispose();
    _rcNumberCtrl.dispose();
    _phoneCtrl.dispose();
    _gstinCtrl.dispose();
    _panCtrl.dispose();
    _licenseCtrl.dispose();
    _upiCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final res = await _api.getTransporterProfile();
      final profile = (res['profile'] as Map<String, dynamic>?) ?? {};
      final stats = (res['stats'] as Map<String, dynamic>?) ?? {};

      if (!mounted) return;
      setState(() {
        _stats = stats;
        _businessNameCtrl.text = "${profile['businessName'] ?? ''}";
        _rcNumberCtrl.text = "${profile['rcNumber'] ?? ''}";
        _phoneCtrl.text = "${profile['contactPhone'] ?? ''}";
        _gstinCtrl.text = "${profile['gstin'] ?? ''}";
        _panCtrl.text = "${profile['panNumber'] ?? ''}";
        _licenseCtrl.text = "${profile['transportLicense'] ?? ''}";
        _upiCtrl.text = "${profile['settlementUpi'] ?? ''}";

        _transporterType = "${profile['transporterType'] ?? 'owner_driver'}";
        _vehicleType = "${profile['vehicleType'] ?? 'Tata Ace'}";
        _fleetSize = (profile['fleetSize'] as num?)?.toInt() ?? 1;
        _experienceYears = (profile['experienceYears'] as num?)?.toInt() ?? 4;
        _emergencyAvailable = profile['emergencyAvailable'] != false;

        _selectedRoutes
          ..clear()
          ..addAll(((profile['operatingRoutes'] as List?)?.cast<String>()) ??
              ['पिंपलगाव ➔ नासिक APMC', 'निफाड ➔ मुंबई वाशी']);

        _selectedSpecializations
          ..clear()
          ..addAll(((profile['specializations'] as List?)?.cast<String>()) ??
              ['ताजी सब्जियां (Perishables)', 'लाल प्याज व लहसुन (Onion/Garlic)']);

        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final payload = {
      'businessName': _businessNameCtrl.text.trim(),
      'transporterType': _transporterType,
      'vehicleType': _vehicleType,
      'rcNumber': _rcNumberCtrl.text.trim(),
      'contactPhone': _phoneCtrl.text.trim(),
      'gstin': _gstinCtrl.text.trim().isNotEmpty ? _gstinCtrl.text.trim() : null,
      'panNumber': _panCtrl.text.trim().isNotEmpty ? _panCtrl.text.trim() : null,
      'transportLicense':
          _licenseCtrl.text.trim().isNotEmpty ? _licenseCtrl.text.trim() : null,
      'operatingRoutes': _selectedRoutes,
      'operatingStates': ['महाराष्ट्र', 'गुजरात'],
      'specializations': _selectedSpecializations,
      'fleetSize': _fleetSize,
      'experienceYears': _experienceYears,
      'emergencyAvailable': _emergencyAvailable,
      'settlementUpi': _upiCtrl.text.trim().isNotEmpty ? _upiCtrl.text.trim() : null,
    };

    try {
      await _api.updateTransporterProfile(payload);
      if (!mounted) return;
      widget.state.showToast("ट्रांसपोर्टर प्रोफाइल सफलतापूर्वक अपडेट हुई ✅");
      widget.state.navigateBack();
    } on ApiException catch (e) {
      if (mounted) widget.state.showToast(e.message.isNotEmpty ? e.message : e.code);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF0284C7);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF1E293B)),
          onPressed: widget.state.navigateBack,
        ),
        title: const Text(
          "ट्रांसपोर्टर बिजनेस प्रोफाइल",
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w900,
            color: Color(0xFF1E293B),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: primaryColor))
          : ListView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              children: [
                // KPI Header Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF0284C7), Color(0xFF0369A1)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: primaryColor.withValues(alpha: 0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.2),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.verified_rounded,
                                    color: Colors.white, size: 20),
                              ),
                              const SizedBox(width: 8),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _businessNameCtrl.text.isNotEmpty
                                        ? _businessNameCtrl.text
                                        : "किसान ट्रांसपोर्ट पार्टनर",
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  Text(
                                    _transporterType == 'fleet_owner'
                                        ? "फ्लीट ऑपरेटर (Fleet Owner)"
                                        : "मालिक-चालक (Driver-Owner)",
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.85),
                                      fontSize: 11.5,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF16A34A),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.star_rounded,
                                    color: Colors.white, size: 14),
                                const SizedBox(width: 3),
                                Text(
                                  "${_stats['rating'] ?? 4.8}",
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w900),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          MetricPill(
                            title: "कुल ट्रिप्स",
                            value: "${_stats['totalTrips'] ?? 0} पूर्ण",
                            icon: Icons.check_circle_rounded,
                          ),
                          const SizedBox(width: 8),
                          MetricPill(
                            title: "समयबद्धता",
                            value: "${_stats['onTimeRate'] ?? 98}%",
                            icon: Icons.timer_rounded,
                          ),
                          const SizedBox(width: 8),
                          MetricPill(
                            title: "फ्लीट गाड़ियां",
                            value: "$_fleetSize वाहन",
                            icon: Icons.local_shipping_rounded,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Business Details Card
                _buildCardShell(
                  title: "व्यावसायिक विवरण (Business Info)",
                  icon: Icons.business_center_rounded,
                  children: [
                    TextField(
                      controller: _businessNameCtrl,
                      decoration: const InputDecoration(
                        labelText: "कंपनी / फ्लीट नाम (Business Name)",
                        hintText: "उदा. श्री गणेश किसान ट्रांसपोर्ट",
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _transporterType,
                      decoration: const InputDecoration(
                        labelText: "ट्रांसपोर्टर प्रकार (Category)",
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(
                            value: 'owner_driver',
                            child: Text("मालिक-चालक (Driver-Owner - 1-2 वाहन)")),
                        DropdownMenuItem(
                            value: 'fleet_owner',
                            child: Text("फ्लीट ऑपरेटर (Fleet Owner - 3+ वाहन)")),
                        DropdownMenuItem(
                            value: 'logistics_partner',
                            child: Text("लॉजिस्टिक्स एजेंसी / ठेकेदार")),
                      ],
                      onChanged: (v) =>
                          setState(() => _transporterType = v ?? _transporterType),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _phoneCtrl,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(
                              labelText: "संपर्क मोबाइल नं.",
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _rcNumberCtrl,
                            decoration: const InputDecoration(
                              labelText: "प्राथमिक RC नंबर",
                              hintText: "MH-15-AB-1234",
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Compliance & Tax Details
                _buildCardShell(
                  title: "टैक्स व लाइसेंस (Compliance & GST)",
                  icon: Icons.receipt_long_rounded,
                  children: [
                    TextField(
                      controller: _gstinCtrl,
                      decoration: const InputDecoration(
                        labelText: "GSTIN नंबर (वैकल्पिक)",
                        hintText: "27AAAAA0000A1Z5",
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _panCtrl,
                            decoration: const InputDecoration(
                              labelText: "PAN कार्ड नं.",
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _licenseCtrl,
                            decoration: const InputDecoration(
                              labelText: "RTO ट्रांसपोर्ट परमिट",
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _upiCtrl,
                      decoration: const InputDecoration(
                        labelText: "भाड़ा भुगतान UPI ID / बैंक खाता",
                        hintText: "transporter@upi",
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Operating Corridors / Mandis
                _buildCardShell(
                  title: "नियमित रूट व मंडियां (Key Routes)",
                  icon: Icons.route_rounded,
                  children: [
                    const Text(
                      "जिन मार्गों पर आप नियमित रूप से कृषि माल ले जाते हैं:",
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _allRouteOptions.map((route) {
                        final selected = _selectedRoutes.contains(route);
                        return FilterChip(
                          label: Text(route,
                              style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: selected
                                      ? Colors.white
                                      : const Color(0xFF1E293B))),
                          selected: selected,
                          selectedColor: primaryColor,
                          checkmarkColor: Colors.white,
                          backgroundColor: const Color(0xFFF1F5F9),
                          onSelected: (val) {
                            setState(() {
                              val
                                  ? _selectedRoutes.add(route)
                                  : _selectedRoutes.remove(route);
                            });
                          },
                        );
                      }).toList(),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Specializations
                _buildCardShell(
                  title: "उपज विशेषज्ञता (Goods Specialization)",
                  icon: Icons.local_florist_rounded,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _allSpecializations.map((spec) {
                        final selected = _selectedSpecializations.contains(spec);
                        return FilterChip(
                          label: Text(spec,
                              style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: selected
                                      ? Colors.white
                                      : const Color(0xFF1E293B))),
                          selected: selected,
                          selectedColor: const Color(0xFF16A34A),
                          checkmarkColor: Colors.white,
                          backgroundColor: const Color(0xFFF1F5F9),
                          onSelected: (val) {
                            setState(() {
                              val
                                  ? _selectedSpecializations.add(spec)
                                  : _selectedSpecializations.remove(spec);
                            });
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 12),
                    Material(
                      color: Colors.transparent,
                      child: SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text("24x7 आपातकालीन पिकअप सेवा",
                            style: TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w800)),
                        subtitle: const Text(
                            "रात में भी खेत से मंडी त्वरित माल ढुलाई के लिए उपलब्ध",
                            style: TextStyle(fontSize: 11, color: Colors.grey)),
                        value: _emergencyAvailable,
                        activeColor: primaryColor,
                        onChanged: (v) => setState(() => _emergencyAvailable = v),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                // Save Button
                ElevatedButton(
                  onPressed: _saving ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 50),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                  ),
                  child: Text(
                    _saving ? "सहेजा जा रहा है..." : "प्रोफाइल सहेजें (Save Profile)",
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w900),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
    );
  }

  Widget _buildCardShell({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: const Color(0xFF0284C7), size: 18),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1E293B),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }
}
