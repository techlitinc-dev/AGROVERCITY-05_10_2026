// Broadcaster Host Dialogs: Pin Announcement and Create Poll

import 'package:flutter/material.dart';

class SetPinDialog extends StatefulWidget {
  final String initialText;
  final ValueChanged<String> onSave;

  const SetPinDialog({
    super.key,
    required this.initialText,
    required this.onSave,
  });

  @override
  State<SetPinDialog> createState() => _SetPinDialogState();
}

class _SetPinDialogState extends State<SetPinDialog> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.initialText);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Row(
        children: [
          Icon(Icons.push_pin_rounded, color: Color(0xFFD97706)),
          SizedBox(width: 8),
          Text("सूचना पिन करा (Pin)", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        ],
      ),
      content: TextField(
        controller: _controller,
        maxLines: 3,
        decoration: InputDecoration(
          hintText: "उदा. आजच्या सत्रात विचारलेल्या सर्व प्रश्नांची उत्तरे दिली जातील...",
          hintStyle: TextStyle(fontSize: 12, color: Colors.grey.shade400),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () {
            widget.onSave('');
            Navigator.pop(context);
          },
          child: const Text("काढून टाका (Clear)", style: TextStyle(color: Colors.red)),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1B4332),
            foregroundColor: Colors.white,
          ),
          onPressed: () {
            widget.onSave(_controller.text.trim());
            Navigator.pop(context);
          },
          child: const Text("जतन करा"),
        ),
      ],
    );
  }
}

class CreatePollDialog extends StatefulWidget {
  final Future<void> Function(String question, List<String> options) onSubmit;

  const CreatePollDialog({super.key, required this.onSubmit});

  @override
  State<CreatePollDialog> createState() => _CreatePollDialogState();
}

class _CreatePollDialogState extends State<CreatePollDialog> {
  final TextEditingController _questionController = TextEditingController();
  final List<TextEditingController> _optionControllers = [
    TextEditingController(text: "होय (Yes)"),
    TextEditingController(text: "नाही (No)"),
  ];
  bool _submitting = false;

  void _addOption() {
    if (_optionControllers.length < 4) {
      setState(() {
        _optionControllers.add(TextEditingController());
      });
    }
  }

  void _removeOption(int idx) {
    if (_optionControllers.length > 2) {
      setState(() {
        _optionControllers.removeAt(idx).dispose();
      });
    }
  }

  Future<void> _submit() async {
    final q = _questionController.text.trim();
    final opts = _optionControllers
        .map((c) => c.text.trim())
        .where((t) => t.isNotEmpty)
        .toList();
    if (q.isEmpty || opts.length < 2) return;

    setState(() => _submitting = true);
    try {
      await widget.onSubmit(q, opts);
      if (mounted) Navigator.pop(context);
    } catch (_) {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _questionController.dispose();
    for (final c in _optionControllers) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Row(
        children: [
          Icon(Icons.how_to_vote_rounded, color: Color(0xFF15803D)),
          SizedBox(width: 8),
          Text("नवीन मतदान तयार करा", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("प्रश्न:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            TextField(
              controller: _questionController,
              decoration: InputDecoration(
                hintText: "उदा. तुम्ही बांबू लागवड करण्यास इच्छुक आहात का?",
                hintStyle: TextStyle(fontSize: 12, color: Colors.grey.shade400),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 12),
            const Text("पर्याय:", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            ..._optionControllers.asMap().entries.map((entry) {
              final idx = entry.key;
              final ctrl = entry.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: ctrl,
                        decoration: InputDecoration(
                          hintText: "पर्याय ${idx + 1}",
                          hintStyle: TextStyle(fontSize: 11.5, color: Colors.grey.shade400),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                      ),
                    ),
                    if (_optionControllers.length > 2)
                      IconButton(
                        icon: const Icon(Icons.remove_circle_outline, color: Colors.red, size: 20),
                        onPressed: () => _removeOption(idx),
                      ),
                  ],
                ),
              );
            }),
            if (_optionControllers.length < 4)
              TextButton.icon(
                onPressed: _addOption,
                icon: const Icon(Icons.add, size: 16, color: Color(0xFF15803D)),
                label: const Text("पर्याय जोडा (+)", style: TextStyle(fontSize: 11.5, color: Color(0xFF15803D), fontWeight: FontWeight.w800)),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text("रद्द करा", style: TextStyle(color: Colors.grey)),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1B4332),
            foregroundColor: Colors.white,
          ),
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
              : const Text("मतदान सुरू करा"),
        ),
      ],
    );
  }
}
