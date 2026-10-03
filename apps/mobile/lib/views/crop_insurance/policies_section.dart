// Tab 1: Digital policy passbook + quick-apply sheet (Day 11 B1.3).

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/api_exception.dart';
import '../../api/insurance_api.dart';
import '../../components/common/motion_animations.dart';
import '../../models/insurance_models.dart';
import 'insurance_header.dart';
import 'policy_apply_sheet.dart';
import 'policy_card.dart';

class PoliciesSection extends StatelessWidget {
  final List<CropInsurancePolicy> policies;
  final List<CropPremiumRate> rates;
  final InsuranceApi api;
  final Future<void> Function() onRefresh;
  final void Function(CropInsurancePolicy policy) onFileClaim;

  const PoliciesSection({
    super.key,
    required this.policies,
    required this.rates,
    required this.api,
    required this.onRefresh,
    required this.onFileClaim,
  });

  void _snack(BuildContext context, String message) {
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _downloadCertificate(
      BuildContext context, CropInsurancePolicy pol) async {
    try {
      final url = await api.getCertificate(pol.id);
      if (url == null || url.isEmpty) {
        throw const ApiException(code: 'CERT_UNAVAILABLE');
      }
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {
      if (context.mounted) _snack(context, 'प्रमाणपत्र उपलब्ध नहीं — पुनः प्रयास करें');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              "सक्रिय ई-पॉलिसी डिजिटल पासबुक",
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
            ),
            TextButton.icon(
              onPressed: launchPmfbyPortal,
              icon: const Icon(Icons.open_in_new_rounded, size: 14, color: Color(0xFF047857)),
              label: const Text("PMFBY पोर्टल", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF047857))),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (policies.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Center(
              child: Text('कोई पॉलिसी नहीं मिली',
                  style: TextStyle(fontSize: 12.5, color: Colors.grey)),
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: policies.length,
            separatorBuilder: (ctx, i) => const SizedBox(height: 12),
            itemBuilder: (context, index) => StaggeredSlideFade(
              delayMs: index * 60,
              duration: const Duration(milliseconds: 350),
              child: PolicyCard(
                policy: policies[index],
                onCertificate: () => _downloadCertificate(context, policies[index]),
                onFileClaim: () => onFileClaim(policies[index]),
              ),
            ),
          ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFF0FDF4), Color(0xFFDCFCE7)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFF86EFAC)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: const BoxDecoration(
                  color: Color(0xFF047857),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.add_moderator_rounded, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "नई फसल बीमा पॉलिसी जोड़ें",
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: Color(0xFF064E3B)),
                    ),
                    SizedBox(height: 2),
                    Text(
                      "KCC खाता अथवा गैर-ऋणी किसान PMFBY पोर्टल से सीधी पॉलिसी जारी करें",
                      style: TextStyle(fontSize: 11, color: Color(0xFF047857)),
                    ),
                  ],
                ),
              ),
              ElevatedButton(
                onPressed: () => _openApplySheet(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF047857),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text("आवेदन", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _openApplySheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => PolicyApplySheet(
        rates: rates,
        api: api,
        onApplied: (policy) async {
          _snack(context, 'पॉलिसी जारी: ${policy.policyNumber}');
          await onRefresh();
        },
      ),
    );
  }
}
