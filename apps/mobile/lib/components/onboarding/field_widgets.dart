import 'package:flutter/material.dart';

class LabeledTextField extends StatelessWidget {
  const LabeledTextField({
    super.key,
    required this.controller,
    required this.label,
    this.keyboardType,
    this.errorText,
    this.prefix,
  });

  final TextEditingController controller;
  final String label;
  final TextInputType? keyboardType;
  final String? errorText;
  final String? prefix;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        errorText: errorText,
        prefixText: prefix,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}

class ChipSelector extends StatelessWidget {
  const ChipSelector({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
  });

  final List<String> options;
  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final option in options)
          ChoiceChip(
            label: Text(option),
            selected: option == selected,
            selectedColor: const Color(0xFFE8F5E9),
            onSelected: (_) => onSelected(option),
          ),
      ],
    );
  }
}

class CropSelectorField extends StatefulWidget {
  const CropSelectorField({
    super.key,
    required this.options,
    required this.selected,
    required this.onChanged,
    this.addLabel = 'अन्य फसल जोड़ें',
    this.addHint = 'फसल का नाम लिखें',
  });

  final List<String> options;
  final List<String> selected;
  final ValueChanged<List<String>> onChanged;
  final String addLabel;
  final String addHint;

  @override
  State<CropSelectorField> createState() => _CropSelectorFieldState();
}

class _CropSelectorFieldState extends State<CropSelectorField> {
  final _customController = TextEditingController();
  bool _adding = false;

  @override
  void dispose() {
    _customController.dispose();
    super.dispose();
  }

  void _toggle(String crop) {
    final next = List<String>.from(widget.selected);
    next.contains(crop) ? next.remove(crop) : next.add(crop);
    widget.onChanged(next);
  }

  void _addCustom() {
    final crop = _customController.text.trim();
    if (crop.isEmpty) return;
    _customController.clear();
    setState(() => _adding = false);
    if (!widget.selected.contains(crop)) {
      widget.onChanged([...widget.selected, crop]);
    }
  }

  @override
  Widget build(BuildContext context) {
    final allOptions = {
      ...widget.options,
      ...widget.selected,
    }.toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final crop in allOptions)
              FilterChip(
                label: Text(crop),
                selected: widget.selected.contains(crop),
                selectedColor: const Color(0xFFE8F5E9),
                onSelected: (_) => _toggle(crop),
              ),
            ActionChip(
              avatar: const Icon(Icons.add_rounded, size: 16),
              label: Text(widget.addLabel),
              onPressed: () => setState(() => _adding = !_adding),
            ),
          ],
        ),
        if (_adding)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _customController,
                    decoration: InputDecoration(
                      hintText: widget.addHint,
                      isDense: true,
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onSubmitted: (_) => _addCustom(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _addCustom,
                  icon: const Icon(Icons.check_rounded),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
