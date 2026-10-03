import 'api_client.dart';
import 'endpoints.dart';

class FinanceApi {
  FinanceApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  // {kisanCreditScore, creditTier, creditLimit, factors}
  Future<Map<String, dynamic>> getCreditScore() =>
      _client.get(pathFinanceCreditScore);

  // {emi, totalInterest, totalPayable}
  Future<Map<String, dynamic>> calcEmi(
    double amount,
    int tenureMonths, {
    double interestRate = 7,
  }) =>
      _client.post(pathFinanceLoanCalculator, body: {
        'amount': amount,
        'tenureMonths': tenureMonths,
        'interestRate': interestRate,
      });

  // {bankName, cardNumberMasked, kccLimit, availableLimit};
  // throws ApiException(code: 'KCC_NOT_FOUND') when the user has no KCC.
  Future<Map<String, dynamic>> getKcc() => _client.get(pathFinanceKcc);

  // 201 {applicationId, status}
  Future<Map<String, dynamic>> applyLoan({
    required double amount,
    required int tenureMonths,
    required String purpose,
    String? bankAccountId,
  }) =>
      _client.post(pathFinanceLoansApply, body: {
        'amount': amount,
        'tenureMonths': tenureMonths,
        'purpose': purpose,
        if (bankAccountId != null && bankAccountId.isNotEmpty)
          'bankAccountId': bankAccountId,
      });
}
