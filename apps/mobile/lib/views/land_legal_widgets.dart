// Record card + disambiguation tile for LandLegalView (ported styling).

import 'package:flutter/material.dart';

import '../components/common/glass_card.dart';
import '../models/land_record.dart';
import '../state/app_state.dart';

class LandRecordCard extends StatelessWidget {
  final LandRecord712 record;
  final String recordType; // '712' | '8A'
  final AppState state;
  final VoidCallback onViewPdf;
  final VoidCallback onAutoStore;

  const LandRecordCard({
    super.key,
    required this.record,
    required this.recordType,
    required this.state,
    required this.onViewPdf,
    required this.onAutoStore,
  });

  @override
  Widget build(BuildContext context) {
    final r = record;
    return GlassCard(
      backgroundColor: Colors.white,
      border: Border.all(color: const Color(0xFFECEFF1)),
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${state.tr('landLegal.gatNo')}: ${r.gatNumber}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF2E7D32),
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF8E1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  "${r.village}, ${r.district}",
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFFF57F17),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (recordType == '712') ...[
            Text(
              '${state.tr('landLegal.ownerName')}: ${r.ownerName}',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: Color(0xFF263238),
              ),
            ),
            Text(
              '${state.tr('landLegal.khataNo')}: ${r.khataNumber} • ${state.tr('landLegal.ferfarNo')}: ${r.ferfarNumber}',
              style: const TextStyle(fontSize: 11.5, color: Colors.black54),
            ),
            const SizedBox(height: 4),
            Text(
              '${state.tr('landLegal.area')}: ${r.totalAreaHectares} ${state.tr('landLegal.hectare')} (${r.totalAreaAcres} ${state.tr('acresUnit')})',
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w900,
                color: Color(0xFF2E7D32),
              ),
            ),
            Text(
              '${state.tr('landLegal.landClass')}: ${r.landClass} • ${r.cropHistory}',
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
          ] else ...[
            Text(
              '${state.tr('landLegal.khataRecord8a')}: ${r.ownerName}',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: Color(0xFF263238),
              ),
            ),
            Text(
              '${state.tr('landLegal.totalKhataHoldings')}: 2 ${state.tr('landLegal.plots')} • ${state.tr('landLegal.combinedArea')}: ${r.totalAreaAcres} ${state.tr('acresUnit')}',
              style: const TextStyle(fontSize: 12, color: Colors.black87),
            ),
            Text(
              state.tr('landLegal.revenuePaid'),
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2E7D32),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: onViewPdf,
                  icon: const Icon(Icons.picture_as_pdf_rounded, size: 15),
                  label: Text(
                    state.tr('landLegal.viewPdf'),
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF43A047),
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onAutoStore,
                  icon: const Icon(Icons.sync_rounded, size: 15),
                  label: Text(
                    state.tr('landLegal.autoSave'),
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF2E7D32),
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

class LandRecordResultTile extends StatelessWidget {
  final LandRecord712 record;
  final AppState state;
  final VoidCallback onTap;

  const LandRecordResultTile({
    super.key,
    required this.record,
    required this.state,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      backgroundColor: Colors.white,
      border: Border.all(color: const Color(0xFFECEFF1)),
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      onTap: onTap,
      child: Row(
        children: [
          const Icon(
            Icons.description_rounded,
            size: 18,
            color: Color(0xFF43A047),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${state.tr('landLegal.gatLabel')} ${record.gatNumber} — ${record.ownerName}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  "${record.village}, ${record.district}",
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: Colors.grey),
        ],
      ),
    );
  }
}

class LandSearchBar extends StatelessWidget {
  final TextEditingController controller;
  final String hintText;
  final AppState state;
  final bool searching;
  final VoidCallback onSearch;

  const LandSearchBar({
    super.key,
    required this.controller,
    required this.hintText,
    required this.state,
    required this.searching,
    required this.onSearch,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF43A047), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF43A047).withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.search_rounded, color: Color(0xFF43A047), size: 22),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: controller,
              onSubmitted: (_) => onSearch(),
              decoration: InputDecoration(
                hintText: hintText,
                hintStyle: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF90A4AE),
                ),
                border: InputBorder.none,
              ),
            ),
          ),
          TextButton(
            onPressed: searching ? null : onSearch,
            child: Text(
              state.tr('landLegal.searchBtn'),
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: Color(0xFF2E7D32),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
