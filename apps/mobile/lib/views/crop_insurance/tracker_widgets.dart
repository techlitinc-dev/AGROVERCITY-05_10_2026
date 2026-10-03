// Tracker tab widgets (split from tracker_section.dart for the line cap):
// 4-stage step timeline, surveyor contact box, DBT transfer row.

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../components/common/motion_animations.dart';
import '../../models/insurance_models.dart';

class SurveyorContactBox extends StatelessWidget {
  final InsuranceClaimRecord claim;

  const SurveyorContactBox({super.key, required this.claim});

  Future<void> _call() async {
    final phone = claim.surveyorPhone;
    if (phone == null || phone.isEmpty) return;
    try {
      await launchUrl(Uri.parse('tel:$phone'));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 18,
            backgroundColor: Color(0xFF047857),
            child: Icon(Icons.person_pin_rounded, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(claim.surveyorName!, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                Text(
                  claim.surveyorVisitDate ?? "खेत दौरा शीघ्र",
                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF047857), fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          BouncyPressable(
            onTap: _call,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFF047857),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.call_rounded, color: Colors.white, size: 16),
            ),
          ),
        ],
      ),
    );
  }
}

class DbtRow extends StatelessWidget {
  final InsuranceClaimRecord claim;

  const DbtRow({super.key, required this.claim});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF86EFAC)),
      ),
      child: Row(
        children: [
          const Icon(Icons.verified_rounded, color: Color(0xFF16A34A), size: 16),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              "DBT ट्रांसफर पूर्ण: A/C ending **${claim.bankAccountLast4} | Txn: ${claim.dbtTransactionId}",
              style: const TextStyle(fontSize: 10.5, color: Color(0xFF166534), fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class ClaimStepTimeline extends StatelessWidget {
  final String status;

  const ClaimStepTimeline({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final currentStep = switch (status) {
      'intimated' => 1,
      'surveyorAssigned' => 2,
      'fieldAssessed' => 3,
      'dbtApproved' || 'disbursed' => 4,
      'rejected' => 0,
      _ => 1,
    };

    final steps = ['सूचना दर्ज', 'सर्वेक्षक', 'सत्यापन', 'DBT भुगतान'];

    return Row(
      children: List.generate(steps.length, (idx) {
        final stepNum = idx + 1;
        final isDone = stepNum <= currentStep;
        final isCurrent = stepNum == currentStep;

        return Expanded(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        color: isDone ? const Color(0xFF047857) : Colors.grey.shade200,
                        shape: BoxShape.circle,
                        border: isCurrent ? Border.all(color: const Color(0xFFFBBF24), width: 2) : null,
                      ),
                      child: Center(
                        child: isDone
                            ? const Icon(Icons.check_rounded, color: Colors.white, size: 14)
                            : Text("$stepNum", style: const TextStyle(fontSize: 10, color: Colors.black54, fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      steps[idx],
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: isDone ? FontWeight.w800 : FontWeight.w500,
                        color: isDone ? const Color(0xFF047857) : Colors.grey.shade500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
              if (idx < steps.length - 1)
                Container(
                  height: 2,
                  width: 14,
                  color: (idx + 1 < currentStep) ? const Color(0xFF047857) : Colors.grey.shade300,
                ),
            ],
          ),
        );
      }),
    );
  }
}
