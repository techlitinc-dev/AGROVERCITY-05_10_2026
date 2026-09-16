// Module F: Direct-to-Buyer Marketplace & Logistics Flutter View

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';

class BuyersView extends StatefulWidget {
  final AppState state;
  const BuyersView({super.key, required this.state});

  @override
  State<BuyersView> createState() => _BuyersViewState();
}

class _BuyersViewState extends State<BuyersView> {
  int _selectedTab = 0; // 0: Contracts, 1: Logistics
  double _distanceKm = 25;
  String _selectedVehicle = 'tata-ace';

  void _showContractDetails(BuyerContract c) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text("अनुबंध: ${c.buyerCompany}", style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("फसल: ${c.crop}\nलॉक दर: ₹${c.lockedRateQuintal}/क्विंटल (${c.premiumAboveMSP})\nन्यूनतम मात्रा: ${c.minQuantityQuintals} क्विंटल\nडिलीवरी: ${c.deliveryLocation}\nभुगतान: ${c.paymentTerms}", style: const TextStyle(fontSize: 12.5, height: 1.5)),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("बंद करें")),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              widget.state.acceptContract(c.id);
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332)),
            child: const Text("डिजिटल हस्ताक्षर करें (E-Sign)", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("सीधा खरीदार व अनुबंध खेती", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text("बुवाई पूर्व भाव लॉक • डिजिटल एग्रीमेंट • परिवहन", style: TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              const AudioButton(text: "सीधे खरीदारों से बुवाई से पहले भाव तय करें और बिना बिचौलियों के अधिक मुनाफा कमाएं।"),
            ],
          ),
          const SizedBox(height: 14),

          // Tabs
          Row(
            children: [
              _tabBtn(0, "🤝 बुवाई पूर्व मूल्य लॉक अनुबंध"),
              const SizedBox(width: 8),
              _tabBtn(1, "🚚 कृषि वाहन बुकिंग (Logistics)"),
            ],
          ),
          const SizedBox(height: 14),

          if (_selectedTab == 0) ...widget.state.contracts.map((c) => _buildContractCard(c)),
          if (_selectedTab == 1) _buildLogisticsTool(),
        ],
      ),
    );
  }

  Widget _tabBtn(int idx, String label) {
    final active = _selectedTab == idx;
    return GestureDetector(
      onTap: () => setState(() => _selectedTab = idx),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF1B4332) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: active ? const Color(0xFF1B4332) : Colors.grey.shade300),
        ),
        child: Text(label, style: TextStyle(fontSize: 12, fontWeight: active ? FontWeight.w800 : FontWeight.w600, color: active ? Colors.white : Colors.black87)),
      ),
    );
  }

  Widget _buildContractCard(BuyerContract c) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(c.contractDuration, style: const TextStyle(fontSize: 10.5, color: Colors.purple, fontWeight: FontWeight.w700)),
                  Text(c.buyerCompany, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
                  Text(c.crop, style: const TextStyle(fontSize: 12, color: Colors.black54)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: const Color(0xFFD8F3DC), borderRadius: BorderRadius.circular(8)),
                child: Text(c.premiumAboveMSP, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF166534))),
              ),
            ],
          ),
          const SizedBox(height: 10),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("गारंटीड लॉक भाव", style: TextStyle(fontSize: 11, color: Colors.grey)),
                  Text("₹${c.lockedRateQuintal}/q", style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF1B4332))),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text("न्यूनतम मात्रा", style: TextStyle(fontSize: 11, color: Colors.grey)),
                  Text("${c.minQuantityQuintals} क्विंटल", style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _showContractDetails(c),
                  child: const Text("शर्तें देखें", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => widget.state.acceptContract(c.id),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white),
                  child: Text(c.status.contains('Signed') ? "अनुबंध पुष्ट ✅" : "भाव लॉक करें", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLogisticsTool() {
    final vehicleRates = {
      'tata-ace': {'name': 'Tata Ace (छोटा हाथी - 1.5 टन)', 'base': 600, 'km': 22},
      'bolero-maxi': {'name': 'Mahindra Bolero Maxi (2.5 टन)', 'base': 950, 'km': 28},
      'tractor-trolley': {'name': 'ट्रैक्टर ट्रॉली (5 टन)', 'base': 1200, 'km': 35},
    };

    final v = vehicleRates[_selectedVehicle]!;
    final totalCost = (v['base'] as int) + (_distanceKm * (v['km'] as int)).toInt();

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("🚚 कृषि परिवहन वाहन बुकिंग", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _selectedVehicle,
            decoration: const InputDecoration(labelText: "वाहन प्रकार", border: OutlineInputBorder()),
            items: vehicleRates.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value['name'] as String, style: const TextStyle(fontSize: 12)))).toList(),
            onChanged: (val) => setState(() => _selectedVehicle = val!),
          ),
          const SizedBox(height: 12),
          Text("दूरी: ${_distanceKm.toInt()} km", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          Slider(min: 5, max: 100, value: _distanceKm, onChanged: (val) => setState(() => _distanceKm = val), activeColor: const Color(0xFF1B4332)),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0xFFD8F3DC), borderRadius: BorderRadius.circular(12)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text("अनुमानित कुल भाड़ा:", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF1B4332))),
                Text("₹$totalCost", style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: Color(0xFF1B4332))),
              ],
            ),
          ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: () => widget.state.showToast("वाहन बुक हुआ! चालक 45 मिनट में पहुंचेगा।"),
            icon: const Icon(Icons.local_shipping_rounded, size: 16),
            label: const Text("अभी वाहन बुक करें", style: TextStyle(fontWeight: FontWeight.w800)),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 44)),
          ),
        ],
      ),
    );
  }
}
