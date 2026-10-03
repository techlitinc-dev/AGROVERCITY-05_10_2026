import '../models/land_market_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class LandMarketApi {
  LandMarketApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<LandListing>> listListings({String? near, double? acres}) async {
    final res = await _client.get(pathLandListings, query: {
      'near': ?near,
      'acres': ?acres,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => LandListing.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<LandListing>> myListings() async {
    final res = await _client.get(pathLandListingsMine);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => LandListing.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<LandListing> createListing({
    required String village,
    required String district,
    required double lat,
    required double lng,
    required double areaAcres,
    required double expectedRentRupees,
    String? soilType,
    String? waterSource,
    String? plotId,
  }) async {
    final res = await _client.post(pathLandListings, body: {
      'village': village,
      'district': district,
      'lat': lat,
      'lng': lng,
      'areaAcres': areaAcres,
      'expectedRentRupees': expectedRentRupees,
      'soilType': ?soilType,
      'waterSource': ?waterSource,
      'plotId': ?plotId,
    });
    return LandListing.fromJson(res);
  }

  Future<LandListing> updateListing(
    String id, {
    double? expectedRentRupees,
    String? status,
    String? soilType,
    String? waterSource,
  }) async {
    final res = await _client.put(landListingPath(id), body: {
      'expectedRentRupees': ?expectedRentRupees,
      'status': ?status,
      'soilType': ?soilType,
      'waterSource': ?waterSource,
    });
    return LandListing.fromJson(res);
  }

  Future<void> deleteListing(String id) => _client.delete(landListingPath(id));

  Future<Map<String, dynamic>> requestLease({
    required String listingId,
    required int durationMonths,
    String message = '',
  }) =>
      _client.post(pathLandLeaseRequests, body: {
        'listingId': listingId,
        'durationMonths': durationMonths,
        'message': message,
      });

  Future<List<LeaseRequest>> listLeaseRequests({String? status}) async {
    final res =
        await _client.get(pathLandLeaseRequests, query: {'status': ?status});
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => LeaseRequest.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  // 200 {leaseId}
  Future<Map<String, dynamic>> acceptRequest(String id) =>
      _client.post(landLeaseRequestAcceptPath(id));

  Future<Map<String, dynamic>> rejectRequest(String id, String reason) =>
      _client.post(landLeaseRequestRejectPath(id), body: {'reason': reason});

  Future<String> getAgreementUrl(String leaseId) async {
    final res = await _client.get(landLeaseAgreementPdfPath(leaseId));
    return res['agreementUrl'] as String? ?? '';
  }
}
