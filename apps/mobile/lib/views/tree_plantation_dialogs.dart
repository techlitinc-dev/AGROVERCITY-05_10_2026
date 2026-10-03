// Tree Plantation — sapling request dialog + article detail sheet (split
// from tree_plantation_view.dart for the line cap; verbatim styling).

import 'package:flutter/material.dart';

import '../components/common/audio_button.dart';
import '../models/tree_models.dart';
import '../state/app_state.dart';

class SaplingRequestDialog extends StatefulWidget {
  final NgoOrganization ngo;
  final AppState state;
  final String farmerLabel;
  final void Function(String treeType, int count) onSubmit;
  final void Function(String message) onValidationError;

  const SaplingRequestDialog({
    super.key,
    required this.ngo,
    required this.state,
    required this.farmerLabel,
    required this.onSubmit,
    required this.onValidationError,
  });

  @override
  State<SaplingRequestDialog> createState() => _SaplingRequestDialogState();
}

class _SaplingRequestDialogState extends State<SaplingRequestDialog> {
  List<(String, String)> get _treeTypes => [
    (widget.state.tr('tree.typeTimber'), "timber"),
    (widget.state.tr('tree.typeBiofuel'), "biofuel"),
    (widget.state.tr('tree.typeFruit'), "fruit"),
    (widget.state.tr('tree.typeBamboo'), "bamboo"),
  ];

  String _selected = "timber";
  final _countController = TextEditingController(text: "50");

  @override
  void dispose() {
    _countController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ngo = widget.ngo;
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: Colors.white,
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFE8F5E9),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.park_rounded, color: Color(0xFF2E7D32), size: 24),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              "${widget.state.tr('tree.saplingRequestTitle')}\n(${ngo.name})",
              style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.state.tr('tree.selectTreeType'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: _treeTypes.map((t) {
              final isSel = _selected == t.$2;
              return ChoiceChip(
                label: Text(t.$1, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: isSel ? Colors.white : const Color(0xFF1B4332))),
                selected: isSel,
                selectedColor: const Color(0xFF1B4332),
                onSelected: (_) => setState(() => _selected = t.$2),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          Text(widget.state.tr('tree.saplingCountNeeded'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          TextField(
            controller: _countController,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              hintText: widget.state.tr('tree.countHint'),
              prefixIcon: const Icon(Icons.forest_rounded, color: Color(0xFF2E7D32), size: 18),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "${widget.state.tr('tree.farmerName')}: ${widget.farmerLabel}",
            style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(widget.state.tr('cancel'), style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.w700)),
        ),
        ElevatedButton(
          onPressed: () {
            final count = int.tryParse(_countController.text.trim()) ?? 50;
            if (count > 500) {
              // client-side cap: no API call beyond 500 saplings
              widget.onValidationError(widget.state.tr('tree.max500Saplings'));
              return;
            }
            Navigator.pop(context);
            widget.onSubmit(_selected, count < 1 ? 1 : count);
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1B4332),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
          ),
          child: Text(widget.state.tr('tree.submitRequest'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
        ),
      ],
    );
  }
}

class TreeArticleDetailSheet extends StatelessWidget {
  final TreeArticle article;
  final AppState state;
  final VoidCallback onRequestSaplings;

  const TreeArticleDetailSheet({
    super.key,
    required this.article,
    required this.state,
    required this.onRequestSaplings,
  });

  @override
  Widget build(BuildContext context) {
    final art = article;
    return Container(
      height: MediaQuery.of(context).size.height * 0.82,
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
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
                    color: const Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    art.category,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32)),
                  ),
                ),
                AudioButton(text: "${art.vernacularTitle}. ${art.summary}"),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              art.vernacularTitle,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF112A1F), height: 1.3),
            ),
            const SizedBox(height: 6),
            Text(
              "${state.tr('tree.author')}: ${art.author} • ${state.tr('tree.readingTime')}: ${art.readTime} • ${art.publishedDate}",
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F8E9),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFC8E6C9)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.eco_rounded, color: Color(0xFF2E7D32), size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      "${state.tr('tree.benefits')}: ${art.benefits}",
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF1B5E20)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              art.fullContent,
              style: const TextStyle(fontSize: 14, height: 1.6, color: Color(0xFF263238)),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                onRequestSaplings();
              },
              icon: const Icon(Icons.nature_people_rounded, color: Colors.white, size: 18),
              label: Text(state.tr('tree.requestSaplingsForTrees'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B4332),
                minimumSize: const Size(double.infinity, 46),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
