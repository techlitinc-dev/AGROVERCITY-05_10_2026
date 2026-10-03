// Claim-form widgets (split from claim_form_section.dart for the line cap).

import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../components/common/motion_animations.dart';

class ClaimPhotoPicker extends StatelessWidget {

  final List<XFile> photos;
  final VoidCallback onAdd;
  final void Function(int index) onRemove;

  const ClaimPhotoPicker({
    super.key,
    required this.photos,
    required this.onAdd,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.camera_alt_rounded, color: Color(0xFF047857), size: 18),
                  SizedBox(width: 6),
                  Text("खेत की जियो-टैग्ड फोटो (GPS Photo)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                ],
              ),
              Text("${photos.length} फोटो संलग्न", style: const TextStyle(color: Color(0xFF047857), fontSize: 10.5, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 8),
          if (photos.isNotEmpty)
            SizedBox(
              height: 72,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: photos.length,
                separatorBuilder: (_, i) => const SizedBox(width: 8),
                itemBuilder: (context, i) => Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: SizedBox(
                        width: 72,
                        height: 72,
                        child: kIsWeb
                            ? const Icon(Icons.image_rounded, size: 32, color: Color(0xFF64748B))
                            : Image.file(
                                File(photos[i].path),
                                fit: BoxFit.cover,
                                errorBuilder: (_, e, s) => const Icon(Icons.image_rounded, size: 32, color: Color(0xFF64748B)),
                              ),
                      ),
                    ),
                    Positioned(
                      top: 2,
                      right: 2,
                      child: GestureDetector(
                        onTap: () => onRemove(i),
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: const BoxDecoration(color: Color(0xFFDC2626), shape: BoxShape.circle),
                          child: const Icon(Icons.close_rounded, size: 14, color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add_a_photo_rounded, size: 16),
            label: const Text('फोटो जोड़ें (कैमरा)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF047857),
              side: const BorderSide(color: Color(0xFF047857)),
              minimumSize: const Size(double.infinity, 40),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ],
      ),
    );
  }
}

const List<Map<String, dynamic>> kCalamityOptions = [
  {'name': 'ओलावृष्टि (Hailstorm)', 'icon': Icons.ac_unit_rounded, 'color': Color(0xFF0284C7)},
  {'name': 'बेमौसम बारिश (Unseasonal Rain)', 'icon': Icons.thunderstorm_rounded, 'color': Color(0xFF0D9488)},
  {'name': 'जलभराव / बाढ़ (Inundation)', 'icon': Icons.flood_rounded, 'color': Color(0xFF2563EB)},
  {'name': 'सूखा (Drought)', 'icon': Icons.wb_sunny_rounded, 'color': Color(0xFFD97706)},
  {'name': 'कीट व रोग प्रकोप (Pest Attack)', 'icon': Icons.pest_control_rounded, 'color': Color(0xFFDC2626)},
  {'name': 'तूफान / चक्रवात (Cyclone)', 'icon': Icons.air_rounded, 'color': Color(0xFF7C3AED)},
];

const List<String> kCropStages = [
  'बुवाई / अंकुरण (Sowing)',
  'खड़ी फसल (Standing Crop)',
  'फूल व फल अवस्था (Flowering/Fruiting)',
  'कटाई पश्चात सुखाई (Post-Harvest Drying)',
];


class CalamityGrid extends StatelessWidget {
  final String? selected;
  final void Function(String name) onSelect;

  const CalamityGrid({super.key, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        childAspectRatio: 2.2,
      ),
      itemCount: kCalamityOptions.length,
      itemBuilder: (context, idx) {
        final opt = kCalamityOptions[idx];
        final isSelected = selected == opt['name'];
        return BouncyPressable(
          onTap: () => onSelect(opt['name'] as String),
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isSelected ? const Color(0xFFFEF2F2) : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected ? const Color(0xFFDC2626) : const Color(0xFFE2E8F0),
                width: isSelected ? 1.8 : 1.0,
              ),
            ),
            child: Row(
              children: [
                Icon(opt['icon'] as IconData, size: 20, color: isSelected ? const Color(0xFFDC2626) : opt['color'] as Color),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    opt['name'] as String,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                      color: isSelected ? const Color(0xFF991B1B) : const Color(0xFF1E293B),
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class ClaimDateStageRow extends StatelessWidget {
  final DateTime damageDate;
  final String cropStage;
  final VoidCallback onPickDate;
  final void Function(String stage) onStageChanged;

  const ClaimDateStageRow({
    super.key,
    required this.damageDate,
    required this.cropStage,
    required this.onPickDate,
    required this.onStageChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("आपदा तिथि (Date of Loss)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              BouncyPressable(
                onTap: onPickDate,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(DateFormat('d MMM yyyy').format(damageDate), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      const Icon(Icons.calendar_today_rounded, size: 14, color: Color(0xFF047857)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("फसल की अवस्था (Crop Stage)", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: cropStage,
                    isExpanded: true,
                    items: kCropStages
                        .map((s) => DropdownMenuItem(
                              value: s,
                              child: Text(s.split(' (').first, style: const TextStyle(fontSize: 11)),
                            ))
                        .toList(),
                    onChanged: (v) {
                      if (v != null) onStageChanged(v);
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
