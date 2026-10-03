// Tab 3: PMFBY premium & subsidy calculator — rates come from
// GET /v1/insurance/rates?season= and math recomputes client-side (B1.5).

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../components/common/glass_card.dart';
import '../../components/common/motion_animations.dart';
import '../../models/insurance_models.dart';
import 'insurance_header.dart';

final _rupee =
    NumberFormat.currency(locale: 'hi_IN', symbol: '₹', decimalDigits: 0);

class CalculatorSection extends StatefulWidget {
  final List<CropPremiumRate> rates;
  final String season;
  final void Function(String season) onSeasonChanged;

  const CalculatorSection({
    super.key,
    required this.rates,
    required this.season,
    required this.onSeasonChanged,
  });

  @override
  State<CalculatorSection> createState() => _CalculatorSectionState();
}

class _CalculatorSectionState extends State<CalculatorSection> {
  String? _calcCrop;
  double _calcAcres = 2.0;

  @override
  void initState() {
    super.initState();
    _syncCrop();
  }

  @override
  void didUpdateWidget(CalculatorSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncCrop();
  }

  void _syncCrop() {
    final crops = widget.rates.map((r) => r.cropName).toList();
    if (_calcCrop == null || !crops.contains(_calcCrop)) {
      _calcCrop = crops.isNotEmpty ? crops.first : null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final rates = widget.rates;
    final currentRate = rates.cast<CropPremiumRate?>().firstWhere(
          (r) => r?.cropName == _calcCrop,
          orElse: () => null,
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          "PMFBY फसल बीमा प्रीमियम कैलकुलेटर",
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
        ),
        const SizedBox(height: 4),
        const Text(
          "खरीफ खाद्यान्न: 2% • रबी: 1.5% • बागवानी/वाणिज्यिक: 5% (शेष सब्सिडी सरकार द्वारा)",
          style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 12),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _seasonChip("Kharif", "खरीफ (2%)"),
                  const SizedBox(width: 8),
                  _seasonChip("Rabi", "रबी (1.5%)"),
                  const SizedBox(width: 8),
                  _seasonChip("Annual", "बागवानी (5%)"),
                ],
              ),
              const SizedBox(height: 16),
              const Text("फसल चुनें (Choose Crop)", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _calcCrop,
                    isExpanded: true,
                    items: rates.map((r) {
                      return DropdownMenuItem(
                        value: r.cropName,
                        child: Text(
                          "${r.cropName} (${r.category})",
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                        ),
                      );
                    }).toList(),
                    onChanged: (v) {
                      if (v != null) setState(() => _calcCrop = v);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("जमीन रकबा (Land Area in Acres)", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF047857),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      "${_calcAcres.toStringAsFixed(1)} एकड़",
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12),
                    ),
                  ),
                ],
              ),
              Slider(
                min: 0.5,
                max: 20.0,
                divisions: 39,
                value: _calcAcres,
                activeColor: const Color(0xFF047857),
                onChanged: (v) => setState(() => _calcAcres = v),
              ),
              const SizedBox(height: 12),
              if (currentRate == null)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Center(
                    child: Text('इस सीज़न की दरें उपलब्ध नहीं',
                        style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ),
                )
              else
                _ResultCard(rate: currentRate, acres: _calcAcres),
              const SizedBox(height: 14),
              ElevatedButton.icon(
                onPressed: launchPmfbyPortal,
                icon: const Icon(Icons.bolt_rounded, size: 16),
                label: const Text("PMFBY पोर्टल पर पॉलिसी जारी करें", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF047857),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 44),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _seasonChip(String seasonKey, String label) {
    final isSelected = widget.season.toLowerCase() == seasonKey.toLowerCase();
    return Expanded(
      child: BouncyPressable(
        onTap: () => widget.onSeasonChanged(seasonKey),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF047857) : Colors.grey.shade100,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: isSelected ? const Color(0xFF047857) : Colors.grey.shade300),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? Colors.white : Colors.black87,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  final CropPremiumRate rate;
  final double acres;

  const _ResultCard({required this.rate, required this.acres});

  @override
  Widget build(BuildContext context) {
    final sumInsured = rate.sumInsuredPerAcre * acres;
    final farmerPremium = sumInsured * rate.farmerSharePercent / 100;
    final govtShare =
        sumInsured * (rate.totalActuarialRatePercent - rate.farmerSharePercent) / 100;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF064E3B), Color(0xFF022C22)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("कुल बीमित सुरक्षा राशि (Sum Insured):", style: TextStyle(color: Color(0xFFE2E8F0), fontSize: 12)),
              Text(
                _rupee.format(sumInsured),
                style: const TextStyle(color: Color(0xFFFDE68A), fontWeight: FontWeight.w900, fontSize: 18),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, color: Colors.white24),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "किसान की देय प्रीमियम (${rate.farmerSharePercent}%)",
                    style: const TextStyle(color: Colors.white70, fontSize: 11),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _rupee.format(farmerPremium),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text("सरकारी सब्सिडी (Govt Share)", style: TextStyle(color: Color(0xFF86EFAC), fontSize: 11)),
                  const SizedBox(height: 2),
                  Text(
                    _rupee.format(govtShare),
                    style: const TextStyle(color: Color(0xFF86EFAC), fontWeight: FontWeight.w900, fontSize: 18),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text("आवेदन की अंतिम तिथि (Cutoff Date):", style: TextStyle(color: Color(0xFFE2E8F0), fontSize: 10.5)),
                Text(rate.cutoffDate, style: const TextStyle(color: Color(0xFFFDE68A), fontWeight: FontWeight.w800, fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
