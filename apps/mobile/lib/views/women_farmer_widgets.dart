// Module I: Women Farmer tab cards (split from women_farmer_view.dart for
// the line cap). Prototype styling kept verbatim.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../components/common/glass_card.dart';
import '../models/women_models.dart';
import '../state/app_state.dart';

final inrFormat = NumberFormat('#,##,##0', 'en_IN');

class ShgCard extends StatelessWidget {
  final ShgProfile profile;
  final bool depositing;
  final VoidCallback onDeposit;
  final AppState state;

  const ShgCard({
    super.key,
    required this.profile,
    required this.depositing,
    required this.onDeposit,
    required this.state,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("जय मल्हार महिला बचत गट",
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFBE123C))),
              Text('${profile.memberCount} ${state.tr('women.members')}',
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFFBE123C))),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                      color: const Color(0xFFFFF1F2),
                      borderRadius: BorderRadius.circular(10)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(state.tr('women.totalSavingsCorpus'),
                          style: const TextStyle(
                              fontSize: 10.5, color: Color(0xFF9F1239))),
                      Text("₹${inrFormat.format(profile.corpus)}",
                          style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF881337))),
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
                      borderRadius: BorderRadius.circular(10)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(state.tr('women.activeLoanFund'),
                          style: const TextStyle(
                              fontSize: 10.5, color: Color(0xFF166534))),
                      Text("₹${inrFormat.format(profile.loanFund)}",
                          style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF14532D))),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: depositing ? null : onDeposit,
            icon: const Icon(Icons.add_rounded, size: 16),
            label: Text(state.tr('women.depositMonthly'),
                style: const TextStyle(fontWeight: FontWeight.w700)),
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE11D48),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 40)),
          ),
        ],
      ),
    );
  }
}

class EnterpriseIncomeCard extends StatelessWidget {
  final HomeEnterpriseSummary summary;
  final AppState state;

  const EnterpriseIncomeCard(
      {super.key, required this.summary, required this.state});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.tr('women.enterpriseTitle'),
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFFBE123C))),
          const SizedBox(height: 10),
          for (var i = 0; i < summary.lines.length; i++) ...[
            if (i > 0) const Divider(),
            _entItem(
                summary.lines[i].product,
                '+₹${inrFormat.format(summary.lines[i].monthlyProfit)} ${state.tr('women.perMonth')}'),
          ],
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
                color: const Color(0xFFFFF1F2),
                borderRadius: BorderRadius.circular(10)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(state.tr('women.totalMonthlyProfit'),
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, color: Color(0xFF881337))),
                Text("₹${inrFormat.format(summary.totalMonthlyProfit)}",
                    style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                        color: Color(0xFF881337))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _entItem(String title, String profit) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title,
            style:
                const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
        Text(profit,
            style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w800,
                color: Color(0xFF16A34A))),
      ],
    );
  }
}
