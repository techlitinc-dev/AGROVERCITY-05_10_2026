// Farm Diary widgets — create/edit entry dialog, timeline entry card, delete confirm.

import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../api/api_exception.dart';
import '../api/diary_api.dart';
import '../models/app_models.dart' hide FarmDiaryEntry;
import '../models/farm_diary_entry.dart';
import '../components/common/glass_card.dart';
import '../state/app_state.dart';

// Canonical unit keys stored on the backend; display is localized.
const List<String> kDiaryUnits = ['quintal', 'kg', 'litre', 'gram', 'other'];

String diaryUnitLabel(AppState state, String unit) => switch (unit) {
      'quintal' => state.tr('farmDiary.unitQuintal'),
      'kg' => state.tr('farmDiary.unitKilo'),
      'litre' => state.tr('farmDiary.unitLitre'),
      'gram' => state.tr('farmDiary.unitGram'),
      _ => state.tr('farmDiary.unitOther'),
    };

// Result of the entry dialog: the saved entry + AgriCoins awarded (0 on edit).
typedef DiaryDialogResult = (FarmDiaryEntry, int);

// Shows the "नवीन शेती नोंद" dialog in CREATE mode (existing == null) or
// EDIT mode (pre-filled). Saves via the given [diaryApi] — photos are picked
// locally, uploaded after the entry exists, then merged with a final update.
Future<DiaryDialogResult?> showDiaryEntryDialog(
  BuildContext context,
  AppState state, {
  FarmDiaryEntry? existing,
  DiaryApi? diaryApi,
}) {
  final api = diaryApi ?? DiaryApi();
  final existingEntry = existing;
  final titleController = TextEditingController(text: existingEntry?.title ?? '');
  final amountText = existingEntry == null
      ? ''
      : existingEntry.amount % 1 == 0
          ? existingEntry.amount.toInt().toString()
          : existingEntry.amount.toString();
  final amountController = TextEditingController(text: amountText);
  final cropController = TextEditingController(
    text: existingEntry != null && existingEntry.cropName.isNotEmpty
        ? existingEntry.cropName
        : state.tr('farmDiary.defaultCropName'),
  );
  final quantityText = existingEntry?.quantity == null
      ? ''
      : existingEntry!.quantity! % 1 == 0
          ? existingEntry.quantity!.toInt().toString()
          : existingEntry.quantity.toString();
  final quantityController = TextEditingController(text: quantityText);
  final notesController = TextEditingController(text: existingEntry?.notes ?? '');
  String selectedCategory = (existingEntry?.category.isNotEmpty ?? false)
      ? existingEntry!.category
      : 'Fertilizer';
  FarmDiaryType newEntryType = existingEntry?.type ?? FarmDiaryType.expense;
  String dateStr = (existingEntry != null && existingEntry.date.isNotEmpty)
      ? existingEntry.date
      : DateFormat('yyyy-MM-dd').format(DateTime.now());
  String selectedUnit =
      existingEntry?.unit != null && kDiaryUnits.contains(existingEntry?.unit)
          ? existingEntry!.unit!
          : kDiaryUnits.first;
  final keptPhotos = List<String>.from(existingEntry?.photos ?? const []);
  final newPhotos = <XFile>[];
  var saving = false;

  Widget typeSelectChip(
    FarmDiaryType type,
    String label,
    Color color,
    StateSetter setDialogState,
  ) {
    final isSel = newEntryType == type;
    return Expanded(
      child: GestureDetector(
        onTap: () => setDialogState(() => newEntryType = type),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(
            color: isSel ? color : Colors.grey.shade100,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: isSel ? color : Colors.grey.shade300),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              fontWeight: isSel ? FontWeight.w900 : FontWeight.w600,
              color: isSel ? Colors.white : Colors.black87,
            ),
          ),
        ),
      ),
    );
  }

  Future<void> pickPhotos(StateSetter setDialogState) async {
    final remaining =
        3 - keptPhotos.length - newPhotos.length;
    if (remaining <= 0) return;
    try {
      final picked = await ImagePicker().pickMultiImage();
      if (picked.isNotEmpty) {
        setDialogState(() => newPhotos.addAll(picked.take(remaining)));
      }
    } catch (_) {
      // Picker unavailable (e.g. tests) — ignore.
    }
  }

  Widget photoThumbnails(StateSetter setDialogState) {
    if (keptPhotos.isEmpty && newPhotos.isEmpty) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (var i = 0; i < keptPhotos.length; i++)
            _thumb(
              image: CachedNetworkImageProvider(keptPhotos[i]),
              onRemove: () => setDialogState(() => keptPhotos.removeAt(i)),
            ),
          for (var i = 0; i < newPhotos.length; i++)
            _thumb(
              image: FileImage(File(newPhotos[i].path)),
              onRemove: () => setDialogState(() => newPhotos.removeAt(i)),
            ),
        ],
      ),
    );
  }

  Future<void> save(BuildContext ctx, StateSetter setDialogState) async {
    final title = titleController.text.trim().isEmpty
        ? state.tr('farmDiary.defaultTitle')
        : titleController.text.trim();
    final amount = double.tryParse(amountController.text.trim()) ?? 0.0;
    final isActivity = newEntryType == FarmDiaryType.farmActivity;
    final quantity =
        double.tryParse(quantityController.text.trim());

    final payload = <String, dynamic>{
      'title': title,
      'category': selectedCategory,
      'type': newEntryType.name,
      'amount': isActivity ? 0.0 : amount,
      'date': dateStr,
      'cropName': cropController.text.trim().isEmpty
          ? state.tr('farmDiary.generalFarm')
          : cropController.text.trim(),
      'notes': notesController.text.trim().isEmpty
          ? state.tr('farmDiary.defaultNotes')
          : notesController.text.trim(),
      'quantity': isActivity ? quantity : null,
      'unit': isActivity ? selectedUnit : null,
      'photos': List<String>.from(keptPhotos),
    };

    setDialogState(() => saving = true);
    FarmDiaryEntry saved;
    var coins = 0;
    try {
      if (existingEntry == null) {
        final draft = FarmDiaryEntry(
          id: '',
          title: payload['title'] as String,
          category: payload['category'] as String,
          type: newEntryType,
          amount: payload['amount'] as double,
          date: dateStr,
          cropName: payload['cropName'] as String,
          notes: payload['notes'] as String,
          photos: const [],
          quantity: payload['quantity'] as double?,
          unit: payload['unit'] as String?,
        );
        final created = await api.addEntry(draft);
        saved = created.$1;
        coins = created.$2;
      } else {
        saved = await api.updateEntry(existingEntry.id, payload);
      }

      if (newPhotos.isNotEmpty) {
        try {
          final urls = await api.uploadPhotos(
            saved.id,
            newPhotos.map((f) => f.path).toList(),
          );
          saved = await api.updateEntry(saved.id, {
            ...payload,
            'photos': [...keptPhotos, ...urls],
          });
        } on ApiException catch (e) {
          // Entry is saved; only the photo upload failed.
          if (ctx.mounted) {
            final detail = e.message.isNotEmpty ? e.message : e.code;
            ScaffoldMessenger.of(ctx).showSnackBar(
              SnackBar(content: Text('${state.tr('farmDiary.photosUploadFailed')}${detail.isNotEmpty ? ' — $detail' : ''}')),
            );
          }
        }
      }
    } on ApiException catch (e) {
      if (ctx.mounted) {
        setDialogState(() => saving = false);
        ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(content: Text(e.message.isNotEmpty ? e.message : e.code)),
        );
      }
      return;
    } catch (_) {
      if (ctx.mounted) setDialogState(() => saving = false);
      return;
    }

    if (!ctx.mounted) return;
    Navigator.of(ctx).pop((saved, coins));
  }

  return showDialog<DiaryDialogResult>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (context, setDialogState) {
        final isActivity = newEntryType == FarmDiaryType.farmActivity;
        final isEdit = existingEntry != null;
        final photoSlotsLeft =
            3 - keptPhotos.length - newPhotos.length > 0;
        return AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          backgroundColor: Colors.white,
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0E7FF),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.edit_note_rounded,
                    color: Color(0xFF4338CA), size: 24),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  isEdit
                      ? state.tr('farmDiary.editRecordTitle')
                      : state.tr('farmDiary.addRecordTitle'),
                  style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF112A1F)),
                ),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(state.tr('farmDiary.entryTypeLabel'),
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Row(
                  children: [
                    typeSelectChip(FarmDiaryType.expense,
                        state.tr('farmDiary.expense'), const Color(0xFFDC2626), setDialogState),
                    const SizedBox(width: 6),
                    typeSelectChip(FarmDiaryType.income,
                        state.tr('farmDiary.income'), const Color(0xFF16A34A), setDialogState),
                    const SizedBox(width: 6),
                    typeSelectChip(FarmDiaryType.farmActivity,
                        state.tr('farmDiary.activity'), const Color(0xFF0284C7), setDialogState),
                  ],
                ),
                const SizedBox(height: 12),
                Text(state.tr('farmDiary.titleLabel'),
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                TextField(
                  controller: titleController,
                  decoration: InputDecoration(
                    hintText: state.tr('farmDiary.titleHint'),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 8),
                  ),
                ),
                if (!isActivity) ...[
                  const SizedBox(height: 10),
                  Text(state.tr('farmDiary.amountLabel'),
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: amountController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      prefixText: "₹ ",
                      hintText: state.tr('farmDiary.amountHint'),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 8),
                    ),
                  ),
                ],
                if (isActivity) ...[
                  const SizedBox(height: 10),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(state.tr('farmDiary.quantityLabel'),
                                style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700)),
                            const SizedBox(height: 4),
                            TextField(
                              controller: quantityController,
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                hintText: state.tr('farmDiary.amountHint'),
                                border: OutlineInputBorder(
                                    borderRadius:
                                        BorderRadius.circular(10)),
                                contentPadding:
                                    const EdgeInsets.symmetric(
                                        horizontal: 10, vertical: 8),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(state.tr('farmDiary.unitLabel'),
                                style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700)),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10),
                              decoration: BoxDecoration(
                                border: Border.all(
                                    color: Colors.grey.shade300),
                                borderRadius:
                                    BorderRadius.circular(10),
                              ),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: selectedUnit,
                                  isExpanded: true,
                                  items: [
                                    for (final u in kDiaryUnits)
                                      DropdownMenuItem(
                                        value: u,
                                        child: Text(
                                            diaryUnitLabel(state, u),
                                            style: const TextStyle(
                                                fontSize: 13)),
                                      ),
                                  ],
                                  onChanged: (val) {
                                    if (val != null) {
                                      setDialogState(() =>
                                          selectedUnit = val);
                                    }
                                  },
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 10),
                Text(state.tr('farmDiary.categoryLabel'),
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: selectedCategory,
                      isExpanded: true,
                      items: [
                        DropdownMenuItem(value: "Fertilizer", child: Text(state.tr('farmDiary.catFertilizer'))),
                        DropdownMenuItem(value: "Seeds", child: Text(state.tr('farmDiary.catSeeds'))),
                        DropdownMenuItem(value: "Spraying", child: Text(state.tr('farmDiary.catSpraying'))),
                        DropdownMenuItem(value: "Labor", child: Text(state.tr('farmDiary.catLabor'))),
                        DropdownMenuItem(value: "Irrigation", child: Text(state.tr('farmDiary.catIrrigation'))),
                        DropdownMenuItem(value: "Mandi Sale", child: Text(state.tr('farmDiary.catMandiSale'))),
                        DropdownMenuItem(value: "Dairy Sale", child: Text(state.tr('farmDiary.catDairySale'))),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() => selectedCategory = val);
                        }
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(state.tr('farmDiary.dateLabel'),
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Builder(
                  builder: (fieldCtx) => InkWell(
                    onTap: () async {
                      final now = DateTime.now();
                      final initial =
                          DateTime.tryParse(dateStr) ?? now;
                      final picked = await showDatePicker(
                        context: fieldCtx,
                        initialDate: initial,
                        firstDate: DateTime(2020),
                        lastDate: DateTime(now.year + 1),
                      );
                      if (picked != null) {
                        setDialogState(() => dateStr =
                            DateFormat('yyyy-MM-dd').format(picked));
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 11),
                      decoration: BoxDecoration(
                        border:
                            Border.all(color: Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.calendar_month_rounded,
                              size: 16, color: Color(0xFF4338CA)),
                          const SizedBox(width: 8),
                          Text(
                            DateFormat('dd MMM yyyy').format(
                                DateTime.tryParse(dateStr) ??
                                    DateTime.now()),
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF112A1F)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(state.tr('farmDiary.cropNameLabel'),
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                TextField(
                  controller: cropController,
                  decoration: InputDecoration(
                    hintText: state.tr('farmDiary.cropHint'),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 8),
                  ),
                ),
                const SizedBox(height: 10),
                Text(state.tr('farmDiary.notesLabel'),
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                TextField(
                  controller: notesController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: state.tr('farmDiary.notesHint'),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 8),
                  ),
                ),
                const SizedBox(height: 10),
                if (photoSlotsLeft)
                  GestureDetector(
                    onTap: saving ? null : () => pickPhotos(setDialogState),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE0E7FF)
                            .withValues(alpha: 0.45),
                        border: Border.all(
                            color: const Color(0xFF4338CA)
                                .withValues(alpha: 0.35)),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.add_photo_alternate_outlined,
                              size: 18, color: Color(0xFF4338CA)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              '${state.tr('farmDiary.attachPhotos')} • ${state.tr('farmDiary.photoLimit')}',
                              style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF4338CA)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                photoThumbnails(setDialogState),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(ctx),
              child: Text(state.tr('cancel'),
                  style: const TextStyle(
                      color: Colors.grey,
                      fontWeight: FontWeight.w700)),
            ),
            ElevatedButton(
              onPressed: saving ? null : () => save(ctx, setDialogState),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B4332),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              ),
              child: saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Text(
                      isEdit
                          ? state.tr('farmDiary.updateEntry')
                          : state.tr('farmDiary.saveEntryCoins'),
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900)),
            ),
          ],
        );
      },
    ),
  );
}

