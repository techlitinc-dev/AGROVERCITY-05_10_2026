import '../models/bank_account.dart';
import 'api_client.dart';
import 'endpoints.dart';

class BankAccountsApi {
  BankAccountsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<BankAccount>> listAccounts() async {
    final res = await _client.get(pathBankAccounts);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => BankAccount.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<BankAccount> addAccount({
    required String accountHolder,
    required String accountNumber,
    required String ifsc,
    required String bankName,
  }) async {
    final res = await _client.post(pathBankAccounts, body: {
      'accountHolder': accountHolder,
      'accountNumber': accountNumber,
      'ifsc': ifsc,
      'bankName': bankName,
    });
    return BankAccount.fromJson(res);
  }

  Future<BankAccount> verifyAccount(String id) async {
    final res = await _client.post(bankAccountVerifyPath(id));
    return BankAccount.fromJson(res);
  }

  Future<Map<String, dynamic>> setPrimary(String id) =>
      _client.post(bankAccountSetPrimaryPath(id));

  Future<void> deleteAccount(String id) => _client.delete(bankAccountPath(id));
}
