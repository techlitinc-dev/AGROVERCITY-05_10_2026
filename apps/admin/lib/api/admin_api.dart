import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';
import 'api_exception.dart';

class AdminApi {
  AdminApi({http.Client? client, required this._tokenProvider})
      : _client = client ?? http.Client();

  final http.Client _client;
  final Future<String?> Function() _tokenProvider;

  static const String _prefix = '/v1/admin';

  Future<Map<String, String>> _headers() async {
    final token = await _tokenProvider();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$apiBaseUrl$_prefix$path').replace(queryParameters: query);

  Future<Map<String, dynamic>> _run(
    Future<http.Response> Function(Map<String, String> headers) call,
  ) async {
    http.Response response;
    try {
      response = await call(await _headers());
    } catch (_) {
      throw ApiException(code: 'NETWORK_ERROR');
    }
    if (response.statusCode == 204) return {};
    Map<String, dynamic> body;
    try {
      body = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      body = {};
    }
    if (response.statusCode >= 400) {
      throw ApiException.fromBody(response.statusCode, body);
    }
    return body;
  }

  Future<Map<String, dynamic>> _get(String path, [Map<String, String>? q]) =>
      _run((h) => _client.get(_uri(path, q), headers: h));

  Future<Map<String, dynamic>> _post(String path, [Map<String, dynamic>? body]) =>
      _run((h) => _client.post(_uri(path), headers: h, body: jsonEncode(body ?? {})));

  Future<Map<String, dynamic>> _put(String path, Map<String, dynamic> body) =>
      _run((h) => _client.put(_uri(path), headers: h, body: jsonEncode(body)));

  Future<Map<String, dynamic>> _delete(String path) =>
      _run((h) => _client.delete(_uri(path), headers: h));

  Future<Map<String, dynamic>> login() => _post('/login');

  Future<Map<String, dynamic>> getAnalytics() => _get('/analytics/summary');

  Future<Map<String, dynamic>> getEmarketAnalytics() => _get('/analytics/emarket');

  Future<Map<String, dynamic>> listUsers({String? persona, int page = 1}) =>
      _get('/users', {
        if (persona != null && persona.isNotEmpty) 'persona': persona,
        'page': '$page',
      });

  Future<Map<String, dynamic>> setUserStatus(String id, String status) =>
      _put('/users/$id/status', {'status': status});

  Future<Map<String, dynamic>> listPendingRates() => _get('/rates/pending');

  Future<Map<String, dynamic>> approveRate(String id) =>
      _post('/rates/$id/approve');

  Future<Map<String, dynamic>> rejectRate(String id, String reason) =>
      _post('/rates/$id/reject', {'reason': reason});

  Future<Map<String, dynamic>> listContent(String collection, {int page = 1}) =>
      _get('/content/$collection', {'page': '$page'});

  Future<Map<String, dynamic>> createContent(
    String collection,
    Map<String, dynamic> body,
  ) =>
      _post('/content/$collection', body);

  Future<Map<String, dynamic>> updateContent(
    String collection,
    String id,
    Map<String, dynamic> body,
  ) =>
      _put('/content/$collection/$id', body);

  Future<Map<String, dynamic>> deleteContent(String collection, String id) =>
      _delete('/content/$collection/$id');

  Future<Map<String, dynamic>> listClaims({String? status}) =>
      _get('/claims', {if (status != null && status.isNotEmpty) 'status': status});

  Future<Map<String, dynamic>> advanceClaim(
    String userId,
    String claimId,
    String newStatus, {
    double? approvedAmount,
    String? dbtTransactionId,
    String note = '',
  }) =>
      _put('/claims/$userId/$claimId', {
        'newStatus': newStatus,
        'approvedAmount': approvedAmount,
        'dbtTransactionId': dbtTransactionId,
        'note': note,
      });

  Future<Map<String, dynamic>> listKycPending() => _get('/kyc/pending');

  Future<Map<String, dynamic>> verifyKyc(String entityId) =>
      _post('/kyc/$entityId/verify');

  Future<Map<String, dynamic>> rejectKyc(String entityId, String reason) =>
      _post('/kyc/$entityId/reject', {'reason': reason});

  Future<Map<String, dynamic>> broadcast({
    required Map<String, String?> segment,
    required String title,
    required String body,
    String? deepLink,
    bool dryRun = false,
  }) =>
      _post('/broadcast', {
        'segment': segment,
        'title': title,
        'body': body,
        'deepLink': deepLink,
        'dryRun': dryRun,
      });

  Future<Map<String, dynamic>> listSettlements({String? status}) =>
      _get('/settlements', {
        if (status != null && status.isNotEmpty) 'status': status,
      });

  Future<Map<String, dynamic>> settleAction(String id, String action) =>
      _post('/settlements/$id/mark-paid', {'action': action});

  Future<Map<String, dynamic>> listReports({String? status}) =>
      _get('/reports', {if (status != null && status.isNotEmpty) 'status': status});

  Future<Map<String, dynamic>> resolveReport(
    String id,
    String action, {
    String note = '',
  }) =>
      _post('/reports/$id/resolve', {'action': action, 'note': note});

  // Superadmin Unified Overview
  Future<Map<String, dynamic>> getOverview() => _get('/overview');

  // Agronomist Expert Escalation Desk
  Future<Map<String, dynamic>> listExpertHandoffs() => _get('/expert-handoffs');

  Future<Map<String, dynamic>> resolveExpertHandoff(
    String ticketId, {
    required String prescriptionNotes,
    List<String> recommendedProducts = const [],
  }) =>
      _post('/expert-handoffs/$ticketId/resolve', {
        'prescriptionNotes': prescriptionNotes,
        'recommendedProducts': recommendedProducts,
      });

  // KYC Vault Verification Queue
  Future<Map<String, dynamic>> getKycQueue() => _get('/kyc/queue');

  Future<Map<String, dynamic>> reviewKycDoc(
    String docId, {
    required String status,
    String? rejectionReason,
    String? auditNotes,
  }) =>
      _post('/kyc/$docId/review', {
        'status': status,
        'rejectionReason': rejectionReason,
        'auditNotes': auditNotes,
      });

  // Module 27 — Instructor courses & podcasts moderation
  Future<Map<String, dynamic>> courseQueue({String status = 'pendingReview'}) =>
      _get('/courses/queue', {'status': status});

  Future<Map<String, dynamic>> reviewCourse(
    String courseId,
    String action, {
    String? reason,
  }) =>
      _post('/courses/$courseId/review', {
        'action': action,
        if (reason != null) 'reason': reason,
      });

  Future<Map<String, dynamic>> featureCourse(String courseId, bool isFeatured) =>
      _post('/courses/$courseId/feature', {'isFeatured': isFeatured});

  Future<Map<String, dynamic>> coursesReport() => _get('/courses/report');

  // Module 14 — Banking, credit & loan underwriting
  Future<Map<String, dynamic>> getFinanceLoans({String? status, int page = 1}) =>
      _get('/finance/loans', {
        if (status != null && status.isNotEmpty) 'status': status,
        'page': '$page',
      });

  Future<Map<String, dynamic>> updateFinanceLoanStatus(
    String applicationId,
    String status, {
    String? note,
  }) =>
      _put('/finance/loans/$applicationId/status', {
        'status': status,
        'note': note,
      });
}
