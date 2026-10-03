// Gyan Hub workshop enroll sheet with coin redeem (split from
// gyan_hub_view.dart for the line cap; verbatim styling).

import 'package:flutter/material.dart';

import '../models/gyan_models.dart';
import '../state/app_state.dart';


class WorkshopEnrollSheet extends StatefulWidget {
  final PaidWorkshop workshop;
  final AppState state;
  final int coinBalance;
  final void Function(bool useCoins, int coinsToRedeem) onEnroll;

  const WorkshopEnrollSheet({
    super.key,
    required this.workshop,
    required this.state,
    required this.coinBalance,
    required this.onEnroll,
  });

  @override
  State<WorkshopEnrollSheet> createState() => _WorkshopEnrollSheetState();
}

class _WorkshopEnrollSheetState extends State<WorkshopEnrollSheet> {
  bool _useCoins = false;
  double _coins = 0;

  int get _maxCoins {
    final ws = widget.workshop;
    var max = ws.coinsDiscountAllowed;
    if (widget.coinBalance < max) max = widget.coinBalance;
    if (ws.feeRupees < max) max = ws.feeRupees;
    return max < 0 ? 0 : max;
  }

  @override
  Widget build(BuildContext context) {
    final ws = widget.workshop;
    final coins = _useCoins ? _coins.round() : 0;
    final finalFee = ws.feeRupees - coins;

    return Container(
      height: MediaQuery.of(context).size.height * 0.86,
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Text(
                  widget.state.tr('gyanHub.premiumWorkshopBadge'),
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF92400E)),
                ),
              ),
              if (ws.isCertified)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(widget.state.tr('gyanHub.icarCertified'), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF15803D))),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            ws.vernacularTitle,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF112A1F), height: 1.3),
          ),
          const SizedBox(height: 6),
          Text(
            widget.state.tr('gyanHub.trainerInstitutionLine')
                .replaceAll('{name}', ws.instructor)
                .replaceAll('{role}', ws.instructorRole)
                .replaceAll('{institution}', ws.institution),
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700, fontWeight: FontWeight.w600),
          ),
          const Divider(height: 20),
          Expanded(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _wsDetailCapsule(Icons.calendar_month_rounded, widget.state.tr('gyanHub.dateLabel'), ws.batchDate),
                        _wsDetailCapsule(Icons.access_time_rounded, widget.state.tr('gyanHub.timeLabel'), ws.timing),
                        _wsDetailCapsule(Icons.timer_rounded, widget.state.tr('gyanHub.durationLabel'), ws.duration),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  Text(
                    widget.state.tr('gyanHub.syllabusTitle'),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1B4332)),
                  ),
                  const SizedBox(height: 8),
                  ...ws.syllabusModules.map((m) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 16),
                            const SizedBox(width: 6),
                            Expanded(child: Text(m, style: const TextStyle(fontSize: 12, color: Color(0xFF374151), height: 1.35))),
                          ],
                        ),
                      )),
                  const SizedBox(height: 14),

                  Text(
                    widget.state.tr('gyanHub.deliverablesTitle'),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF1B4332)),
                  ),
                  const SizedBox(height: 6),
                  ...ws.deliverables.map((d) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2.5),
                        child: Row(
                          children: [
                            const Icon(Icons.stars_rounded, color: Color(0xFFEAB308), size: 16),
                            const SizedBox(width: 6),
                            Expanded(child: Text(d, style: const TextStyle(fontSize: 11.5, color: Color(0xFF4B5563), fontWeight: FontWeight.w600))),
                          ],
                        ),
                      )),
                ],
              ),
            ),
          ),
          const Divider(height: 16),

          if (!ws.isEnrolled && _maxCoins > 0) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  widget.state.tr('gyanHub.useAgriCoins').replaceAll('{balance}', '${widget.coinBalance}'),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFFB45309)),
                ),
                Switch(
                  value: _useCoins,
                  activeThumbColor: const Color(0xFF1B4332),
                  onChanged: (v) => setState(() {
                    _useCoins = v;
                    if (v && _coins == 0) _coins = _maxCoins.toDouble();
                  }),
                ),
              ],
            ),
            if (_useCoins)
              Row(
                children: [
                  Expanded(
                    child: Slider(
                      value: _coins.clamp(0, _maxCoins).toDouble(),
                      min: 0,
                      max: _maxCoins.toDouble(),
                      divisions: _maxCoins > 0 ? _maxCoins : null,
                      activeColor: const Color(0xFFB45309),
                      label: "$coins ${widget.state.tr('gyanHub.coinUnit')}",
                      onChanged: (v) => setState(() => _coins = v),
                    ),
                  ),
                  Text("-₹$coins", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFFB45309))),
                ],
              ),
            const SizedBox(height: 6),
          ],

          // Fee and Confirm Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text("₹${ws.feeRupees}", style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF112A1F))),
                      const SizedBox(width: 6),
                      if (coins > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(4)),
                          child: Text("-₹$coins Coins", style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFB45309))),
                        ),
                    ],
                  ),
                  Text(widget.state.tr('gyanHub.finalFee').replaceAll('{amount}', '$finalFee'), style: const TextStyle(fontSize: 11, color: Color(0xFF15803D), fontWeight: FontWeight.w700)),
                ],
              ),
              ElevatedButton(
                onPressed: ws.isEnrolled
                    ? null
                    : () {
                        Navigator.pop(context);
                        widget.onEnroll(_useCoins, coins);
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: ws.isEnrolled ? const Color(0xFF16A34A) : const Color(0xFF1B4332),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                ),
                child: Text(
                  ws.isEnrolled ? widget.state.tr('gyanHub.enrolledConfirm') : widget.state.tr('gyanHub.confirmEnrollment'),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _wsDetailCapsule(IconData icon, String label, String value) {
    return Column(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF2E7D32)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 9.5, color: Colors.grey, fontWeight: FontWeight.w600)),
        Text(value, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF112A1F))),
      ],
    );
  }
}

