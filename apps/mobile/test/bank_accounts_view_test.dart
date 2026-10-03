import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/bank_accounts_api.dart';
import 'package:kisan_setu/models/bank_account.dart';
import 'package:kisan_setu/views/bank_accounts_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeBankAccountsApi extends BankAccountsApi {
  List<BankAccount> accounts = [];

  final List<String> verifyCalls = [];
  final List<Map<String, String>> addCalls = [];
  final List<String> setPrimaryCalls = [];
  final List<String> deleteCalls = [];

  @override
  Future<List<BankAccount>> listAccounts() async => accounts;

  @override
  Future<BankAccount> addAccount({
    required String accountHolder,
    required String accountNumber,
    required String ifsc,
    required String bankName,
  }) async {
    addCalls.add({
      'accountHolder': accountHolder,
      'accountNumber': accountNumber,
      'ifsc': ifsc,
      'bankName': bankName,
    });
    final account = BankAccount(
      id: 'ba-new',
      accountHolder: accountHolder,
      accountNumberMasked: 'XXXXXX${accountNumber.substring(accountNumber.length - 4)}',
      ifsc: ifsc,
      bankName: bankName,
      isPrimary: false,
      verifyStatus: 'unverified',
      createdAt: '2026-09-16',
    );
    accounts = [...accounts, account];
    return account;
  }

  @override
  Future<BankAccount> verifyAccount(String id) async {
    verifyCalls.add(id);
    accounts = [
      for (final a in accounts)
        if (a.id == id)
          BankAccount(
            id: a.id,
            accountHolder: a.accountHolder,
            accountNumberMasked: a.accountNumberMasked,
            ifsc: a.ifsc,
            bankName: a.bankName,
            isPrimary: a.isPrimary,
            verifyStatus: 'verified',
            createdAt: a.createdAt,
          )
        else
          a,
    ];
    return accounts.firstWhere((a) => a.id == id);
  }

  @override
  Future<Map<String, dynamic>> setPrimary(String id) async {
    setPrimaryCalls.add(id);
    return {'ok': true};
  }

  @override
  Future<void> deleteAccount(String id) async {
    deleteCalls.add(id);
    accounts = accounts.where((a) => a.id != id).toList();
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('renders accounts with primary and verify chips', (tester) async {
    final api = FakeBankAccountsApi()
      ..accounts = [
        const BankAccount(
          id: 'ba1',
          accountHolder: 'सचिन देशमुख',
          accountNumberMasked: 'XXXXXX1234',
          ifsc: 'SBIN0001234',
          bankName: 'स्टेट बैंक ऑफ इंडिया',
          isPrimary: true,
          verifyStatus: 'verified',
          createdAt: '2026-09-01',
        ),
        const BankAccount(
          id: 'ba2',
          accountHolder: 'सचिन देशमुख',
          accountNumberMasked: 'XXXXXX5678',
          ifsc: 'HDFC0002345',
          bankName: 'HDFC बैंक',
          isPrimary: false,
          verifyStatus: 'unverified',
          createdAt: '2026-09-05',
        ),
      ];

    await pumpScreen(
        tester, BankAccountsView(state: TestAppState(), bankAccountsApi: api));

    expect(find.text('स्टेट बैंक ऑफ इंडिया'), findsOneWidget);
    expect(find.text('प्राथमिक'), findsOneWidget);
    expect(find.text('सत्यापित ✓'), findsOneWidget);
    expect(find.textContaining('XXXXXX1234'), findsOneWidget);
    expect(find.text('असत्यापित'), findsOneWidget);
  });

  testWidgets('verify action calls API and flips chip', (tester) async {
    final api = FakeBankAccountsApi()
      ..accounts = [
        const BankAccount(
          id: 'ba2',
          accountHolder: 'सचिन देशमुख',
          accountNumberMasked: 'XXXXXX5678',
          ifsc: 'HDFC0002345',
          bankName: 'HDFC बैंक',
          isPrimary: false,
          verifyStatus: 'unverified',
          createdAt: '2026-09-05',
        ),
      ];

    await pumpScreen(
        tester, BankAccountsView(state: TestAppState(), bankAccountsApi: api));

    await tester.tap(find.text('सत्यापित करें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.verifyCalls, ['ba2']);
    expect(find.text('सत्यापित ✓'), findsOneWidget);
  });

  testWidgets('invalid IFSC blocks add with inline error', (tester) async {
    final api = FakeBankAccountsApi();

    await pumpScreen(
        tester, BankAccountsView(state: TestAppState(), bankAccountsApi: api));

    await tester.tap(find.text('+ खाता जोड़ें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.enterText(
        find.widgetWithText(TextField, 'IFSC'), 'SBIN1234');
    await tester.pump();

    expect(find.text('IFSC अमान्य'), findsOneWidget);

    await tester.tap(find.text('खाता जोड़ें'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.addCalls, isEmpty);
  });
}
