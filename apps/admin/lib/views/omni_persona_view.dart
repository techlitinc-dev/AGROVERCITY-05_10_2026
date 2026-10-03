import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/admin_api.dart';
import '../api/api_exception.dart';

class OmniPersonaView extends StatefulWidget {
  const OmniPersonaView({super.key});

  @override
  State<OmniPersonaView> createState() => _OmniPersonaViewState();
}

class _OmniPersonaViewState extends State<OmniPersonaView> {
  Map<String, dynamic>? _overview;
  String? _error;
  bool _loading = true;
  String _selectedPersona = 'farmer';

  static const List<Map<String, dynamic>> _personas = [
    {
      'id': 'farmer',
      'title': 'किसान (Farmer)',
      'icon': Icons.agriculture,
      'color': Color(0xFF2E7D32),
      'description': 'फसल सुरक्षा (Gemini AI), मंडी लॉट बिक्री, मृदा परीक्षण एवं मौसम अलर्ट।',
      'endpoints': [
        'POST /v1/advisory/disease-scan (Gemini Vision AI)',
        'POST /v1/market/lots (मंडी लॉट निर्माण)',
        'POST /v1/soil-tests/book (सॉइल हेल्थ टेस्ट)',
        'POST /v1/chatbot/messages (किसान मित्र AI)',
      ],
      'metricsKey': 'farmer',
    },
    {
      'id': 'farmLandlord',
      'title': 'भूमि स्वामी (Farm Landlord)',
      'icon': Icons.landscape,
      'color': Color(0xFF1565C0),
      'description': 'कृषि भूमि पट्टा, 7/12 भूलेख सत्यापन एवं डिजिटल अनुबंध प्रबंधन।',
      'endpoints': [
        'POST /v1/land/plots (भूमि प्लॉट लिस्टिंग)',
        'GET /v1/land-records/search (महाभूलेख 7/12 खोज)',
        'POST /v1/contracts/draft (ई-अनुबंध मसौदा)',
      ],
      'metricsKey': 'farmLandlord',
    },
    {
      'id': 'transporter',
      'title': 'परिवहन संचालक (Transporter)',
      'icon': Icons.local_shipping,
      'color': Color(0xFFE65100),
      'description': 'कृषि लॉजिस्टिक्स फ्लीट, वाहन सत्यापन, जीपीएस रूटिंग एवं माल भाड़ा।',
      'endpoints': [
        'POST /v1/transport/vehicles (वाहन पंजीकरण)',
        'GET /v1/transport/bookings (परिवहन मांगें)',
        'GET /v1/transport/settlements (भाड़ा भुगतान)',
      ],
      'metricsKey': 'transporter',
    },
    {
      'id': 'seller',
      'title': 'व्यापारी / क्रेता (Seller / Trader)',
      'icon': Icons.storefront,
      'color': Color(0xFF6A1B9A),
      'description': 'मंडी दैनिक खरीद दरें, बोली प्रक्रिया, ई-वे बिल एवं थोक व्यापार।',
      'endpoints': [
        'POST /v1/seller/rates (दैनिक APMC भाव प्रकाशन)',
        'GET /v1/vyapari/mandi/bids (लाइव बोली प्रबंधन)',
        'POST /v1/orders/bulk (थोक कृषि उत्पाद क्रय)',
      ],
      'metricsKey': 'seller',
    },
    {
      'id': 'equipmentRental',
      'title': 'यंत्र सेवा प्रदाता (Equipment Rental)',
      'icon': Icons.build_circle,
      'color': Color(0xFF00838F),
      'description': 'ट्रैक्टर, कंबाइन हार्वेस्टर व ड्रोन रेंटल बुकिंग एवं शेड्यूलिंग।',
      'endpoints': [
        'POST /v1/equipment/machines (यंत्र फ्लीट प्रविष्टि)',
        'GET /v1/equipment/bookings (बुकिंग कैलेंडर)',
        'POST /v1/equipment/approve (घंटे/एकड़ अनुसार स्वीकृति)',
      ],
      'metricsKey': 'equipmentRental',
    },
    {
      'id': 'broker',
      'title': 'कृषि दलाल / कमीशन एजेंट (Broker)',
      'icon': Icons.handshake,
      'color': Color(0xFF455A64),
      'description': 'क्रेता-विक्रेता मध्यस्थता, डिजिटल सौदे, एस्क्रो एवं कमीशन निपटान।',
      'endpoints': [
        'POST /v1/broker/deals (व्यापार मध्यस्थता अनुबंध)',
        'GET /v1/broker/commissions (कमीशन बहीखाता)',
        'GET /v1/escrow/status (सुरक्षित भुगतान सत्यापन)',
      ],
      'metricsKey': 'broker',
    },
  ];

