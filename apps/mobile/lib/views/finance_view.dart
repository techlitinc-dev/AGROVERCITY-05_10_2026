// Module N: Embedded Finance Stack Flutter View (API-wired)

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../api/api_exception.dart';
import '../api/bank_accounts_api.dart';
import '../api/finance_api.dart';
import '../api/loans_api.dart';
import '../state/app_state.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';
import 'finance_widgets.dart';

class FinanceView extends StatefulWidget {
  final AppState state;
  final FinanceApi? financeApi;
  final LoansApi? loansApi;
  final BankAccountsApi? bankAccountsApi;
  const FinanceView({
    super.key,
    required this.state,
    this.financeApi,
    this.loansApi,
    this.bankAccountsApi,
  });

  @override
  State<FinanceView> createState() => _FinanceViewState();
}

class _FinanceViewState extends State<FinanceView> {
  late final FinanceApi _api = widget.financeApi ?? FinanceApi();

  double _loanAmt = 25000;
  double _tenureMonths = 6;

  Map<String, dynamic>? _credit;
  bool _creditLoading = true;
  Map<String, dynamic>? _kcc;
  bool _kccMissing = false;
  bool _kccLoading = true;
  bool _applying = false;

  String? _selectedAccountId;

  double _emi = 0;
  double _totalInterest = 0;
  double _totalPayable = 0;

  static final _inr2 = NumberFormat('#,##,##0.00', 'en_IN');

  @override
  void initState() {
    super.initState();
    _applyLocalEmi();
    _loadCredit();
    _loadKcc();
  }

  double get _creditLimit =>
      (_credit?['creditLimit'] as num?)?.toDouble() ?? 50000;

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  // Same EMI formula as the backend; offline fallback when the API fails.
  void _applyLocalEmi() {
    const r = 7 / 12 / 100;
    final n = _tenureMonths.toInt();
    final pow = math.pow(1 + r, n).toDouble();
    final emi = _loanAmt * r * pow / (pow - 1);
    _emi = double.parse(emi.toStringAsFixed(2));
    _totalPayable = double.parse((_emi * n).toStringAsFixed(2));
    _totalInterest = double.parse((_totalPayable - _loanAmt).toStringAsFixed(2));
  }

  Future<void> _recalcEmi() async {
    try {
      final res = await _api.calcEmi(_loanAmt, _tenureMonths.toInt());
      if (!mounted) return;
      setState(() {
        _emi = (res['emi'] as num?)?.toDouble() ?? _emi;
        _totalInterest = (res['totalInterest'] as num?)?.toDouble() ?? 0;
        _totalPayable = (res['totalPayable'] as num?)?.toDouble() ?? 0;
      });
    } catch (_) {
      if (!mounted) return;
      setState(_applyLocalEmi);
    }
  }

