// Claim-submitted dialog: claim number + photo guidelines from the 201
// response (Day 11 B5.4).

import 'package:flutter/material.dart';

Future<void> showClaimSuccessDialog(
  BuildContext context,
  String claimNumber,
  List<String> photoGuidelines,
) {
  return showDialog<void>(
    context: context,
    builder: (dctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Text('दावा दर्ज',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('दावा क्रमांक: $claimNumber',
              style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: Color(0xFF047857))),
          if (photoGuidelines.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Text('फोटो दिशानिर्देश:',
                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            ...photoGuidelines.map((g) => Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text('• $g', style: const TextStyle(fontSize: 11.5)),
                )),
          ],
        ],
      ),
      actions: [
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF047857),
            foregroundColor: Colors.white,
          ),
          onPressed: () => Navigator.pop(dctx),
          child: const Text('ठीक है'),
        ),
      ],
    ),
  );
}
