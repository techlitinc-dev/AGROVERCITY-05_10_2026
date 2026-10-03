// Finance widgets — credit-score card and KCC cards.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../components/common/glass_card.dart';
import '../api/bank_accounts_api.dart';
import '../api/loans_api.dart';
import '../models/bank_account.dart';
import '../models/loan_application.dart';
import '../state/app_state.dart';

final _inr = NumberFormat('#,##,##0', 'en_IN');

class CreditScoreCard extends StatelessWidget {
  final Map<String, dynamic> credit;
  final AppState state;

  const CreditScoreCard({super.key, required this.credit, required this.state});

  @override
  Widget build(BuildContext context) {
    final score = (credit['kisanCreditScore'] as num?)?.toInt() ?? 0;
    final tier = credit['creditTier'] as String? ?? '';
    final limit = (credit['creditLimit'] as num?)?.toDouble() ?? 0;
    final factors = (credit['factors'] as List?)?.cast<String>() ?? const [];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1B4332), Color(0xFF0D1F17)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Text(state.tr('finance.rbiCompliant'), style: const TextStyle(fontSize: 10.5, color: Color(0xFFE9C46A), fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text("$score", style: const TextStyle(fontSize: 48, fontWeight: FontWeight.w900, color: Color(0xFFE9C46A))),
          Text(tier, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF52B788))),
          const SizedBox(height: 4),
          Text("${state.tr('finance.maxCreditLimit')}: ₹${_inr.format(limit.toInt())}", style: const TextStyle(fontSize: 11, color: Colors.white70)),
          if (factors.isNotEmpty) ...[
            const SizedBox(height: 8),
            for (final f in factors)
              Text("• $f", style: const TextStyle(fontSize: 10.5, color: Colors.white60)),
          ],
        ],
      ),
    );
  }
}

class KccCard extends StatelessWidget {
  final Map<String, dynamic> kcc;
  final String holderName;
  final AppState state;

  const KccCard({super.key, required this.kcc, required this.holderName, required this.state});

  @override
  Widget build(BuildContext context) {
    final bankName = kcc['bankName'] as String? ?? '';
    final cardNumber = kcc['cardNumberMasked'] as String? ?? '';
    final limit = (kcc['kccLimit'] as num?)?.toDouble() ?? 0;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1E382B), Color(0xFF2D6A4F), Color(0xFFD4A373)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("KISAN CREDIT CARD", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
              Text(bankName, style: const TextStyle(color: Colors.white70, fontSize: 11)),
            ],
          ),
          const SizedBox(height: 16),
          Text(cardNumber, style: const TextStyle(color: Colors.white, fontSize: 16, fontFamily: 'monospace', letterSpacing: 2)),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(holderName.toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
              Text("${state.tr('finance.limit')}: ₹${_inr.format(limit.toInt())}", style: const TextStyle(color: Color(0xFFE9C46A), fontWeight: FontWeight.w800, fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }
}

class KccMissingCard extends StatelessWidget {
  final VoidCallback onApply;
  final bool applying;
  final AppState state;

  const KccMissingCard({super.key, required this.onApply, required this.applying, required this.state});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF2D6A4F).withValues(alpha: 0.35)),
      ),
      child: Column(
        children: [
          const Text("KISAN CREDIT CARD", style: TextStyle(color: Color(0xFF2D6A4F), fontWeight: FontWeight.w800, fontSize: 13)),
          const SizedBox(height: 8),
          Text(state.tr('finance.kccNotLinked'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF112A1F))),
          const SizedBox(height: 10),
          ElevatedButton(
            onPressed: applying ? null : onApply,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1B4332),
              foregroundColor: Colors.white,
            ),
            child: Text(state.tr('applyNow'), style: const TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}

// "My Loans" entry card on the finance screen — self-loads the farmer's
// applications and shows counts by open status.
class MyLoansEntryCard extends StatefulWidget {
  final AppState state;
  final LoansApi? loansApi;

  const MyLoansEntryCard({super.key, required this.state, this.loansApi});

