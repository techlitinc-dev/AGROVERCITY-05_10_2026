import 'package:kisan_setu/api/land_api.dart';
import 'package:kisan_setu/api/land_market_api.dart';
import 'package:kisan_setu/models/land_market_models.dart';
import 'package:kisan_setu/models/land_models.dart';

class FakeLandApi extends LandApi {
  List<LandPlot> plotsResponse = [];
  List<LandLease> leasesResponse = [];
  LeasePayments paymentsResponse = const LeasePayments(
      payments: [], totalCollectedRupees: 0, pendingMonths: []);

  Object? deletePlotError;
  String? lastLeaseStatusFilter;

  final List<Map<String, dynamic>> createPlotCalls = [];
  final List<String> deletePlotCalls = [];
  final List<Map<String, dynamic>> createLeaseCalls = [];
  final List<Map<String, dynamic>> updateLeaseCalls = [];
  final List<Map<String, dynamic>> addPaymentCalls = [];

  @override
  Future<List<LandPlot>> listPlots() async => plotsResponse;

  @override
  Future<LandPlot> createPlot({
    required String name,
    required String village,
    required String district,
    required double areaAcres,
    String? gatNumber,
    String? soilType,
  }) async {
    createPlotCalls.add({
      'name': name,
      'village': village,
      'district': district,
      'areaAcres': areaAcres,
      'gatNumber': gatNumber,
      'soilType': soilType,
    });
    final plot = LandPlot(
      id: 'plot-new',
      name: name,
      village: village,
      district: district,
      areaAcres: areaAcres,
      gatNumber: gatNumber,
      soilType: soilType,
      status: 'vacant',
    );
    plotsResponse = [...plotsResponse, plot];
    return plot;
  }

  @override
  Future<void> deletePlot(String id) async {
    deletePlotCalls.add(id);
    final error = deletePlotError;
    if (error != null) throw error;
    plotsResponse = plotsResponse.where((p) => p.id != id).toList();
  }

  @override
  Future<List<LandLease>> listLeases({String? status}) async {
    lastLeaseStatusFilter = status;
    return leasesResponse;
  }

  @override
  Future<LandLease> createLease({
    required String plotId,
    required String tenantName,
    required String tenantPhone,
    required double monthlyRentRupees,
    required String startDate,
    required String endDate,
  }) async {
    createLeaseCalls.add({
      'plotId': plotId,
      'tenantName': tenantName,
      'tenantPhone': tenantPhone,
      'monthlyRentRupees': monthlyRentRupees,
      'startDate': startDate,
      'endDate': endDate,
    });
    return LandLease(
      id: 'lease-new',
      plotId: plotId,
      tenantName: tenantName,
      tenantPhone: tenantPhone,
      monthlyRentRupees: monthlyRentRupees,
      startDate: startDate,
      endDate: endDate,
      status: 'active',
      verified: false,
    );
  }

  @override
  Future<LandLease> updateLease(
    String id, {
    double? monthlyRentRupees,
    String? endDate,
    String? status,
    bool? verified,
  }) async {
    updateLeaseCalls.add({
      'id': id,
      'monthlyRentRupees': monthlyRentRupees,
      'endDate': endDate,
      'status': status,
      'verified': verified,
    });
    final lease = leasesResponse.firstWhere((l) => l.id == id);
    return LandLease(
      id: lease.id,
      plotId: lease.plotId,
      tenantName: lease.tenantName,
      tenantPhone: lease.tenantPhone,
      monthlyRentRupees: monthlyRentRupees ?? lease.monthlyRentRupees,
      startDate: lease.startDate,
      endDate: endDate ?? lease.endDate,
      status: status ?? lease.status,
      verified: verified ?? lease.verified,
    );
  }

  @override
  Future<void> deleteLease(String id) async {}

  @override
  Future<RentPayment> addPayment(
    String leaseId, {
    required double amountRupees,
    required String month,
    required String method,
    required String paidAt,
  }) async {
    addPaymentCalls.add({
      'leaseId': leaseId,
      'amountRupees': amountRupees,
      'month': month,
      'method': method,
      'paidAt': paidAt,
    });
    return RentPayment(
      id: 'pay-new',
      leaseId: leaseId,
      amountRupees: amountRupees,
      month: month,
      method: method,
      paidAt: paidAt,
    );
  }

  @override
  Future<LeasePayments> listPayments(String leaseId) async => paymentsResponse;
}

class FakeLandMarketApi extends LandMarketApi {
  List<LandListing> listingsResponse = [];
  List<LandListing> myListingsResponse = [];
  List<LeaseRequest> requestsResponse = [];
  String agreementUrl = 'https://example.com/agreement.pdf';

  String? lastNear;
  double? lastAcres;

  final List<Map<String, dynamic>> requestLeaseCalls = [];
  final List<String> acceptCalls = [];
  final List<Map<String, dynamic>> rejectCalls = [];
  final List<String> agreementCalls = [];

  @override
  Future<List<LandListing>> listListings({String? near, double? acres}) async {
    lastNear = near;
    lastAcres = acres;
    return listingsResponse;
  }

  @override
  Future<List<LandListing>> myListings() async => myListingsResponse;

  @override
  Future<Map<String, dynamic>> requestLease({
    required String listingId,
    required int durationMonths,
    String message = '',
  }) async {
    requestLeaseCalls.add({
      'listingId': listingId,
      'durationMonths': durationMonths,
      'message': message,
    });
    return {'id': 'req-new', 'status': 'pending'};
  }

  @override
  Future<List<LeaseRequest>> listLeaseRequests({String? status}) async =>
      requestsResponse;

  @override
  Future<Map<String, dynamic>> acceptRequest(String id) async {
    acceptCalls.add(id);
    return {'leaseId': 'lease-new'};
  }

  @override
  Future<Map<String, dynamic>> rejectRequest(String id, String reason) async {
    rejectCalls.add({'id': id, 'reason': reason});
    return {'status': 'rejected'};
  }

  @override
  Future<String> getAgreementUrl(String leaseId) async {
    agreementCalls.add(leaseId);
    return agreementUrl;
  }
}
