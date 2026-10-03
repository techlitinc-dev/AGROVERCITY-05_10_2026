// Tab 4: multi-stage claim status tracker + rejected-claim appeal entry
// (Day 11 B1.6, B5.1).

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../api/insurance_api.dart';
import '../../core/photo_upload.dart';
import '../../components/common/motion_animations.dart';
import '../../models/insurance_models.dart';
import 'appeal_sheet.dart';
import 'tracker_widgets.dart';

final _rupee =
    NumberFormat.currency(locale: 'hi_IN', symbol: '₹', decimalDigits: 0);

class TrackerSection extends StatelessWidget {
  final List<InsuranceClaimRecord> claims;
  final InsuranceApi api;
  final PhotoUploader? photoUploader;
  final Future<void> Function() onRefresh;

  const TrackerSection({
    super.key,
    required this.claims,
    required this.api,
    this.photoUploader,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          "दावा स्थिति व लाइव क्षति सत्यापन ट्रैकर",
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
        ),
        const SizedBox(height: 4),
        const Text(
          "सूचना दर्ज → सर्वेक्षक निरीक्षण → राज्य अनुमोदन → DBT बैंक अंतरण",
          style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 12),
        if (claims.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: Text('कोई दावा दर्ज नहीं',
                  style: TextStyle(fontSize: 12.5, color: Colors.grey)),
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: claims.length,
            separatorBuilder: (ctx, i) => const SizedBox(height: 14),
            itemBuilder: (context, idx) => StaggeredSlideFade(
              delayMs: idx * 60,
              duration: const Duration(milliseconds: 350),
              child: ClaimTrackerCard(
                claim: claims[idx],
                api: api,
                photoUploader: photoUploader,
                onRefresh: onRefresh,
              ),
            ),
          ),
      ],
    );
  }
}

class ClaimTrackerCard extends StatelessWidget {
  final InsuranceClaimRecord claim;
  final InsuranceApi api;
  final PhotoUploader? photoUploader;
  final Future<void> Function() onRefresh;

  const ClaimTrackerCard({
    super.key,
    required this.claim,
    required this.api,
    this.photoUploader,
    required this.onRefresh,
  });

  void _openAppeal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => AppealSheet(
        claim: claim,
        api: api,
        photoUploader: photoUploader,
        onAppealed: onRefresh,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final clm = claim;
    final isDisbursed = clm.status == 'disbursed';
    final isRejected = clm.status == 'rejected';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDisbursed
              ? const Color(0xFF86EFAC)
              : isRejected
                  ? const Color(0xFFFCA5A5)
                  : const Color(0xFFE2E8F0),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFBFDBFE)),
                        ),
                        child: Text(
                          clm.claimNumber,
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: Color(0xFF1E40AF)),
                        ),
                      ),
                      if (clm.appealCount > 0) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF7ED),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFFDBA74)),
                          ),
                          child: Text(
                            'अपील #${clm.appealCount}',
                            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFFEA580C)),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    clm.cropName,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    isDisbursed ? "स्वीकृत मुआवजा राशि" : "अनुमानित दावा",
                    style: const TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.w600),
                  ),
                  Text(
                    _rupee.format(clm.approvedAmount ?? clm.requestedAmount),
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      color: isDisbursed ? const Color(0xFF047857) : const Color(0xFFDC2626),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.thunderstorm_rounded, size: 14, color: Color(0xFFDC2626)),
                    const SizedBox(width: 6),
                    Text(
                      clm.calamityType,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF991B1B)),
                    ),
                  ],
                ),
                Text(
                  "${clm.estimatedLossPercent.toInt()}% फसल क्षति",
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFDC2626)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          ClaimStepTimeline(status: clm.status),
          const SizedBox(height: 14),
          if ((clm.surveyorName ?? '').isNotEmpty)
            SurveyorContactBox(claim: clm),
          if (isDisbursed && clm.dbtTransactionId != null) ...[
            const SizedBox(height: 10),
            DbtRow(claim: clm),
          ],
          if (isRejected) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFCA5A5)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'अस्वीकृति का कारण: ${clm.rejectionReason ?? (clm.timeline.isNotEmpty ? clm.timeline.last.note : 'दावा अस्वीकृत')}',
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF991B1B)),
                  ),
                  const SizedBox(height: 10),
                  ElevatedButton.icon(
                    onPressed: () => _openAppeal(context),
                    icon: const Icon(Icons.gavel_rounded, size: 15),
                    label: const Text('अपील करें / पुनः जमा करें',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFDC2626),
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 40),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
