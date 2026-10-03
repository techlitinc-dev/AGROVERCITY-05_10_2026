// Policy passbook card (split from policies_section.dart for the 300-line
// file rule).

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/insurance_models.dart';

final _rupee =
    NumberFormat.currency(locale: 'hi_IN', symbol: '₹', decimalDigits: 0);

class PolicyCard extends StatelessWidget {
  final CropInsurancePolicy policy;
  final VoidCallback onCertificate;
  final VoidCallback onFileClaim;

  const PolicyCard({
    super.key,
    required this.policy,
    required this.onCertificate,
    required this.onFileClaim,
  });

  @override
  Widget build(BuildContext context) {
    final pol = policy;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
              borderRadius: BorderRadius.vertical(top: Radius.circular(19)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.verified_user_rounded, color: Color(0xFFFBBF24), size: 16),
                    const SizedBox(width: 6),
                    Text(
                      pol.policyNumber,
                      style: const TextStyle(
                        color: Color(0xFFFDE68A),
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: pol.isPending
                        ? const Color(0xFFD97706)
                        : (pol.isRejected
                            ? const Color(0xFFDC2626)
                            : const Color(0xFF047857)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    pol.isPending
                        ? "समीक्षाधीन"
                        : (pol.isRejected ? "अस्वीकृत" : (pol.isActive ? "सक्रिय" : pol.status)),
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          pol.cropName,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          "${pol.schemeName} • ${pol.landAreaAcres} एकड़",
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text("कुल बीमित राशि", style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                        Text(
                          _rupee.format(pol.sumInsured),
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF047857)),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text("किसान प्रीमियम अंश", style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                            const SizedBox(height: 2),
                            Text(_rupee.format(pol.farmerPremium), style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDF4),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFBBF7D0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text("सरकारी अनुदान (Subsidy)", style: TextStyle(fontSize: 10, color: Color(0xFF166534))),
                            const SizedBox(height: 2),
                            Text(_rupee.format(pol.govtSubsidy), style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Color(0xFF166534))),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Icon(Icons.account_balance_rounded, size: 14, color: Color(0xFF64748B)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        "${pol.insuranceCompany} • ${pol.bankName}",
                        style: const TextStyle(fontSize: 11, color: Color(0xFF475569), fontWeight: FontWeight.w600),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.event_available_rounded, size: 14, color: Color(0xFF047857)),
                    const SizedBox(width: 6),
                    Text(
                      "कवर अवधि: ${pol.coverageStartDate} से ${pol.coverageEndDate}",
                      style: const TextStyle(fontSize: 11, color: Color(0xFF047857), fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: onCertificate,
                        icon: const Icon(Icons.download_rounded, size: 15),
                        label: const Text("ई-प्रमाणपत्र PDF", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF047857),
                          side: const BorderSide(color: Color(0xFF047857)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: onFileClaim,
                        icon: const Icon(Icons.report_gmailerrorred_rounded, size: 15),
                        label: const Text("नुकसान क्लेम करें", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
