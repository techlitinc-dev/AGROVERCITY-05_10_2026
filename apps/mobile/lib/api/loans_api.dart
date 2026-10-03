// Loan management API — farmer tracking + bankManager review workspace.

import 'package:dio/dio.dart';

import '../models/loan_application.dart';
import '../models/loan_schedule_entry.dart';
import 'api_client.dart';
import 'endpoints.dart';

class LoansApi {
  LoansApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  // Farmer's own applications — {data: [LoanApplicationOut], page, pageSize, total}
  Future<Map<String, dynamic>> listMine() => _client.get(pathFinanceLoans);

  // Banker queue — {data: [...], page, pageSize, total}
  Future<Map<String, dynamic>> getQueue({
    String? status,
    String? q,
    int page = 1,
    int pageSize = 50,
  }) =>
      _client.get(pathLoansQueue, query: {
        if (status != null && status.isNotEmpty) 'status': status,
        if (q != null && q.isNotEmpty) 'q': q,
        'page': page,
        'pageSize': pageSize,
      });

  // {byStatus: {submitted: n, ...}, totalApplications, totalRequestedAmount,
  //  totalSanctionedAmount, pendingReview}
  Future<Map<String, dynamic>> getStats() => _client.get(pathLoansStats);

  Future<LoanApplication> getLoan(String id) async =>
      LoanApplication.fromJson(await _client.get(loanPath(id)));

  Future<LoanApplication> review(String id) async =>
      LoanApplication.fromJson(await _client.post(loanReviewPath(id)));

  Future<LoanApplication> approve(
    String id, {
    required int sanctionedAmount,
    required double interestRate,
    required int tenureMonths,
    String? note,
  }) async =>
      LoanApplication.fromJson(await _client.post(loanApprovePath(id), body: {
        'sanctionedAmount': sanctionedAmount,
        'interestRate': interestRate,
        'tenureMonths': tenureMonths,
        'note': ?note,
      }));

  Future<LoanApplication> reject(String id, String reason) async =>
      LoanApplication.fromJson(
          await _client.post(loanRejectPath(id), body: {'reason': reason}));

  Future<LoanApplication> requestInfo(String id, String message) async =>
      LoanApplication.fromJson(await _client
          .post(loanInfoRequestPath(id), body: {'message': message}));

  Future<LoanApplication> respond(String id, String message) async =>
      LoanApplication.fromJson(await _client
          .post(loanRespondPath(id), body: {'message': message}));

  Future<LoanApplication> cancel(String id) async =>
      LoanApplication.fromJson(await _client.post(loanCancelPath(id)));

  Future<LoanApplication> disburse(
    String id, {
    required String disbursementRef,
    int? disbursedAmount,
  }) async =>
      LoanApplication.fromJson(
          await _client.post(loanDisbursePath(id), body: {
        'disbursementRef': disbursementRef,
        'disbursedAmount': ?disbursedAmount,
      }));

  Future<List<LoanScheduleEntry>> getSchedule(String id) async {
    final res = await _client.get(loanSchedulePath(id));
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => LoanScheduleEntry.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  // Multipart upload (field name "files", one or more images/PDFs) → 201
  // updated LoanApplicationOut.
  Future<LoanApplication> uploadDocuments(
    String id,
    List<String> filePaths,
  ) async {
    final form = FormData();
    for (final path in filePaths) {
      form.files.add(MapEntry(
        'files',
        await MultipartFile.fromFile(
          path,
          filename: path.split('/').last,
        ),
      ));
    }
    final res = await _client.postMultipart(loanDocumentsPath(id), form);
    return LoanApplication.fromJson(res);
  }
}
