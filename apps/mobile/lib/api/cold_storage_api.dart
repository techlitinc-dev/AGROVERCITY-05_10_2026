import '../models/cold_storage_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class ColdStorageApi {
  final ApiClient _client;

  ColdStorageApi({ApiClient? client}) : _client = client ?? ApiClient();

  Future<ColdStorageProviderStats> getProviderStats() async {
    final res = await _client.get(pathColdStorageProviderStats);
    return ColdStorageProviderStats.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<List<ColdStorageBookingRecord>> listProviderBookings({
    String? status,
    String? q,
    int page = 1,
    int pageSize = 20,
  }) async {
    final query = <String, String>{
      'page': page.toString(),
      'pageSize': pageSize.toString(),
    };
    if (status != null && status.isNotEmpty && status != 'all') {
      query['status'] = status;
    }
    if (q != null && q.isNotEmpty) {
      query['q'] = q;
    }
    final res = await _client.get(pathColdStorageProviderBookings, query: query);
    final list = (res['data'] as List?) ?? [];
    return list
        .map((e) => ColdStorageBookingRecord.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<ColdStorageBookingRecord> getProviderBooking(String id) async {
    final res = await _client.get(coldStorageProviderBookingPath(id));
    return ColdStorageBookingRecord.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<ColdStorageBookingRecord> reviewBooking(
    String bookingId, {
    required String action,
    String? allocatedChamberId,
    String? notes,
    String? rejectionReason,
  }) async {
    final body = <String, dynamic>{
      'action': action,
      if (allocatedChamberId != null) 'allocatedChamberId': allocatedChamberId,
      if (notes != null) 'notes': notes,
      if (rejectionReason != null) 'rejectionReason': rejectionReason,
    };
    final res = await _client.post(
      coldStorageProviderBookingReviewPath(bookingId),
      body: body,
    );
    return ColdStorageBookingRecord.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<Map<String, dynamic>> gateInward(
    String bookingId, {
    required double grossWeightKg,
    required double tareWeightKg,
    required double netQuintals,
    required int actualBags,
    String? chamberId,
    String? lotNumber,
    double? moisturePercent,
    String? qcGrade,
    double? valuationRupees,
  }) async {
    final body = <String, dynamic>{
      'grossWeightKg': grossWeightKg,
      'tareWeightKg': tareWeightKg,
      'netQuintals': netQuintals,
      'actualBags': actualBags,
      if (chamberId != null) 'chamberId': chamberId,
      if (lotNumber != null) 'lotNumber': lotNumber,
      if (moisturePercent != null) 'moisturePercent': moisturePercent,
      if (qcGrade != null) 'qcGrade': qcGrade,
      if (valuationRupees != null) 'valuationRupees': valuationRupees,
    };
    final res = await _client.post(
      coldStorageProviderBookingInwardPath(bookingId),
      body: body,
    );
    return (res as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> gateRelease(
    String bookingId, {
    required double releaseQuintals,
    String? vehicleNumber,
    String? driverName,
    String? gatePassRemarks,
    double? amountPaid,
  }) async {
    final body = <String, dynamic>{
      'releaseQuintals': releaseQuintals,
      if (vehicleNumber != null) 'vehicleNumber': vehicleNumber,
      if (driverName != null) 'driverName': driverName,
      if (gatePassRemarks != null) 'gatePassRemarks': gatePassRemarks,
      if (amountPaid != null) 'amountPaid': amountPaid,
    };
    final res = await _client.post(
      coldStorageProviderBookingReleasePath(bookingId),
      body: body,
    );
    return (res as Map).cast<String, dynamic>();
  }

  Future<ColdStorageBookingRecord> requestRelease(
    String bookingId, {
    required double requestedQuintals,
    required String pickupDate,
    String? vehicleNumber,
    String? notes,
  }) async {
    final body = <String, dynamic>{
      'requestedQuintals': requestedQuintals,
      'pickupDate': pickupDate,
      if (vehicleNumber != null) 'vehicleNumber': vehicleNumber,
      if (notes != null) 'notes': notes,
    };
    final res = await _client.post(
      coldStorageReleaseRequestPath(bookingId),
      body: body,
    );
    return ColdStorageBookingRecord.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<WarehouseReceiptRecord> getReceipt(String receiptNumber) async {
    final res = await _client.get(coldStorageReceiptPath(receiptNumber));
    return WarehouseReceiptRecord.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<List<Map<String, dynamic>>> listFacilities() async {
    final res = await _client.get(pathColdStorageProviderFacilities);
    final list = (res['data'] as List?) ?? [];
    return list.map((e) => (e as Map).cast<String, dynamic>()).toList();
  }

  Future<ColdStorageFacilityRecord> createFacility(
      Map<String, dynamic> data) async {
    final res =
        await _client.post(pathColdStorageProviderFacilities, body: data);
    return ColdStorageFacilityRecord.fromJson(
        (res as Map).cast<String, dynamic>());
  }

  Future<Map<String, dynamic>> addChamber(
      String facilityId, Map<String, dynamic> data) async {
    final res = await _client.post(
      coldStorageProviderChambersPath(facilityId),
      body: data,
    );
    return (res as Map).cast<String, dynamic>();
  }

  Future<ColdStorageBookingRecord> applyColdStorage(
    String facilityId, {
    required String cropName,
    String? variety,
    required double quantityQuintals,
    required String fromDate,
    int months = 1,
    String packagingType = 'Jute Bags',
    int? bagsCount,
    String? notes,
    double? estimatedValueRupees,
  }) async {
    final body = <String, dynamic>{
      'cropName': cropName,
      if (variety != null) 'variety': variety,
      'quantityQuintals': quantityQuintals,
      'fromDate': fromDate,
      'months': months,
      'packagingType': packagingType,
      if (bagsCount != null) 'bagsCount': bagsCount,
      if (notes != null) 'notes': notes,
      if (estimatedValueRupees != null) 'estimatedValueRupees': estimatedValueRupees,
    };
    final res = await _client.post(
      coldStorageApplyPath(facilityId),
      body: body,
    );
    return ColdStorageBookingRecord.fromJson((res as Map).cast<String, dynamic>());
  }
}