Widget _thumb({required ImageProvider image, required VoidCallback onRemove}) {
  return Stack(
    children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image(
          image: image,
          width: 52,
          height: 52,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => Container(
            width: 52,
            height: 52,
            color: Colors.grey.shade200,
            child: const Icon(Icons.broken_image_outlined,
                size: 20, color: Colors.grey),
          ),
        ),
      ),
      Positioned(
        top: 0,
        right: 0,
        child: GestureDetector(
          onTap: onRemove,
          child: Container(
            padding: const EdgeInsets.all(2),
            decoration: const BoxDecoration(
              color: Colors.black54,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.close_rounded,
                size: 12, color: Colors.white),
          ),
        ),
      ),
    ],
  );
}

// Confirmation dialog before permanently deleting an entry.
Future<bool> showDiaryDeleteConfirm(BuildContext context, AppState state) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: Colors.white,
      title: Text(state.tr('farmDiary.deleteTitle'),
          style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              color: Color(0xFF112A1F))),
      content: Text(state.tr('farmDiary.deleteMessage'),
          style: const TextStyle(fontSize: 13, color: Color(0xFF4B5563))),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text(state.tr('cancel'),
              style: const TextStyle(
                  color: Colors.grey, fontWeight: FontWeight.w700)),
        ),
        ElevatedButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFDC2626),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10)),
          ),
          child: Text(state.tr('farmDiary.deleteConfirm'),
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w900)),
        ),
      ],
    ),
  );
  return confirmed ?? false;
}