  Future<void> _loadCredit() async {
    try {
      final res = await _api.getCreditScore();
      if (!mounted) return;
      setState(() {
        _credit = res;
        _creditLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _creditLoading = false);
    }
  }

  Future<void> _loadKcc() async {
    try {
      final res = await _api.getKcc();
      if (!mounted) return;
      setState(() {
        _kcc = res;
        _kccMissing = false;
        _kccLoading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _kccMissing = e.code == 'KCC_NOT_FOUND';
        _kccLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _kccLoading = false);
    }
  }

  Future<void> _applyForKcc() async {
    setState(() => _applying = true);
    try {
      await _api.applyLoan(
        amount: _creditLimit,
        tenureMonths: 12,
        purpose: 'KCC application',
        bankAccountId: _selectedAccountId,
      );
      _snack(widget.state.tr('finance.applicationSubmitted'));
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    } finally {
      if (mounted) setState(() => _applying = false);
    }
  }

  Future<void> _applyInstantLoan() async {
    try {
      await _api.applyLoan(
        amount: _loanAmt,
        tenureMonths: _tenureMonths.toInt(),
        purpose: 'Instant input loan',
        bankAccountId: _selectedAccountId,
      );
      widget.state.showToast(widget.state
          .tr('finance.instantLoanApproved')
          .replaceAll('{amount}', '${_loanAmt.toInt()}'));
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.state.tr('finance.headerTitle'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text(widget.state.tr('finance.headerSubtitle'), style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              AudioButton(text: widget.state.tr('finance.audioIntro')),
            ],
          ),
          const SizedBox(height: 14),

          // Credit Score Card
          if (_creditLoading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: CircularProgressIndicator(color: Color(0xFF43A047)),
              ),
            )
          else if (_credit != null)
            CreditScoreCard(credit: _credit!, state: widget.state),
          const SizedBox(height: 16),

          // Instant Loan Calculator
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.state.tr('finance.instantLoanTitle'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                Text(widget.state.tr('finance.interestRate'), style: const TextStyle(fontSize: 11.5, color: Color(0xFF16A34A), fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),

                Text("${widget.state.tr('finance.loanAmount')}: ₹${_loanAmt.toInt()}", style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                Slider(
                  min: 5000,
                  max: 50000,
                  divisions: 18,
                  value: _loanAmt,
                  activeColor: const Color(0xFF1B4332),
                  onChanged: (v) => setState(() {
                    _loanAmt = v;
                    _applyLocalEmi();
                  }),
                  onChangeEnd: (_) => _recalcEmi(),
                ),

                Text("${widget.state.tr('finance.tenure')}: ${_tenureMonths.toInt()} ${widget.state.tr('finance.months')}", style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                Slider(
                  min: 3,
                  max: 12,
                  value: _tenureMonths,
                  activeColor: const Color(0xFF1B4332),
                  onChanged: (v) => setState(() {
                    _tenureMonths = v;
                    _applyLocalEmi();
                  }),
                  onChangeEnd: (_) => _recalcEmi(),
                ),

                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0xFFD8F3DC), borderRadius: BorderRadius.circular(12)),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("${widget.state.tr('finance.monthlyEmi')}:", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF1B4332))),
                      Text("₹${_inr2.format(_emi)} / ${widget.state.tr('finance.months')}", style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF1B4332))),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("${widget.state.tr('finance.totalInterest')}:", style: const TextStyle(fontSize: 11.5, color: Color(0xFF1B4332), fontWeight: FontWeight.w600)),
                    Text("₹${_inr2.format(_totalInterest)}", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
                  ],
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("${widget.state.tr('finance.totalPayable')}:", style: const TextStyle(fontSize: 11.5, color: Color(0xFF1B4332), fontWeight: FontWeight.w600)),
                    Text("₹${_inr2.format(_totalPayable)}", style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
                  ],
                ),
                const SizedBox(height: 12),
                LoanAccountPicker(
                  state: widget.state,
                  bankAccountsApi: widget.bankAccountsApi,
                  onChanged: (id) =>
                      setState(() => _selectedAccountId = id),
                ),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: _applyInstantLoan,
                  icon: const Icon(Icons.bolt_rounded, size: 16),
                  label: Text(widget.state.tr('finance.getAmountNow').replaceAll('{amount}', '${_loanAmt.toInt()}'), style: const TextStyle(fontWeight: FontWeight.w800)),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 42)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Digital KCC Card
          if (_kccLoading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: CircularProgressIndicator(color: Color(0xFF43A047)),
              ),
            )
          else if (_kcc != null)
            KccCard(kcc: _kcc!, holderName: widget.state.profile.name, state: widget.state)
          else if (_kccMissing)
            KccMissingCard(onApply: _applyForKcc, applying: _applying, state: widget.state),
          const SizedBox(height: 16),

          // My Loans entry (self-loading loan tracking card)
          MyLoansEntryCard(state: widget.state, loansApi: widget.loansApi),
          const SizedBox(height: 10),

          // Bank accounts entry (F16)
          Card(
            elevation: 0,
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(color: Colors.grey.shade200),
            ),
            child: ListTile(
              leading: const Icon(Icons.account_balance_rounded, color: Color(0xFF1B4332)),
              title: Text(widget.state.tr('finance.bankAccounts'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
              subtitle: Text(widget.state.tr('finance.bankAccountsSub'), style: const TextStyle(fontSize: 11.5)),
              trailing: const Icon(Icons.chevron_right_rounded, color: Colors.grey),
              onTap: () => widget.state.navigateTo('bankAccounts'),
            ),
          ),
        ],
      ),
    );
  }
}
