// Gyan Hub cards — workshop / expert talk (split from gyan_hub_view.dart
// for the line cap; verbatim styling).

import 'package:flutter/material.dart';

import '../components/common/glass_card.dart';
import '../data/translations.dart';
import '../models/gyan_models.dart';
import '../state/app_state.dart';


class WorkshopCard extends StatelessWidget {
  final PaidWorkshop workshop;
  final VoidCallback onOpenDetail;
  final AppState? state;

  const WorkshopCard({
    super.key,
    required this.workshop,
    required this.onOpenDetail,
    this.state,
  });

  String _tr(String key) => AppTranslations.get(key, state?.language ?? 'mr');

  @override
  Widget build(BuildContext context) {
    final ws = workshop;
    final seatsProgress = ws.totalSeats > 0 ? ws.enrolledCount / ws.totalSeats : 0.0;
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 14),
      border: Border(left: BorderSide(color: ws.isEnrolled ? const Color(0xFF16A34A) : const Color(0xFFD97706), width: 4)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  "⭐ ${ws.rating} • ${ws.enrolledCount}/${ws.totalSeats} ${_tr('gyanHub.seatsFilled')}",
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF92400E)),
                ),
              ),
              if (ws.isEnrolled)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(_tr('gyanHub.enrolledBadge'), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF15803D))),
                ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: seatsProgress.clamp(0.0, 1.0),
              minHeight: 5,
              backgroundColor: const Color(0xFFF3F4F6),
              valueColor: AlwaysStoppedAnimation<Color>(
                ws.isEnrolled ? const Color(0xFF16A34A) : const Color(0xFFD97706),
              ),
            ),
          ),
          const SizedBox(height: 8),

          Text(
            ws.vernacularTitle,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
          ),
          const SizedBox(height: 4),
          Text(
            "${_tr('gyanHub.instructorLabel')} ${ws.instructor} (${ws.instructorRole})",
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF1B5E20), fontWeight: FontWeight.w700),
          ),
          Text(
            "${_tr('gyanHub.institutionLabel')} ${ws.institution}",
            style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 10),

          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.calendar_month_rounded, size: 14, color: Color(0xFFD97706)),
                    const SizedBox(width: 4),
                    Text(ws.batchDate, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFD97706))),
                  ],
                ),
                Row(
                  children: [
                    const Icon(Icons.workspace_premium_rounded, size: 14, color: Color(0xFF15803D)),
                    const SizedBox(width: 4),
                    Text(ws.certificateTitle, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF15803D))),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("₹${ws.feeRupees}", style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF112A1F))),
                  Text(_tr('gyanHub.coinsDiscount').replaceAll('{amount}', '${ws.coinsDiscountAllowed}'), style: const TextStyle(fontSize: 10, color: Color(0xFFB45309), fontWeight: FontWeight.w700)),
                ],
              ),
              ElevatedButton.icon(
                onPressed: onOpenDetail,
                icon: const Icon(Icons.menu_book_rounded, size: 14, color: Colors.white),
                label: Text(ws.isEnrolled ? _tr('gyanHub.viewCurriculum') : _tr('gyanHub.detailsAndEnroll'), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Colors.white)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: ws.isEnrolled ? const Color(0xFF16A34A) : const Color(0xFF1B4332),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class ExpertTalkCard extends StatelessWidget {
  final ExpertTalk talk;
  final bool registered;
  final VoidCallback onRegister;
  final VoidCallback onAsk;
  final AppState? state;

  const ExpertTalkCard({
    super.key,
    required this.talk,
    required this.registered,
    required this.onRegister,
    required this.onAsk,
    this.state,
  });

  String _tr(String key) => AppTranslations.get(key, state?.language ?? 'mr');

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 14),
      border: Border(left: BorderSide(color: talk.isLive ? Colors.red : const Color(0xFF52B788), width: 4)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    backgroundColor: const Color(0xFF1B4332),
                    radius: 16,
                    child: Text(talk.expertAvatar, style: const TextStyle(color: Color(0xFFE9C46A), fontWeight: FontWeight.w900, fontSize: 11)),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(talk.expertName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
                      Text(talk.institution, style: const TextStyle(fontSize: 10.5, color: Colors.grey)),
                    ],
                  ),
                ],
              ),
              if (talk.isLive)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(8)),
                  child: const Row(
                    children: [
                      Icon(Icons.fiber_manual_record_rounded, color: Colors.white, size: 10),
                      SizedBox(width: 4),
                      Text("LIVE", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 10)),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),

          Text(talk.vernacularTopic, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF112A1F))),
          const SizedBox(height: 4),
          Text(talk.description, style: const TextStyle(fontSize: 12, color: Colors.black87, height: 1.35)),
          const SizedBox(height: 10),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.access_time_rounded, size: 14, color: Color(0xFFD97706)),
                  const SizedBox(width: 4),
                  Text(talk.scheduledTime, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFFD97706))),
                ],
              ),
              Text("👥 ${talk.registeredCount} ${_tr('gyanHub.farmersRegistered')}", style: const TextStyle(fontSize: 11, color: Colors.grey)),
            ],
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: registered ? null : onRegister,
                  icon: const Icon(Icons.event_available_rounded, size: 16),
                  label: Text(
                    registered ? _tr('gyanHub.registeredBadge') : _tr('gyanHub.registerForCoins').replaceAll('{coins}', '25'),
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                  ),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 8)),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                onPressed: onAsk,
                icon: const Icon(Icons.help_outline_rounded, size: 16),
                label: Text(_tr('gyanHub.askQuestion'), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
                style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF1B4332), side: const BorderSide(color: Color(0xFF1B4332)), padding: const EdgeInsets.symmetric(vertical: 8)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