class DiaryEntryCard extends StatelessWidget {
  final FarmDiaryEntry entry;
  final VoidCallback onDelete;
  final VoidCallback? onEdit;
  final AppState state;

  const DiaryEntryCard({
    super.key,
    required this.entry,
    required this.onDelete,
    required this.state,
    this.onEdit,
  });

  void _openPhoto(BuildContext context, String url) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(20),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: InteractiveViewer(
            child: CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.contain,
              placeholder: (context, url) => Container(
                height: 240,
                color: Colors.black87,
                child: const Center(
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                ),
              ),
              errorWidget: (context, url, error) => Container(
                height: 240,
                color: Colors.black87,
                child: const Icon(Icons.broken_image_outlined,
                    color: Colors.white, size: 40),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final e = entry;
    Color badgeColor = const Color(0xFF0284C7);
    IconData icon = Icons.task_alt_rounded;
    String prefix = "";
    Color amountColor = Colors.black87;

    if (e.type == FarmDiaryType.expense) {
      badgeColor = const Color(0xFFDC2626);
      icon = Icons.arrow_outward_rounded;
      prefix = "- ₹";
      amountColor = const Color(0xFFDC2626);
    } else if (e.type == FarmDiaryType.income) {
      badgeColor = const Color(0xFF16A34A);
      icon = Icons.arrow_downward_rounded;
      prefix = "+ ₹";
      amountColor = const Color(0xFF16A34A);
    }

    final parsedDate = DateTime.tryParse(e.date);
    final dateLabel =
        parsedDate != null ? DateFormat('dd MMM yy').format(parsedDate) : e.date;

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: badgeColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: badgeColor, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        e.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF112A1F)),
                      ),
                    ),
                    if (e.type != FarmDiaryType.farmActivity)
                      Text(
                        "$prefix${e.amount.toInt()}",
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            color: amountColor),
                      ),
                  ],
                ),
                Text(
                  "${e.category} • ${e.cropName} • $dateLabel",
                  style: TextStyle(
                      fontSize: 10.5,
                      color: Colors.grey.shade600,
                      fontWeight: FontWeight.w600),
                ),
                if (e.quantity != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    '${e.quantity! % 1 == 0 ? e.quantity!.toInt() : e.quantity} • ${e.unit != null ? diaryUnitLabel(state, e.unit!) : ''}',
                    style: TextStyle(
                        fontSize: 10.5,
                        color: const Color(0xFF4338CA),
                        fontWeight: FontWeight.w800),
                  ),
                ],
                const SizedBox(height: 4),
                Text(
                  e.notes,
                  style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFF4B5563),
                      height: 1.3),
                ),
                if (e.photos.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final url in e.photos.take(3))
                        GestureDetector(
                          onTap: () => _openPhoto(context, url),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: CachedNetworkImage(
                              imageUrl: url,
                              width: 48,
                              height: 48,
                              fit: BoxFit.cover,
                              errorWidget: (context, url, error) => Container(
                                width: 48,
                                height: 48,
                                color: Colors.grey.shade200,
                                child: const Icon(
                                    Icons.broken_image_outlined,
                                    size: 18,
                                    color: Colors.grey),
                              ),
                            ),
                          ),
                        ),
                      if (e.photos.length > 3)
                        Container(
                          width: 48,
                          height: 48,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '+${e.photos.length - 3}',
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF374151)),
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          Column(
            children: [
              if (onEdit != null)
                IconButton(
                  icon: const Icon(Icons.edit_outlined,
                      color: Color(0xFF4338CA), size: 18),
                  onPressed: onEdit,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              IconButton(
                icon: Icon(Icons.delete_outline_rounded,
                    color: Colors.grey.shade400, size: 18),
                onPressed: onDelete,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
