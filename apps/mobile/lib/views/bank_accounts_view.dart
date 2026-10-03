// Day 9 Task B5 — Bank accounts view (F16), wired to /v1/bank-accounts.

import 'package:flutter/material.dart';
import '../api/api_exception.dart';
import '../api/bank_accounts_api.dart';
import '../models/bank_account.dart';
import '../state/app_state.dart';
import 'bank_account_widgets.dart';

class BankAccountsView extends StatefulWidget {
  final AppState state;
  final BankAccountsApi? bankAccountsApi;
  const BankAccountsView({super.key, required this.state, this.bankAccountsApi});

  @override
  State<BankAccountsView> createState() => _BankAccountsViewState();
}

class _BankAccountsViewState extends State<BankAccountsView> {
  late final BankAccountsApi _api =
      widget.bankAccountsApi ?? BankAccountsApi();

  List<BankAccount> _accounts = [];
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final accounts = await _api.listAccounts();
      if (!mounted) return;
      setState(() {
        _accounts = accounts;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = true;
      });
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _addAccount() async {
    final result =
        await showBankAccountFormSheet(context, state: widget.state);
    if (result == null || !mounted) return;
    try {
      await _api.addAccount(
        accountHolder: result.accountHolder,
        accountNumber: result.accountNumber,
        ifsc: result.ifsc,
        bankName: result.bankName,
      );
      _snack(widget.state.tr('bank.accountAdded'));
      _load();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  Future<void> _verify(BankAccount account) async {
    try {
      await _api.verifyAccount(account.id);
      _snack(widget.state.tr('bank.verificationStarted'));
      _load();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  Future<void> _setPrimary(BankAccount account) async {
    try {
      await _api.setPrimary(account.id);
      _snack(widget.state.tr('bank.primaryChanged'));
      _load();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  Future<void> _confirmDelete(BankAccount account) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text("${widget.state.tr('deleteAccount')}?",
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Text("${account.bankName} • ${account.accountNumberMasked}"),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(widget.state.tr('back'))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(widget.state.tr('deleteK')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await _api.deleteAccount(account.id);
      _snack(widget.state.tr('bank.accountDeleted'));
      _load();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.state.tr('bank.title'),
            style: const TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: const Color(0xFF1B4332),
        foregroundColor: Colors.white,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addAccount,
        backgroundColor: const Color(0xFF1B4332),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: Text('+ ${widget.state.tr('bank.addAccount')}',
            style: const TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF43A047)))
          : _error
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(widget.state.tr('bank.loadFailed'),
                          style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      ElevatedButton(
                          onPressed: _load, child: Text(widget.state.tr('retry'))),
                    ],
                  ),
                )
              : _accounts.isEmpty
                  ? Center(
                      child: Text(widget.state.tr('bank.empty'),
                          style: const TextStyle(color: Colors.grey)))
                  : ListView.builder(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
                      itemCount: _accounts.length,
                      itemBuilder: (_, i) => _accountCard(_accounts[i]),
                    ),
    );
  }

  Widget _verifyChip(BankAccount account) {
    switch (account.verifyStatus) {
      case 'verified':
        return _chip(widget.state.tr('bank.statusVerified'), const Color(0xFF16A34A), const Color(0xFFD1FAE5));
      case 'pending':
        return _chip(widget.state.tr('bank.statusPending'), const Color(0xFFB45309), const Color(0xFFFEF3C7));
      default:
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _chip(widget.state.tr('bank.statusUnverified'), const Color(0xFF6B7280), const Color(0xFFF3F4F6)),
            const SizedBox(width: 6),
            GestureDetector(
              onTap: () => _verify(account),
              child: Text(widget.state.tr('bank.verifyNow'),
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1B4332),
                      decoration: TextDecoration.underline)),
            ),
          ],
        );
    }
  }

  Widget _chip(String label, Color color, Color bg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
      child: Text(label,
          style:
              TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color)),
    );
  }

  Widget _accountCard(BankAccount account) {
    return GestureDetector(
      onLongPress: () => _confirmDelete(account),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1B4332).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.account_balance_rounded,
                      color: Color(0xFF1B4332), size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(account.bankName,
                                style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF1E293B))),
                          ),
                          if (account.isPrimary) ...[
                            const SizedBox(width: 6),
                            const Icon(Icons.star_rounded,
                                size: 15, color: Color(0xFFF59E0B)),
                            Text(widget.state.tr('bank.primaryBadge'),
                                style: const TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFFF59E0B))),
                          ],
                        ],
                      ),
                      Text(
                        "${account.accountNumberMasked} • IFSC ${account.ifsc}",
                        style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
                      ),
                      Text(account.accountHolder,
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                    ],
                  ),
                ),
                if (!account.isPrimary)
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert, color: Colors.grey),
                    onSelected: (action) {
                      if (action == 'primary') _setPrimary(account);
                    },
                    itemBuilder: (_) => [
                      PopupMenuItem(
                          value: 'primary', child: Text(widget.state.tr('bank.makePrimary'))),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 10),
            _verifyChip(account),
          ],
        ),
      ),
    );
  }
}
