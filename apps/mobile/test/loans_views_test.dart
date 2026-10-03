import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/api/loans_api.dart';
import 'package:kisan_setu/models/loan_application.dart';
import 'package:kisan_setu/models/loan_schedule_entry.dart';
import 'package:kisan_setu/models/user_profile_type.dart';
import 'package:kisan_setu/views/loans/loan_detail_view.dart';
import 'package:kisan_setu/views/loans/loan_queue_view.dart';
import 'package:kisan_setu/views/loans/loan_review_view.dart';
import 'package:kisan_setu/views/loans/loan_tracking_view.dart';

import 'helpers.dart';

Map<String, dynamic> loanFixture({
  required String id,
  required String status,
  String purpose = 'ट्रैक्टर कर्ज',
  String? farmerName,
  String? applicationNumber,
  List<Map<String, dynamic>> timeline = const [],
}) =>
    {
      'applicationId': id,
      'applicationNumber': applicationNumber ?? 'LN-2026-$id',
      'userId': 'user-$id',
      'amount': 50000.0,
      'tenureMonths': 12,
      'purpose': purpose,
      'status': status,
      'createdAt': '2026-09-20T10:00:00.000Z',
      'farmerName': farmerName,
      'farmerPhone': farmerName == null ? null : '+919876543210',
      'farmerCreditScore': farmerName == null ? null : 720,
      'farmerCreditTier': farmerName == null ? null : 'Gold',
      'bankAccountId': null,
      'bankAccountLast4': null,
      'bankIfsc': null,
      'documents': <Map<String, dynamic>>[],
      'timeline': timeline,
    };

Map<String, dynamic> timelineFixture(String status, String statusText) => {
      'status': status,
      'statusText': statusText,
      'note': null,
      'at': '2026-09-20T10:00:00.000Z',
      'by': null,
    };

class FakeLoansApi extends LoansApi {  FakeLoansApi({List<Map<String, dynamic>> loans = const []})
      : loans = [...loans];

  List<Map<String, dynamic>> loans;
  List<Map<String, dynamic>> queue = [];
  List<Map<String, dynamic>> scheduleResponse = [];
  Map<String, dynamic>? statsResponse;

  String? lastQueueStatus;
  String? lastQueueQ;
  int? lastQueuePageSize;

  Map<String, dynamic> _byId(String id) => loans.firstWhere(
        (l) => l['applicationId'] == id,
        orElse: () =>
            throw const ApiException(code: 'LOAN_NOT_FOUND', message: 'missing'),
      );

  @override
  Future<Map<String, dynamic>> listMine() async =>
      {'data': loans, 'page': 1, 'pageSize': 50, 'total': loans.length};

  @override
  Future<Map<String, dynamic>> getQueue({
    String? status,
    String? q,
    int page = 1,
    int pageSize = 50,
  }) async {
    lastQueueStatus = status;
    lastQueueQ = q;
    lastQueuePageSize = pageSize;
    var data = queue;
    if (status != null && status.isNotEmpty) {
      data = data.where((l) => l['status'] == status).toList();
    }
    if (q != null && q.isNotEmpty) {
      final needle = q.toLowerCase();
      data = data.where((l) {
        final name = (l['farmerName'] ?? '').toString().toLowerCase();
        final phone = (l['farmerPhone'] ?? '').toString();
        final appNo = (l['applicationNumber'] ?? '').toString().toLowerCase();
        return name.contains(needle) ||
            phone.contains(q) ||
            appNo.contains(needle);
      }).toList();
    }
    return {
      'data': data,
      'page': page,
      'pageSize': pageSize,
      'total': data.length,
    };
  }

  @override
  Future<Map<String, dynamic>> getStats() async =>
      statsResponse ??
      const {
        'byStatus': {},
        'totalApplications': 0,
        'totalRequestedAmount': 0,
        'totalSanctionedAmount': 0,
        'pendingReview': 0,
      };

  @override
  Future<LoanApplication> getLoan(String id) async =>
      LoanApplication.fromJson(_byId(id));

  LoanApplication _mutate(String id, String status,
      {Map<String, dynamic> extra = const {}}) {
    final loan = _byId(id);
    loan['status'] = status;
    loan.addAll(extra);
    return LoanApplication.fromJson(loan);
  }

  @override
  Future<LoanApplication> review(String id) async => _mutate(
      id, LoanStatus.underReview,
      extra: const {'assignedOfficerName': 'Test Officer'});

  @override
  Future<LoanApplication> approve(
    String id, {
    required int sanctionedAmount,
    required double interestRate,
    required int tenureMonths,
    String? note,
  }) async =>
      _mutate(id, LoanStatus.approved, extra: {
        'sanctionedAmount': sanctionedAmount,
        'interestRate': interestRate,
        'tenureMonths': tenureMonths,
      });

  @override
  Future<LoanApplication> reject(String id, String reason) async =>
      _mutate(id, LoanStatus.rejected, extra: {'rejectionReason': reason});

  @override
  Future<LoanApplication> requestInfo(String id, String message) async =>
      _mutate(id, LoanStatus.infoRequested);

  @override
  Future<LoanApplication> respond(String id, String message) async =>
      _mutate(id, LoanStatus.underReview);

  @override
  Future<LoanApplication> cancel(String id) async =>
      _mutate(id, LoanStatus.cancelled);

  @override
  Future<LoanApplication> disburse(
    String id, {
    required String disbursementRef,
    int? disbursedAmount,
  }) async =>
      _mutate(id, LoanStatus.disbursed, extra: {
        'disbursementRef': disbursementRef,
        'disbursedAt': '2026-09-28T00:00:00.000Z',
      });

  @override
  Future<List<LoanScheduleEntry>> getSchedule(String id) async =>
      scheduleResponse
          .map((e) => LoanScheduleEntry.fromJson(e))
          .toList();

