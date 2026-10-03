// Module O: Post-Harvest cards + cold-storage booking dialog (split from
// post_harvest_view.dart for the line cap). Prototype styling kept verbatim.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../components/common/glass_card.dart';
import '../models/post_harvest_models.dart';
import '../state/app_state.dart';

final _inr = NumberFormat('#,##,##0', 'en_IN');

class ColdStorageCard extends StatelessWidget {
  final ColdStorageFacility facility;
  final AppState state;
  final VoidCallback onBook;

  const ColdStorageCard({
    super.key,
    required this.facility,
    required this.state,
    required this.onBook,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(facility.name,
                style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1B4332))),
            Text(
                "${facility.distanceKm} km ${state.tr('postHarvest.away')} • ${facility.tempRange}",
                style: const TextStyle(fontSize: 11, color: Colors.grey)),
            const SizedBox(height: 6),
            Text(
                "${state.tr('postHarvest.available')}: ${_inr.format(facility.availableMT)} MT",
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF16A34A))),
            Text(
                "${state.tr('postHarvest.rate')}: ₹${_inr.format(facility.ratePerQuintalMonth)} ${state.tr('postHarvest.perQuintalPerMonth')}",
                style: const TextStyle(fontSize: 12, color: Colors.black87)),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: ElevatedButton(
                onPressed: onBook,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B4332),
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                  minimumSize: Size.zero,
                ),
                child: Text(state.tr('bookNow'),
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class GradeResultCard extends StatelessWidget {
  final GradeResult result;
  final AppState state;
  final bool grading;
  final VoidCallback onGrade;

  const GradeResultCard({
    super.key,
    required this.result,
    required this.state,
    required this.grading,
    required this.onGrade,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      backgroundColor: const Color(0xFFF0FDF4),
      border: Border.all(color: const Color(0xFF86EFAC)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(state.tr('postHarvest.aiGradingTitle'),
                  style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF14532D))),
              Text("${result.grade} ✅",
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF16A34A))),
            ],
          ),
          const SizedBox(height: 6),
          Text(
              "${result.uniformityPercent}% ${state.tr('postHarvest.sizeColorUniformity')} • ${result.shelfLifeDays} ${state.tr('postHarvest.daysShelfLife')} • ${state.tr('postHarvest.recommendedPrice')}: ₹${result.recommendedPrice}${state.tr('postHarvest.perQuintal')}",
              style: const TextStyle(fontSize: 12, color: Colors.black87)),
          const SizedBox(height: 10),
          ElevatedButton.icon(
            onPressed: grading ? null : onGrade,
            icon: const Icon(Icons.photo_camera_rounded, size: 16),
            label: Text(
                grading
                    ? state.tr('postHarvest.gradingInProgress')
                    : state.tr('postHarvest.regrade'),
                style: const TextStyle(fontWeight: FontWeight.w700)),
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 38)),
          ),
        ],
      ),
    );
  }
}

class GradePickCard extends StatelessWidget {
  final AppState state;
  final bool grading;
  final VoidCallback onGrade;

  const GradePickCard(
      {super.key, required this.state, required this.grading, required this.onGrade});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      backgroundColor: const Color(0xFFF0FDF4),
      border: Border.all(color: const Color(0xFF86EFAC)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.tr('postHarvest.aiGradingTitle'),
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF14532D))),
          const SizedBox(height: 6),
          Text(state.tr('postHarvest.gradeHint'),
              style: const TextStyle(fontSize: 12, color: Colors.black87)),
          const SizedBox(height: 10),
          ElevatedButton.icon(
            onPressed: grading ? null : onGrade,
            icon: const Icon(Icons.photo_camera_rounded, size: 16),
            label: Text(
                grading
                    ? state.tr('postHarvest.gradingInProgress')
                    : state.tr('postHarvest.gradeFromPhotos'),
                style: const TextStyle(fontWeight: FontWeight.w700)),
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 38)),
          ),
        ],
      ),
    );
  }
}

// F11 booking dialog — quantity (quintals), from-date picker, months stepper
// 1–12, client-side कुल ₹ = quantity × months × ratePerQuintalMonth.
class ColdStorageBookDialog extends StatefulWidget {
  final ColdStorageFacility facility;
  final AppState state;
  final void Function(double quantityQuintals, String fromDate, int months)
      onSubmit;

  const ColdStorageBookDialog({
    super.key,
    required this.facility,
    required this.state,
    required this.onSubmit,
  });

  @override
  State<ColdStorageBookDialog> createState() => _ColdStorageBookDialogState();
}

class _ColdStorageBookDialogState extends State<ColdStorageBookDialog> {
  final _quantityController = TextEditingController();
  late DateTime _fromDate = DateTime.now();
  int _months = 1;

  @override
  void dispose() {
    _quantityController.dispose();
    super.dispose();
  }

  double get _quantity =>
      double.tryParse(_quantityController.text.trim()) ?? 0;

  double get _total => _quantity * _months * widget.facility.ratePerQuintalMonth;

  String _fmtDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _fromDate,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _fromDate = picked);
  }

  void _submit() {
    if (_quantity <= 0) return;
    final fromDate = _fmtDate(_fromDate);
    final months = _months;
    final quantity = _quantity;
    Navigator.of(context).pop();
    widget.onSubmit(quantity, fromDate, months);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(widget.facility.name,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _quantityController,
            keyboardType: TextInputType.number,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: widget.state.tr('postHarvest.quantityQuintals'),
              isDense: true,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                  "${widget.state.tr('postHarvest.fromDate')}: ${_fmtDate(_fromDate)}",
                  style: const TextStyle(
                      fontSize: 12.5, fontWeight: FontWeight.w700)),
              TextButton(
                  onPressed: _pickDate,
                  child: Text(widget.state.tr('postHarvest.pickDate'))),
            ],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(widget.state.tr('postHarvest.durationMonths'),
                  style: const TextStyle(
                      fontSize: 12.5, fontWeight: FontWeight.w700)),
              Row(
                children: [
                  IconButton(
                    onPressed: _months > 1
                        ? () => setState(() => _months -= 1)
                        : null,
                    icon: const Icon(Icons.remove_circle_outline_rounded),
                    visualDensity: VisualDensity.compact,
                  ),
                  Text("$_months",
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w900)),
                  IconButton(
                    onPressed: _months < 12
                        ? () => setState(() => _months += 1)
                        : null,
                    icon: const Icon(Icons.add_circle_outline_rounded),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
              "${widget.state.tr('postHarvest.total')} ₹${_inr.format(_total)}",
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1B4332))),
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(widget.state.tr('back'))),
        ElevatedButton(
          onPressed: _quantity > 0 ? _submit : null,
          style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1B4332),
              foregroundColor: Colors.white),
          child: Text(widget.state.tr('bookNow'),
              style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
      ],
    );
  }
}