  @override
  State<MyLoansEntryCard> createState() => _MyLoansEntryCardState();
}

class _MyLoansEntryCardState extends State<MyLoansEntryCard> {
  late final LoansApi _api = widget.loansApi ?? LoansApi();

  List<LoanApplication> _loans = const [];
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await _api.listMine();
      if (!mounted) return;
      setState(() {
        _loans = ((res['data'] as List?) ?? const <dynamic>[])
            .map((e) =>
                LoanApplication.fromJson((e as Map).cast<String, dynamic>()))
            .toList();
        _loaded = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loaded = true);
    }
  }

  int _countByStatus(Set<String> statuses) =>
      _loans.where((l) => statuses.contains(l.status)).length;

  @override
  Widget build(BuildContext context) {
    if (!_loaded) return const SizedBox.shrink();
    final state = widget.state;
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      borderRadius: 14,
      blur: 12,
      onTap: () => state.navigateTo('loanTracking'),
      child: Row(
        children: [
          const Icon(Icons.account_balance_wallet_rounded,
              color: Color(0xFF1B4332)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(state.tr('loans.myLoans'),
                    style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w800)),
                Text(
                  "${state.tr('loans.inProgress')}: ${_countByStatus(const {
                        LoanStatus.submitted,
                        LoanStatus.underReview,
                        LoanStatus.infoRequested,
                      })} • "
                  "${state.tr('loans.approved')}: ${_countByStatus(const {
                        LoanStatus.approved,
                        LoanStatus.disbursed,
                      })} • "
                  "${state.tr('loans.statusRejected')}: ${_countByStatus(const {
                        LoanStatus.rejected,
                      })}",
                  style: const TextStyle(fontSize: 11.5),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: Colors.grey),
        ],
      ),
    );
  }
}

// Verified bank-account selector used by the loan apply flow — self-loads
// the user's accounts and reports the selection via [onChanged].
class LoanAccountPicker extends StatefulWidget {
  final AppState state;
  final BankAccountsApi? bankAccountsApi;
  final ValueChanged<String?> onChanged;

  const LoanAccountPicker({
    super.key,
    required this.state,
    required this.onChanged,
    this.bankAccountsApi,
  });

  @override
  State<LoanAccountPicker> createState() => _LoanAccountPickerState();
}

class _LoanAccountPickerState extends State<LoanAccountPicker> {
  late final BankAccountsApi _api =
      widget.bankAccountsApi ?? BankAccountsApi();

  List<BankAccount> _verified = const [];
  String? _selectedId;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final accounts = await _api.listAccounts();
      if (!mounted) return;
      setState(() {
        _verified =
            accounts.where((a) => a.verifyStatus == 'verified').toList();
        final primary = _verified.where((a) => a.isPrimary);
        _selectedId = primary.isNotEmpty
            ? primary.first.id
            : (_verified.isNotEmpty ? _verified.first.id : null);
        _loaded = true;
      });
      if (_selectedId != null) widget.onChanged(_selectedId);
    } catch (_) {
      if (!mounted) return;
      setState(() => _loaded = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded) return const SizedBox.shrink();
    final state = widget.state;
    if (_verified.isEmpty) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded,
              size: 15, color: Color(0xFFB45309)),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              state.tr('loans.bankAccountHint'),
              style: const TextStyle(fontSize: 11, color: Color(0xFFB45309)),
            ),
          ),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(state.tr('loans.bankAccount'),
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: _selectedId,
          decoration: InputDecoration(
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            isDense: true,
          ),
          hint: Text(state.tr('loans.bankAccountNone'),
              style: const TextStyle(fontSize: 12)),
          items: [
            for (final a in _verified)
              DropdownMenuItem(
                value: a.id,
                child: Text(
                  "${a.bankName} • ${a.accountNumberMasked}",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12),
                ),
              ),
          ],
          onChanged: (id) {
            setState(() => _selectedId = id);
            widget.onChanged(id);
          },
        ),
      ],
    );
  }
}
