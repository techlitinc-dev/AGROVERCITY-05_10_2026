import 'package:flutter/material.dart';

class SheetScaffold extends StatelessWidget {
  final String title;
  final String? error;
  final bool submitting;
  final String submitLabel;
  final Color color;
  final VoidCallback onSubmit;
  final List<Widget> children;

  const SheetScaffold({
    super.key,
    required this.title,
    required this.error,
    required this.submitting,
    required this.submitLabel,
    required this.color,
    required this.onSubmit,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style:
                  const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          ...children,
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(error!,
                  style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFFDC2626),
                      fontWeight: FontWeight.w700)),
            ),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: color,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: submitting ? null : onSubmit,
              child: Text(submitLabel,
                  style: const TextStyle(fontWeight: FontWeight.w900)),
            ),
          ),
        ],
      ),
    );
  }
}
