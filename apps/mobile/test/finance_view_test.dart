import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/api/bank_accounts_api.dart';
import 'package:kisan_setu/api/finance_api.dart';
import 'package:kisan_setu/api/loans_api.dart';
import 'package:kisan_setu/models/bank_account.dart';
import 'package:kisan_setu/views/finance_view.dart';

import 'helpers.dart';

class FakeLoansApi extends LoansApi {
  @override
  Future<Map<String, dynamic>> listMine() async => const {
        'data': <Map<String, dynamic>>[],
        'page': 1,
        'pageSize': 50,
        'total': 0,
      };
}

class FakeBankAccountsApi extends BankAccountsApi {
  @override
  Future<List<BankAccount>> listAccounts() async => [];
}

class FakeFinanceApi extends FinanceApi {
  Map<String, dynamic> creditResponse = const {
    'kisanCreditScore': 785,
    'creditTier': 'Gold',
    'creditLimit': 100000,
    'factors': ['Timely KCC repayment', 'Crop insurance coverage'],
  };
  Map<String, dynamic> emiResponse = const {
    'emi': 4256.44,
    'totalInterest': 538.64,
    'totalPayable': 25538.64,
  };
  Object? kccError = const ApiException(code: 'KCC_NOT_FOUND');

  int calcEmiCalls = 0;
  final List<Map<String, dynamic>> applyCalls = [];

  @override
  Future<Map<String, dynamic>> getCreditScore() async => creditResponse;

  @override
  Future<Map<String, dynamic>> calcEmi(
    double amount,
    int tenureMonths, {
    double interestRate = 7,
  }) async {
    calcEmiCalls++;
    return emiResponse;
  }

  @override
  Future<Map<String, dynamic>> getKcc() async {
    final error = kccError;
    if (error != null) throw error;
    return const {
      'bankName': 'SBI Agri',
      'cardNumberMasked': 'XXXX-XXXX-8842',
      'kccLimit': 180000,
      'availableLimit': 180000,
    };
  }

  @override
  Future<Map<String, dynamic>> applyLoan({
    required double amount,
    required int tenureMonths,
    required String purpose,
    String? bankAccountId,
  }) async {
    applyCalls.add({
      'amount': amount,
      'tenureMonths': tenureMonths,
      'purpose': purpose,
      'bankAccountId': bankAccountId,
    });
    return {'applicationId': 'app-fake-1', 'status': 'submitted'};
  }
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('finance renders credit score card', (tester) async {
    final api = FakeFinanceApi();

    await pumpScreen(tester, Scaffold(body: FinanceView(state: TestAppState(), financeApi: api, loansApi: FakeLoansApi(), bankAccountsApi: FakeBankAccountsApi())));

    expect(find.text('785'), findsOneWidget);
    expect(find.text('Gold'), findsOneWidget);
    expect(find.textContaining('₹1,00,000'), findsOneWidget);
  });

  testWidgets('emi updates from api', (tester) async {
    final api = FakeFinanceApi();

    await pumpScreen(tester, Scaffold(body: FinanceView(state: TestAppState(), financeApi: api, loansApi: FakeLoansApi(), bankAccountsApi: FakeBankAccountsApi())));

    expect(find.textContaining('4,256.44'), findsNothing);

    await tester.drag(find.byType(Slider).first, const Offset(200, 0));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.calcEmiCalls, greaterThan(0));
    expect(find.textContaining('4,256.44'), findsOneWidget);
  });
}
