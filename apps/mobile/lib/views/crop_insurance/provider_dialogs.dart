// Dialogs and action sheets for Insurance Provider workflow

import 'package:flutter/material.dart';
import '../../api/insurance_api.dart';
import '../../models/insurance_models.dart';

class ProviderDialogs {
  static Future<bool?> showApprovePolicyDialog(
    BuildContext context,
    CropInsurancePolicy policy,
    InsuranceApi api,
  ) {
    final noteCtrl = TextEditingController(text: 'Underwriting verification complete. Policy approved.');
    bool submitting = false;

    return showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Color(0xFF0F766E)),
              const SizedBox(width: 8),
              const Text('पॉलिसी स्वीकृति (Approve)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'पॉलिसी: ${policy.policyNumber} (${policy.cropName})',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              const SizedBox(height: 4),
              Text(
                'किसान: ${policy.farmerName ?? "किसान"} • ${policy.landAreaAcres} एकड़',
                style: const TextStyle(color: Colors.grey, fontSize: 12),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteCtrl,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: 'अंडरराइटर टिप्पणी (Notes)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('रद्द करें'),
            ),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      setState(() => submitting = true);
                      try {
                        await api.reviewPolicy(
                          policy.id,
                          action: 'approve',
                          underwriterNotes: noteCtrl.text.trim(),
                        );
                        if (ctx.mounted) Navigator.pop(ctx, true);
                      } catch (_) {
                        if (ctx.mounted) {
                          setState(() => submitting = false);
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            const SnackBar(content: Text('स्वीकृति विफल — पुनः प्रयास करें')),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
                foregroundColor: Colors.white,
              ),
              child: Text(submitting ? 'स्वीकृत हो रहा...' : 'स्वीकृत करें'),
            ),
          ],
        ),
      ),
    );
  }

  static Future<bool?> showRejectPolicyDialog(
    BuildContext context,
    CropInsurancePolicy policy,
    InsuranceApi api,
  ) {
    final reasonCtrl = TextEditingController(text: 'खसरा संख्या राजस्व अभिलेख से मेल नहीं खाती');
    bool submitting = false;

    return showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              const Icon(Icons.cancel_rounded, color: Color(0xFFDC2626)),
              const SizedBox(width: 8),
              const Text('पॉलिसी अस्वीकृति (Reject)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'पॉलिसी: ${policy.policyNumber} (${policy.cropName})',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: reasonCtrl,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: 'अस्वीकृति का कारण (अनिवार्य)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('रद्द करें'),
            ),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      final reason = reasonCtrl.text.trim();
                      if (reason.isEmpty) return;
                      setState(() => submitting = true);
                      try {
                        await api.reviewPolicy(
                          policy.id,
                          action: 'reject',
                          rejectionReason: reason,
                        );
                        if (ctx.mounted) Navigator.pop(ctx, true);
                      } catch (_) {
                        if (ctx.mounted) {
                          setState(() => submitting = false);
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            const SnackBar(content: Text('अस्वीकृति विफल — पुनः प्रयास करें')),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
              ),
              child: Text(submitting ? 'अस्वीकृत हो रहा...' : 'अस्वीकृत करें'),
            ),
          ],
        ),
      ),
    );
  }

  static Future<bool?> showAssignSurveyorDialog(
    BuildContext context,
    InsuranceClaimRecord claim,
    InsuranceApi api,
  ) {
    final nameCtrl = TextEditingController(text: 'संदीप कुलकर्णी');
    final phoneCtrl = TextEditingController(text: '+919811000001');
    final dateCtrl = TextEditingController(
      text: DateTime.now().add(const Duration(days: 2)).toIso8601String().substring(0, 10),
    );
    bool submitting = false;

    return showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('सर्वेयर नियुक्ति (Assign Surveyor)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: InputDecoration(
                  labelText: 'सर्वेयर का नाम',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: phoneCtrl,
                decoration: InputDecoration(
                  labelText: 'मोबाइल नंबर',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: dateCtrl,
                decoration: InputDecoration(
                  labelText: 'निरीक्षण तिथि (YYYY-MM-DD)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('रद्द करें')),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      setState(() => submitting = true);
                      try {
                        await api.scheduleClaimSurvey(
                          claim.id,
                          surveyorName: nameCtrl.text.trim(),
                          surveyorPhone: phoneCtrl.text.trim(),
                          surveyorVisitDate: dateCtrl.text.trim(),
                        );
                        if (ctx.mounted) Navigator.pop(ctx, true);
                      } catch (_) {
                        if (ctx.mounted) {
                          setState(() => submitting = false);
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            const SnackBar(content: Text('नियुक्ति विफल — पुनः प्रयास करें')),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0F766E), foregroundColor: Colors.white),
              child: Text(submitting ? 'प्रक्रियाधीन...' : 'सर्वेयर नियुक्त करें'),
            ),
          ],
        ),
      ),
    );
  }

  static Future<bool?> showSanctionClaimDialog(
    BuildContext context,
    InsuranceClaimRecord claim,
    InsuranceApi api,
  ) {
    final amtCtrl = TextEditingController(text: '${claim.requestedAmount.toInt()}');
    bool submitting = false;

    return showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('दावा स्वीकृति (Approve & Sanction)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('दावा: ${claim.claimNumber} • ${claim.cropName}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 4),
              Text('मांग राशि: ₹${claim.requestedAmount.toInt()}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
              const SizedBox(height: 12),
              TextField(
                controller: amtCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'स्वीकृत राशि (₹)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('रद्द करें')),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      final amt = double.tryParse(amtCtrl.text.trim()) ?? claim.requestedAmount;
                      setState(() => submitting = true);
                      try {
                        await api.reviewClaim(claim.id, action: 'approve', approvedAmount: amt);
                        if (ctx.mounted) Navigator.pop(ctx, true);
                      } catch (_) {
                        if (ctx.mounted) {
                          setState(() => submitting = false);
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            const SnackBar(content: Text('स्वीकृति विफल — पुनः प्रयास करें')),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A), foregroundColor: Colors.white),
              child: Text(submitting ? 'स्वीकृत हो रहा...' : 'DBT हेतु स्वीकृत करें'),
            ),
          ],
        ),
      ),
    );
  }

  static Future<bool?> showDisburseClaimDialog(
    BuildContext context,
    InsuranceClaimRecord claim,
    InsuranceApi api,
  ) {
    final dbtRef = 'DBT${DateTime.now().millisecondsSinceEpoch.toString().substring(3)}';
    final refCtrl = TextEditingController(text: dbtRef);
    bool submitting = false;

    return showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('DBT प्रेषण (Direct Benefit Transfer)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('दावा: ${claim.claimNumber} • ₹${(claim.approvedAmount ?? claim.requestedAmount).toInt()}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 12),
              TextField(
                controller: refCtrl,
                decoration: InputDecoration(
                  labelText: 'DBT संदर्भ संख्या (Transaction Ref)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('रद्द करें')),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      setState(() => submitting = true);
                      try {
                        await api.disburseClaim(claim.id, dbtTransactionId: refCtrl.text.trim());
                        if (ctx.mounted) Navigator.pop(ctx, true);
                      } catch (_) {
                        if (ctx.mounted) {
                          setState(() => submitting = false);
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            const SnackBar(content: Text('प्रेषण विफल — पुनः प्रयास करें')),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0F766E), foregroundColor: Colors.white),
              child: Text(submitting ? 'वितरित हो रहा...' : 'राशि वितरित करें'),
            ),
          ],
        ),
      ),
    );
  }
}