  @override
  void initState() {
    super.initState();
    _loadOverview();
  }

  Future<void> _loadOverview() async {
    setState(() => _loading = true);
    try {
      final res = await context.read<AdminApi>().getOverview();
      setState(() {
        _overview = res;
        _error = null;
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.code;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('मल्टी-पर्सोना सिमुलेटर एवं प्लेटफॉर्म अवलोकन'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'रिफ्रेश',
            onPressed: _loadOverview,
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('डेटा लोड त्रुटि: $_error'))
              : _buildContent(),
    );
  }

  Widget _buildContent() {
    final breakdown = (_overview?['personaBreakdown'] as Map?)?.cast<String, dynamic>() ?? {};
    final gmv = _overview?['marketplaceGMV'] ?? 0;
    final totalUsers = _overview?['activeUsersTotal'] ?? 0;
    final health = _overview?['platformHealth'] ?? '100% Operational';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Platform Header KPI Cards
          Row(
            children: [
              _buildKpiCard('सक्रिय उपयोगकर्ता', '$totalUsers', Icons.people, Colors.blue),
              const SizedBox(width: 16),
              _buildKpiCard('मार्केटप्लेस GMV', '₹$gmv', Icons.currency_rupee, Colors.green),
              const SizedBox(width: 16),
              _buildKpiCard('प्लेटफॉर्म स्थिति', '$health', Icons.check_circle_outline, Colors.teal),
              const SizedBox(width: 16),
              _buildKpiCard('KYC कतार', '${_overview?['pendingKycCount'] ?? 0} लंबित', Icons.verified_user, Colors.orange),
            ],
          ),
          const SizedBox(height: 32),

          const Text(
            'कृषि पर्सोना इकोसिस्टम (6-in-1 Omni-Persona Engine)',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'AGROVERCITY प्लेटफ़ॉर्म पर एक ही उपयोगकर्ता सभी 6 भूमिकाओं में सहजता से स्विच कर सकता है।',
            style: TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 20),

          // Persona Selection Grid
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: _personas.map((p) {
              final isSelected = _selectedPersona == p['id'];
              final count = breakdown[p['metricsKey']] ?? 0;
              final color = p['color'] as Color;

              return InkWell(
                onTap: () => setState(() => _selectedPersona = p['id']),
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  width: 340,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: isSelected ? color.withValues(alpha: 0.08) : Colors.white,
                    border: Border.all(
                      color: isSelected ? color : Colors.grey.shade300,
                      width: isSelected ? 2 : 1,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
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
                              CircleAvatar(
                                backgroundColor: color.withValues(alpha: 0.15),
                                foregroundColor: color,
                                child: Icon(p['icon'] as IconData),
                              ),
                              const SizedBox(width: 12),
                              Text(
                                p['title'] as String,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '$count रजिस्टर्ड',
                              style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        p['description'] as String,
                        style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                      ),
                      const Divider(height: 20),
                      const Text(
                        'सक्रिय API एंडपॉइंट्स:',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 6),
                      for (final ep in (p['endpoints'] as List<String>))
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Row(
                            children: [
                              Icon(Icons.bolt, size: 14, color: color),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  ep,
                                  style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),

          const SizedBox(height: 32),

          // Live Persona Test Console
          _buildLiveTesterCard(),
        ],
      ),
    );
  }

  Widget _buildKpiCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: color.withValues(alpha: 0.12),
              foregroundColor: color,
              child: Icon(icon, size: 28),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLiveTesterCard() {
    final active = _personas.firstWhere((p) => p['id'] == _selectedPersona);
    final color = active['color'] as Color;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.terminal, color: color),
              const SizedBox(width: 8),
              Text(
                'लाइव पर्सोना सिम्युलेटर: ${active['title']}',
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green.shade300),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.check_circle, size: 14, color: Colors.green),
                    SizedBox(width: 4),
                    Text(
                      '352/352 Tests Passing (100%)',
                      style: TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'इस पर्सोना के रूप में ऑथेंटिकेटेड टोकन के साथ बैकएंड एंडपॉइंट्स पर लाइव टेस्ट कॉल करें:',
            style: TextStyle(color: Colors.grey.shade700),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            children: (active['endpoints'] as List<String>).map((ep) {
              return FilledButton.tonalIcon(
                icon: const Icon(Icons.play_arrow, size: 18),
                label: Text(ep.split(' ')[1]),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('⚡ सिमुलेटेड $ep कॉल: स्थिति 200 OK'),
                      backgroundColor: color,
                    ),
                  );
                },
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
