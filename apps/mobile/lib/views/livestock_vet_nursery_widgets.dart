// Livestock & Dairy — nursery / vet doctor / dairy product cards (split
// from livestock_dairy_view.dart for the line cap; verbatim styling).

import 'package:flutter/material.dart';

import '../components/common/glass_card.dart';
import '../models/livestock_models.dart';
import '../state/app_state.dart';

class NurseryCard extends StatelessWidget {
  final AppState state;
  final PlantNursery nursery;
  final VoidCallback onCall;

  const NurseryCard({super.key, required this.state, required this.nursery, required this.onCall});

  @override
  Widget build(BuildContext context) {
    final n = nursery;
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  n.vernacularName,
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                ),
              ),
              if (n.isGovtCertified)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(state.tr('livestock.govtCertified'), style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFF15803D))),
                ),
            ],
          ),
          Text(
            '${state.tr('livestock.owner')} ${n.ownerName} • ${n.location} (${n.distanceKm} km)',
            style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 8),
          Text(state.tr('livestock.availableSaplings'), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF1B5E20))),
          const SizedBox(height: 4),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: n.availableSaplings.map((s) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(6), border: Border.all(color: const Color(0xFFBBF7D0))),
              child: Text(s, style: const TextStyle(fontSize: 10.5, color: Color(0xFF166534), fontWeight: FontWeight.w700)),
            )).toList(),
          ),
          const SizedBox(height: 8),
          Text('${state.tr('livestock.priceRange')} ${n.priceRange}', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFFD97706))),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: onCall,
                  icon: const Icon(Icons.call_rounded, size: 14, color: Colors.white),
                  label: const Text("रोपे उपलब्धता विचारा", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1B4332),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class VetDoctorCard extends StatelessWidget {
  final VetDoctor doctor;
  final VoidCallback onCall;
  final VoidCallback onBook;

  const VetDoctorCard({
    super.key,
    required this.doctor,
    required this.onCall,
    required this.onBook,
  });

  @override
  Widget build(BuildContext context) {
    final doc = doctor;
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFFE0F2FE),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.medical_services_rounded, color: Color(0xFF0284C7), size: 24),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(doc.name, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F))),
                        ),
                        if (doc.emergencyAvailable) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEE2E2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text("24x7 🚨", style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Color(0xFF991B1B))),
                          ),
                        ],
                      ],
                    ),
                    Text("${doc.qualification} • ${doc.experienceYears} वर्षे अनुभव", style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                    Text("तज्ज्ञता: ${doc.specialization}", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF0369A1))),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            "दवाखाना: ${doc.clinicAddress} (${doc.distanceKm} km)",
            style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.access_time_filled_rounded, size: 13, color: Color(0xFF15803D)),
              const SizedBox(width: 4),
              Expanded(
                child: Text(doc.nextAvailableSlot, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF15803D))),
              ),
              Text(
                "सल्ला फी: ₹${doc.consultationFeeRupees}",
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF15803D)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onCall,
                  icon: const Icon(Icons.phone_rounded, size: 14),
                  label: const Text("थेट कॉल", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF0284C7),
                    side: const BorderSide(color: Color(0xFF0284C7)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: onBook,
                  icon: const Icon(Icons.calendar_month_rounded, size: 14, color: Colors.white),
                  label: const Text("सल्ला / शेतावर भेट बुक करा", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

