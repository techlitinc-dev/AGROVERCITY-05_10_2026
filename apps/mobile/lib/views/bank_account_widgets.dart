// Day 9 Task B5 — bank account add form sheet (F16).

import 'package:flutter/material.dart';
import '../state/app_state.dart';

final ifscRegex = RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$');

typedef BankAccountFormResult = ({
  String accountHolder,
  String accountNumber,
  String ifsc,
  String bankName,
});

Future<BankAccountFormResult?> showBankAccountFormSheet(BuildContext context,
    {required AppState state}) {
  final holderCtrl = TextEditingController();
  final numberCtrl = TextEditingController();
  final ifscCtrl = TextEditingController();
  final bankCtrl = TextEditingController();
  String? ifscError;

  return showModalBottomSheet<BankAccountFormResult>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => StatefulBuilder(
      builder: (context, setSheetState) => Padding(
        padding: EdgeInsets.fromLTRB(
            18, 18, 18, 18 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(state.tr('bank.formTitle'),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
              const SizedBox(height: 14),
              TextField(controller: holderCtrl, decoration: InputDecoration(labelText: state.tr('bank.holderName'), border: const OutlineInputBorder())),
              const SizedBox(height: 10),
              TextField(
                controller: numberCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: state.tr('bank.accountNumber'), border: const OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: ifscCtrl,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  labelText: "IFSC",
                  border: const OutlineInputBorder(),
                  errorText: ifscError,
                ),
                onChanged: (v) => setSheetState(() {
                  final ifsc = v.trim().toUpperCase();
                  if (ifsc != v.trim()) {
                    ifscCtrl.value = TextEditingValue(
                      text: ifsc,
                      selection: TextSelection.collapsed(offset: ifsc.length),
                    );
                  }
                  ifscError = ifsc.isNotEmpty && !ifscRegex.hasMatch(ifsc)
                      ? state.tr('bank.invalidIfsc')
                      : null;
                }),
              ),
              const SizedBox(height: 10),
              TextField(controller: bankCtrl, decoration: InputDecoration(labelText: state.tr('bank.bankName'), border: const OutlineInputBorder())),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  final holder = holderCtrl.text.trim();
                  final number = numberCtrl.text.trim();
                  final ifsc = ifscCtrl.text.trim().toUpperCase();
                  final bank = bankCtrl.text.trim();
                  if (!ifscRegex.hasMatch(ifsc)) {
                    setSheetState(() => ifscError = state.tr('bank.invalidIfsc'));
                    return; // no API call on invalid IFSC
                  }
                  if (holder.length < 3 ||
                      !RegExp(r'^\d{9,18}$').hasMatch(number) ||
                      bank.isEmpty) {
                    return;
                  }
                  Navigator.pop(ctx, (
                    accountHolder: holder,
                    accountNumber: number,
                    ifsc: ifsc,
                    bankName: bank,
                  ));
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B4332),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 44),
                ),
                child: Text(state.tr('bank.addAccount'), style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