  @override
  Future<LoanApplication> uploadDocuments(
      String id, List<String> filePaths) async {
    final loan = _byId(id);
    final docs = (loan['documents'] as List?) ?? [];
    docs.add({
      'documentId': 'doc_${docs.length + 1}',
      'name': filePaths.first.split('/').last,
      'storagePath': 'loans/$id/${docs.length + 1}',
      'uploadedAt': '2026-09-28T00:00:00.000Z',
    });
    loan['documents'] = docs;
    return LoanApplication.fromJson(loan);
  }
}

/// Test state carrying a pre-selected loan id — avoids the abortive
/// `navigateTo` toast that `TestAppState`'s field/getter profile mismatch
/// would otherwise trigger for banker-only routes.
class LoanNavState extends TestAppState {
  LoanNavState({super.active, this.loanId});

  final String? loanId;

  @override
  String? get selectedLoanId => loanId;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('loan tracking renders loans and filter chips work',
      (tester) async {
    final api = FakeLoansApi(loans: [
      loanFixture(id: 'L1', status: LoanStatus.submitted, purpose: 'ट्रैक्टर कर्ज'),
      loanFixture(
          id: 'L2', status: LoanStatus.approved, purpose: 'बीज ऋण'),
    ]);

    await pumpScreen(tester,
        Scaffold(body: LoanTrackingView(state: TestAppState(), loansApi: api)));

    expect(find.text('मेरे ऋण'), findsOneWidget);
    expect(find.text('ट्रैक्टर कर्ज'), findsOneWidget);
    expect(find.text('बीज ऋण'), findsOneWidget);

    // Filter down to approved only.
    await tester.tap(find.widgetWithText(ChoiceChip, 'स्वीकृत'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('ट्रैक्टर कर्ज'), findsNothing);
    expect(find.text('बीज ऋण'), findsOneWidget);
  });

  testWidgets('loan detail renders timeline + schedule + respond action',
      (tester) async {
    final api = FakeLoansApi(loans: [
      loanFixture(
        id: 'L1',
        status: LoanStatus.infoRequested,
        timeline: [
          timelineFixture('submitted', 'आवेदन जमा हुआ'),
          timelineFixture('infoRequested', 'जानकारी मांगी गई'),
        ],
      ),
    ]);
    api.scheduleResponse = const [
      {
        'installmentNo': 1,
        'dueDate': '2026-10-05',
        'emi': 4500,
        'principal': 4200,
        'interest': 300,
        'outstanding': 45800,
      },
      {
        'installmentNo': 2,
        'dueDate': '2026-11-05',
        'emi': 4500,
        'principal': 4225,
        'interest': 275,
        'outstanding': 41300,
      },
    ];

    final state = LoanNavState(loanId: 'L1');

    await pumpScreen(
        tester, Scaffold(body: LoanDetailView(state: state, loansApi: api)));

    expect(find.text('जानकारी मांगी गई'), findsNWidgets(2)); // banner + timeline
    expect(find.text('4,500'), findsNWidgets(2)); // schedule EMIs
    expect(find.text('उत्तर दें'), findsOneWidget);

    // Cancel is also available from infoRequested.
    expect(find.text('आवेदन रद्द करें'), findsOneWidget);
  });

  testWidgets('banker queue renders tiles and search hits the api',
      (tester) async {
    final api = FakeLoansApi()
      ..queue = [
        loanFixture(
            id: 'Q1',
            status: LoanStatus.submitted,
            farmerName: 'रामु पाटिल',
            applicationNumber: 'LN-1'),
        loanFixture(
            id: 'Q2',
            status: LoanStatus.underReview,
            farmerName: 'शाम कुलकर्णी',
            applicationNumber: 'LN-2'),
      ];

    await pumpScreen(
      tester,
      Scaffold(
        body: LoanQueueView(
            state: TestAppState(active: UserProfileType.bankManager),
            loansApi: api),
      ),
    );

    expect(find.text('ऋण समीक्षा कतार'), findsOneWidget);
    expect(find.text('रामु पाटिल'), findsOneWidget);
    expect(find.text('शाम कुलकर्णी'), findsOneWidget);
    expect(api.lastQueueStatus, ''); // "All" bucket sends an empty status

    await tester.enterText(find.byType(TextField), 'रामु');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(seconds: 1));

    expect(api.lastQueueQ, 'रामु');
    expect(find.text('रामु पाटिल'), findsOneWidget);
    expect(find.text('शाम कुलकर्णी'), findsNothing);
  });

  testWidgets('banker review shows start-review for submitted applications',
      (tester) async {
    final api = FakeLoansApi(loans: [
      loanFixture(
          id: 'R1', status: LoanStatus.submitted, farmerName: 'रामु पाटिल'),
    ]);
    final state =
        LoanNavState(active: UserProfileType.bankManager, loanId: 'R1');

    await pumpScreen(
        tester, Scaffold(body: LoanReviewView(state: state, loansApi: api)));

    expect(find.text('समीक्षा शुरू करें'), findsOneWidget);
    expect(find.text('स्वीकृत करें'), findsNothing);
  });

  testWidgets('banker review shows approve only for under-review loans',
      (tester) async {
    final api = FakeLoansApi(loans: [
      loanFixture(
          id: 'R2', status: LoanStatus.underReview, farmerName: 'रामु पाटिल'),
    ]);
    final state =
        LoanNavState(active: UserProfileType.bankManager, loanId: 'R2');

    await pumpScreen(
        tester, Scaffold(body: LoanReviewView(state: state, loansApi: api)));

    expect(find.text('स्वीकृत करें'), findsOneWidget);
    expect(find.text('समीक्षा शुरू करें'), findsNothing);
  });
}
