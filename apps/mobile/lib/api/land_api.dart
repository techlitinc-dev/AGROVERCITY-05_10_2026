import '../models/land_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class LandApi {
  LandApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<LandPlot>> listPlots() async {
    final res = await _client.get(pathLandPlots);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => LandPlot.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<LandPlot> createPlot({
    required String name,
    required String village,
    required String district,
    required double areaAcres,
    String? gatNumber,
    String? soilType,
  }) async {
    final res = await _client.post(pathLandPlots, body: {
      'name': name,
      'village': village,
      'district': district,
      'areaAcres': areaAcres,
      'gatNumber': ?gatNumber,
      'soilType': ?soilType,
    });
    return LandPlot.fromJson(res);
  }

  Future<LandPlot> updatePlot(
    String id, {
    String? name,
    String? village,
    String? district,
    double? areaAcres,
    String? gatNumber,
    String? soilType,
  }) async {
    final res = await _client.put(landPlotPath(id), body: {
      'name': ?name,
      'village': ?village,
      'district': ?district,
      'areaAcres': ?areaAcres,
      'gatNumber': ?gatNumber,
      'soilType': ?soilType,
    });
    return LandPlot.fromJson(res);
  }

  Future<void> deletePlot(String id) => _client.delete(landPlotPath(id));

  Future<List<LandLease>> listLeases({String? status}) async {
    final res = await _client.get(pathLandLeases, query: {'status': ?status});
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => LandLease.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<LandLease> createLease({
    required String plotId,
    required String tenantName,
    required String tenantPhone,
    required double monthlyRentRupees,
    required String startDate,
    required String endDate,
  }) async {
    final res = await _client.post(pathLandLeases, body: {
      'plotId': plotId,
      'tenantName': tenantName,
      'tenantPhone': tenantPhone,
      'monthlyRentRupees': monthlyRentRupees,
      'startDate': startDate,
      'endDate': endDate,
    });
    return LandLease.fromJson(res);
  }

  Future<LandLease> updateLease(
    String id, {
    double? monthlyRentRupees,
    String? endDate,
    String? status,
    bool? verified,
  }) async {
    final res = await _client.put(landLeasePath(id), body: {
      'monthlyRentRupees': ?monthlyRentRupees,
      'endDate': ?endDate,
      'status': ?status,
      'verified': ?verified,
    });
    return LandLease.fromJson(res);
  }

  Future<void> deleteLease(String id) => _client.delete(landLeasePath(id));

  Future<RentPayment> addPayment(
    String leaseId, {
    required double amountRupees,
    required String month,
    required String method,
    required String paidAt,
  }) async {
    final res = await _client.post(landLeasePaymentsPath(leaseId), body: {
      'amountRupees': amountRupees,
      'month': month,
      'method': method,
      'paidAt': paidAt,
    });
    return RentPayment.fromJson(res);
  }

  Future<LeasePayments> listPayments(String leaseId) async {
    final res = await _client.get(landLeasePaymentsPath(leaseId));
    return LeasePayments.fromJson(res);
  }
}
