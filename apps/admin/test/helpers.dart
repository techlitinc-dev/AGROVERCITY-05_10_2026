import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu_admin/api/admin_api.dart';
import 'package:kisan_setu_admin/core/auth.dart';
import 'package:provider/provider.dart';

Map<String, dynamic> envelope(List<Map<String, dynamic>> data) =>
    {'data': data, 'page': 1, 'pageSize': 20, 'total': data.length};

class FakeAdminAuth extends AdminAuth {
  @override
  bool get configured => true;

  String? lastEmail;

  @override
  Future<void> signIn(String email, String password) async {
    lastEmail = email;
  }

  @override
  Future<String?> idToken() async => 'fake-id-token';

  @override
  Future<void> signOut() async {}
}

class FakeAdminApi extends AdminApi {
  FakeAdminApi() : super(tokenProvider: () async => 'fake-id-token');

  Map<String, dynamic> loginResponse = const {'admin': true};
  Object? loginError;
  Map<String, dynamic> analyticsResponse = const {};
  Map<String, dynamic> emarketResponse = const {};
  Map<String, dynamic> usersResponse = const {
    'data': <Map<String, dynamic>>[],
    'page': 1,
    'pageSize': 20,
    'total': 0,
  };
  Map<String, dynamic> pendingRatesResponse = const {
    'data': <Map<String, dynamic>>[]
  };
  Map<String, dynamic> claimsResponse = const {'data': <Map<String, dynamic>>[]};
  Map<String, dynamic> financeLoansResponse = const {
    'data': <Map<String, dynamic>>[]
  };
  Map<String, dynamic> kycResponse = const {'data': <Map<String, dynamic>>[]};
  Map<String, dynamic> settlementsResponse = const {
    'data': <Map<String, dynamic>>[]
  };
  Map<String, dynamic> reportsResponse = const {'data': <Map<String, dynamic>>[]};
  Map<String, dynamic> broadcastDryRunResponse = const {'targetedCount': 0};
  Map<String, dynamic> broadcastSendResponse = const {
    'targetedCount': 0,
    'sent': 0,
  };
  Object? advanceClaimError;
  Object? settleActionError;

  final List<String> approveRateCalls = [];
  final List<Map<String, String>> rejectRateCalls = [];
  final List<Map<String, dynamic>> advanceClaimCalls = [];
  final List<String> verifyKycCalls = [];
  final List<Map<String, dynamic>> broadcastCalls = [];
  final List<Map<String, String>> settleActionCalls = [];
  final List<Map<String, String>> resolveReportCalls = [];
  final List<Map<String, String>> updateFinanceLoanStatusCalls = [];
  Object? updateFinanceLoanStatusError;

  @override
  Future<Map<String, dynamic>> login() async {
    final error = loginError;
    if (error != null) throw error;
    return loginResponse;
  }

  @override
  Future<Map<String, dynamic>> getAnalytics() async => analyticsResponse;

  @override
  Future<Map<String, dynamic>> getEmarketAnalytics() async => emarketResponse;

  @override
  Future<Map<String, dynamic>> listUsers({String? persona, int page = 1}) async =>
      usersResponse;

  @override
  Future<Map<String, dynamic>> setUserStatus(String id, String status) async =>
      {'id': id, 'status': status};

  @override
  Future<Map<String, dynamic>> listPendingRates() async =>
      pendingRatesResponse;

  @override
  Future<Map<String, dynamic>> approveRate(String id) async {
    approveRateCalls.add(id);
    return {'id': id, 'status': 'approved'};
  }

  @override
  Future<Map<String, dynamic>> rejectRate(String id, String reason) async {
    rejectRateCalls.add({'id': id, 'reason': reason});
    return {'id': id, 'status': 'rejected'};
  }

  @override
  Future<Map<String, dynamic>> listClaims({String? status}) async =>
      claimsResponse;

  @override
  Future<Map<String, dynamic>> getFinanceLoans({
    String? status,
    int page = 1,
  }) async =>
      financeLoansResponse;

  @override
  Future<Map<String, dynamic>> updateFinanceLoanStatus(
    String applicationId,
    String status, {
    String? note,
  }) async {
    final error = updateFinanceLoanStatusError;
    if (error != null) throw error;
    updateFinanceLoanStatusCalls.add({
      'applicationId': applicationId,
      'status': status,
      'note': note ?? '',
    });
    return {'applicationId': applicationId, 'status': status};
  }

  @override
  Future<Map<String, dynamic>> advanceClaim(
    String userId,
    String claimId,
    String newStatus, {
    double? approvedAmount,
    String? dbtTransactionId,
    String note = '',
  }) async {
    final error = advanceClaimError;
    if (error != null) throw error;
    advanceClaimCalls.add({
      'userId': userId,
      'claimId': claimId,
      'newStatus': newStatus,
      'approvedAmount': approvedAmount,
      'dbtTransactionId': dbtTransactionId,
      'note': note,
    });
    return {'id': claimId, 'status': newStatus};
  }

  @override
  Future<Map<String, dynamic>> listKycPending() async => kycResponse;

  @override
  Future<Map<String, dynamic>> verifyKyc(String entityId) async {
    verifyKycCalls.add(entityId);
    return {'entityId': entityId, 'kycStatus': 'verified'};
  }

  @override
  Future<Map<String, dynamic>> rejectKyc(String entityId, String reason) async =>
      {'entityId': entityId, 'kycStatus': 'rejected'};

  @override
  Future<Map<String, dynamic>> broadcast({
    required Map<String, String?> segment,
    required String title,
    required String body,
    String? deepLink,
    bool dryRun = false,
  }) async {
    broadcastCalls.add({
      'segment': segment,
      'title': title,
      'body': body,
      'deepLink': deepLink,
      'dryRun': dryRun,
    });
    return dryRun ? broadcastDryRunResponse : broadcastSendResponse;
  }

  @override
  Future<Map<String, dynamic>> listSettlements({String? status}) async =>
      settlementsResponse;

  @override
  Future<Map<String, dynamic>> settleAction(String id, String action) async {
    final error = settleActionError;
    if (error != null) throw error;
    settleActionCalls.add({'id': id, 'action': action});
    return {'id': id, 'status': action == 'approve' ? 'approved' : 'paid'};
  }

  @override
  Future<Map<String, dynamic>> listReports({String? status}) async =>
      reportsResponse;

  @override
  Future<Map<String, dynamic>> resolveReport(
    String id,
    String action, {
    String note = '',
  }) async {
    resolveReportCalls.add({'id': id, 'action': action, 'note': note});
    return {'id': id, 'status': 'resolved'};
  }
}

Future<void> pumpAdminScreen(
  WidgetTester tester,
  Widget screen,
  FakeAdminApi api,
) async {
  tester.view.physicalSize = const Size(1400, 1000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    Provider<AdminApi>.value(
      value: api,
      child: MaterialApp(home: screen),
    ),
  );
  await tester.pump(const Duration(milliseconds: 500));
}
