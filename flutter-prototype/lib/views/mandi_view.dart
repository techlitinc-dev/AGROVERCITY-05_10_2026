// Module F/A: Live Mandi Rates & Profit Maximizer Flutter View

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../data/demo_data.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';

class MandiView extends StatefulWidget {
  final AppState state;
  const MandiView({super.key, required this.state});

  @override
  State<MandiView> createState() => _MandiViewState();
}

class _MandiViewState extends State<MandiView> {
  String _selectedCrop = 'all';
  double _produceQuintals = 50;

  @override
  Widget build(BuildContext context) {
    final mandis = dummyMandiPrices.where((m) {
      if (_selectedCrop == 'all') return true;
      return m.commodity.toLowerCase().contains(_selectedCrop.toLowerCase());
    }).toList();

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
                  Text("लाइव मंडी भाव व लाभ अनुकूलक", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text("APMC दरें • आवक • गाड़ी भाड़ा काटकर शुद्ध लाभ", style: TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              const AudioButton(text: "आज पिंपलगांव मंडी में टमाटर का भाव 1950 रुपये प्रति क्विंटल है।"),
            ],
          ),
          const SizedBox(height: 14),

          // Filters
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _filterChip('all', 'सभी फसलें'),
                _filterChip('tomato', '🍅 टमाटर'),
                _filterChip('onion', '🧅 प्याज'),
                _filterChip('wheat', '🌾 गेहूं'),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Mandi List
          ...mandis.map((m) => _buildMandiCard(m)),

          const SizedBox(height: 16),

          // Profit Maximizer Tool
          GlassCard(
            backgroundColor: const Color(0xFFF0FDF4),
            border: Border.all(color: const Color(0xFF86EFAC), width: 1.5),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.calculate_rounded, color: Color(0xFF16A34A), size: 20),
                    SizedBox(width: 8),
                    Text("स्मार्ट मंडी चयन कैलकुलेटर (Decision Tool)", style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: Color(0xFF14532D))),
                  ],
                ),
                const SizedBox(height: 6),
                const Text("भाड़ा काटकर किस मंडी में मिलेगा सर्वाधिक शुद्ध मुनाफा?", style: TextStyle(fontSize: 11.5, color: Color(0xFF166534))),
                const SizedBox(height: 12),

                Text("आपकी कुल उपज: ${_produceQuintals.toInt()} क्विंटल (Tomato)", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
                Slider(
                  min: 10,
                  max: 200,
                  value: _produceQuintals,
                  onChanged: (v) => setState(() => _produceQuintals = v),
                  activeColor: const Color(0xFF16A34A),
                ),

                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
                  child: Column(
                    children: [
                      _buildCalcRow("पिंपलगांव APMC (4.2km):", "₹${(_produceQuintals * 1950 - 800).toInt()}", false),
                      const Divider(height: 12),
                      _buildCalcRow("नासिक APMC (18.5km):", "₹${(_produceQuintals * 2150 - 1800).toInt()} (+₹8,200 अधिक!)", true),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String id, String label) {
    final sel = _selectedCrop == id;
    return GestureDetector(
      onTap: () => setState(() => _selectedCrop = id),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: sel ? const Color(0xFF1B4332) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: sel ? const Color(0xFF1B4332) : Colors.grey.shade300),
        ),
        child: Text(label, style: TextStyle(fontSize: 12, fontWeight: sel ? FontWeight.w800 : FontWeight.w500, color: sel ? Colors.white : Colors.black87)),
      ),
    );
  }

  Widget _buildMandiCard(MandiPrice m) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      border: Border(left: BorderSide(color: m.trend == 'up' ? const Color(0xFF16A34A) : Colors.red, width: 4)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("${m.distanceKm} km दूरी • ${m.updatedAt}", style: const TextStyle(fontSize: 10.5, color: Colors.grey)),
                  Text(m.mandiName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
                  Text("${m.commodity} • ${m.variety}", style: const TextStyle(fontSize: 12, color: Colors.black54)),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text("₹${m.modalPrice}", style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF1B4332))),
                  Text(m.changePercent, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: m.trend == 'up' ? const Color(0xFF16A34A) : Colors.red)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("न्यूनतम: ₹${m.minPrice} | अधिकतम: ₹${m.maxPrice}", style: const TextStyle(fontSize: 11.5, color: Colors.black87)),
              Text("आवक: ${m.arrivalsQuintals}q", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF1B4332))),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCalcRow(String label, String value, bool isBest) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(fontSize: 12, fontWeight: isBest ? FontWeight.w800 : FontWeight.w600, color: isBest ? const Color(0xFF166534) : Colors.black87)),
        Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: isBest ? const Color(0xFF16A34A) : Colors.black87)),
      ],
    );
  }
}
