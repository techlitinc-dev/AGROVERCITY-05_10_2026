// Daily Farm Diary (शेती नोंदवही) — Farm Operation, Expense & Income Tracker

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';
import '../components/common/motion_animations.dart';

class FarmDiaryView extends StatefulWidget {
  final AppState state;
  const FarmDiaryView({super.key, required this.state});

  @override
  State<FarmDiaryView> createState() => _FarmDiaryViewState();
}

class _FarmDiaryViewState extends State<FarmDiaryView> {
  FarmDiaryType? _filterType; // null = all

  final _titleController = TextEditingController();
  final _amountController = TextEditingController();
  final _cropController = TextEditingController(text: "Tomato (टमाटर)");
  final _notesController = TextEditingController();
  String _selectedCategory = "Fertilizer (खत)";
  FarmDiaryType _newEntryType = FarmDiaryType.expense;

  void _openAddEntryDialog() {
    _titleController.clear();
    _amountController.clear();
    _notesController.clear();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          backgroundColor: Colors.white,
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0E7FF),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.edit_note_rounded, color: Color(0xFF4338CA), size: 24),
              ),
              const SizedBox(width: 10),
              const Text(
                "नवीन शेती नोंद (Add Record)",
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("नोंदीचा प्रकार:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Row(
                  children: [
                    _typeSelectChip(FarmDiaryType.expense, "खर्च (Expense)", const Color(0xFFDC2626), setDialogState),
                    const SizedBox(width: 6),
                    _typeSelectChip(FarmDiaryType.income, "उत्पन्न (Income)", const Color(0xFF16A34A), setDialogState),
                    const SizedBox(width: 6),
                    _typeSelectChip(FarmDiaryType.farmActivity, "काम (Activity)", const Color(0xFF0284C7), setDialogState),
                  ],
                ),
                const SizedBox(height: 12),
                const Text("शीर्षक (Title):", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                TextField(
                  controller: _titleController,
                  decoration: InputDecoration(
                    hintText: "उदा. निंदणी मजुरी किंवा खत खरेदी",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                ),
                if (_newEntryType != FarmDiaryType.farmActivity) ...[
                  const SizedBox(height: 10),
                  const Text("रक्कम (₹ Amount):", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _amountController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      prefixText: "₹ ",
                      hintText: "उदा. 1200",
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                  ),
                ],
                const SizedBox(height: 10),
                const Text("वर्गवारी (Category):", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedCategory,
                      isExpanded: true,
                      items: const [
                        DropdownMenuItem(value: "Fertilizer (खत)", child: Text("Fertilizer (खत)")),
                        DropdownMenuItem(value: "Seeds (बियाणे)", child: Text("Seeds (बियाणे)")),
                        DropdownMenuItem(value: "Spraying (फवारणी)", child: Text("Spraying (फवारणी)")),
                        DropdownMenuItem(value: "Labor (मजुरी)", child: Text("Labor (मजुरी)")),
                        DropdownMenuItem(value: "Irrigation (पाणी/सिंचन)", child: Text("Irrigation (पाणी/सिंचन)")),
                        DropdownMenuItem(value: "Mandi Sale (मंडी विक्री)", child: Text("Mandi Sale (मंडी विक्री)")),
                        DropdownMenuItem(value: "Dairy Sale (दूध विक्री)", child: Text("Dairy Sale (दूध विक्री)")),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() => _selectedCategory = val);
                        }
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                const Text("पिकाचे नाव:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                TextField(
                  controller: _cropController,
                  decoration: InputDecoration(
                    hintText: "उदा. Tomato, Wheat, Onion",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                ),
                const SizedBox(height: 10),
                const Text("तपशील / शेरा (Notes):", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                TextField(
                  controller: _notesController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: "उदा. 2 पोती खत ड्रिपमधून सोडले...",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text("रद्द करा", style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w700)),
            ),
            ElevatedButton(
              onPressed: () {
                final title = _titleController.text.trim().isEmpty ? "दैनिक शेती काम" : _titleController.text.trim();
                final amount = double.tryParse(_amountController.text.trim()) ?? 0.0;
                final now = DateTime.now();
                final dateStr = "${now.day} Sep ${now.year}";

                final entry = FarmDiaryEntry(
                  id: "diary-${now.millisecondsSinceEpoch}",
                  title: title,
                  category: _selectedCategory.split(' (').first,
                  type: _newEntryType,
                  amount: amount,
                  date: dateStr,
                  cropName: _cropController.text.trim().isEmpty ? "General Farm" : _cropController.text.trim(),
                  notes: _notesController.text.trim().isEmpty ? "नोंद पूर्ण केली" : _notesController.text.trim(),
                );

                Navigator.pop(ctx);
                widget.state.addDiaryEntry(entry);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B4332),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              ),
              child: const Text("नोंद साठवा (+15 नाणी)", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _typeSelectChip(FarmDiaryType type, String label, Color color, StateSetter setDialogState) {
    final isSel = _newEntryType == type;
    return Expanded(
      child: GestureDetector(
        onTap: () => setDialogState(() => _newEntryType = type),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(
            color: isSel ? color : Colors.grey.shade100,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: isSel ? color : Colors.grey.shade300),
          ),
          child: Text(
            label.split(' ').first,
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

  @override
  Widget build(BuildContext context) {
    // Financial Totals
    final totalIncome = widget.state.farmDiaryEntries
        .where((e) => e.type == FarmDiaryType.income)
        .fold(0.0, (sum, e) => sum + e.amount);

    final totalExpense = widget.state.farmDiaryEntries
        .where((e) => e.type == FarmDiaryType.expense)
        .fold(0.0, (sum, e) => sum + e.amount);

    final netProfit = totalIncome - totalExpense;

    final filteredEntries = widget.state.farmDiaryEntries.where((e) {
      if (_filterType == null) return true;
      return e.type == _filterType;
    }).toList();

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Header with Add Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.menu_book_rounded, color: Color(0xFF4338CA), size: 22),
                      SizedBox(width: 6),
                      Text(
                        "दैनिक शेती नोंदवही",
                        style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                      ),
                    ],
                  ),
                  Text(
                    "खर्च, उत्पन्न व दैनंदिन कामांची डिजिटल डायरी",
                    style: TextStyle(fontSize: 11.5, color: Colors.grey, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const AudioButton(text: "दैनिक शेती नोंदवहीत आपले स्वागत आहे. येथे रोजचा शेती खर्च, उत्पन्न आणि कामांची नोंद ठेवून नफ्याचा हिशोब ठेवा."),
            ],
          ),
          const SizedBox(height: 14),

          // 2. Financial Summary 3-Card Strip
          StaggeredSlideFade(
            delayMs: 0,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E1B4B), Color(0xFF312E81), Color(0xFF4338CA)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(22),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF4338CA).withValues(alpha: 0.35),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _financeBox("एकूण उत्पन्न (Income)", "₹${totalIncome.toInt()}", const Color(0xFF86EFAC)),
                      Container(width: 1, height: 40, color: Colors.white24),
                      _financeBox("एकूण खर्च (Expense)", "₹${totalExpense.toInt()}", const Color(0xFFFCA5A5)),
                      Container(width: 1, height: 40, color: Colors.white24),
                      _financeBox("निव्वळ शिल्लक (Net)", "₹${netProfit.toInt()}", const Color(0xFFFDE047)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        "एकूण नोंदी: ${widget.state.farmDiaryEntries.length} • चालू महिना हिशोब",
                        style: const TextStyle(fontSize: 11, color: Colors.white70, fontWeight: FontWeight.w600),
                      ),
                      BouncyPressable(
                        onTap: () => widget.state.showToast("📄 शेती डायरी PDF रिपोर्ट तयार झाला!"),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.download_rounded, color: Colors.white, size: 12),
                              SizedBox(width: 3),
                              Text("PDF हिशोब", style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // 3. Floating Action: Add New Entry Button
          ElevatedButton.icon(
            onPressed: _openAddEntryDialog,
            icon: const Icon(Icons.add_circle_rounded, color: Colors.white, size: 20),
            label: const Text("नवीन नोंद जोडा (+15 नाणी)", style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Colors.white)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1B4332),
              minimumSize: const Size(double.infinity, 46),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              elevation: 2,
            ),
          ),
          const SizedBox(height: 14),

          // 4. Filter Pills
          Row(
            children: [
              _filterPill(null, "सर्व (${widget.state.farmDiaryEntries.length})"),
              const SizedBox(width: 6),
              _filterPill(FarmDiaryType.expense, "खर्च"),
              const SizedBox(width: 6),
              _filterPill(FarmDiaryType.income, "उत्पन्न"),
              const SizedBox(width: 6),
              _filterPill(FarmDiaryType.farmActivity, "शेती कामे"),
            ],
          ),
          const SizedBox(height: 14),

          // 5. Diary Entries Timeline
          if (filteredEntries.isEmpty)
            Container(
              padding: const EdgeInsets.all(30),
              alignment: Alignment.center,
              child: const Text("कोणतीही नोंद आढळली नाही. नवीन नोंद जोडा.", style: TextStyle(color: Colors.grey)),
            )
          else
            ...filteredEntries.map((e) {
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
                              Text(
                                e.title,
                                style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                              ),
                              if (e.type != FarmDiaryType.farmActivity)
                                Text(
                                  "$prefix${e.amount.toInt()}",
                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: amountColor),
                                ),
                            ],
                          ),
                          Text(
                            "${e.category} • ${e.cropName} • ${e.date}",
                            style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            e.notes,
                            style: const TextStyle(fontSize: 11.5, color: Color(0xFF4B5563), height: 1.3),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.delete_outline_rounded, color: Colors.grey.shade400, size: 18),
                      onPressed: () => widget.state.deleteDiaryEntry(e.id),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _financeBox(String title, String value, Color valColor) {
    return Column(
      children: [
        Text(title.split(' ').first, style: const TextStyle(fontSize: 10, color: Colors.white70, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: valColor)),
      ],
    );
  }

  Widget _filterPill(FarmDiaryType? type, String label) {
    final isSel = _filterType == type;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _filterType = type),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 7),
          decoration: BoxDecoration(
            color: isSel ? const Color(0xFF4338CA) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isSel ? const Color(0xFF4338CA) : Colors.grey.shade300),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              fontWeight: isSel ? FontWeight.w900 : FontWeight.w700,
              color: isSel ? Colors.white : const Color(0xFF374151),
            ),
          ),
        ),
      ),
    );
  }
}
