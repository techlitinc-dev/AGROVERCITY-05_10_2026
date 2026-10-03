import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

import '../models/insurance_models.dart';
import '../services/offline_queue.dart';
import 'api_client.dart';
import 'api_exception.dart';
import 'endpoints.dart';

class InsuranceApi {
  InsuranceApi({ApiClient? client, OfflineQueue? queue})
      : _client = client ?? ApiClient(),
        _queue = queue ?? OfflineQueue.instance;

  final ApiClient _client;
  final OfflineQueue _queue;

  // ---------------------------------------------------------------------------
  // Farmer / Landlord Endpoints
  // ---------------------------------------------------------------------------

  Future<List<CropInsurancePolicy>> listPolicies() async {
    final res = await _client.get(pathInsurancePolicies);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) =>
            CropInsurancePolicy.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<CropInsurancePolicy>> listPoliciesFiltered({String? status}) async {
    final res = await _client.get(
      pathInsurancePolicies,
      query: {if (status != null && status != 'all') 'status': status},
    );
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) =>
            CropInsurancePolicy.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<CropInsurancePolicy> applyPolicy({
    required String cropName,
    required String season,
    required double landAreaAcres,
  }) async {
    return applyPolicyCustom(
      cropName: cropName,
      season: season,
      landAreaAcres: landAreaAcres,
    );
  }

  Future<CropInsurancePolicy> applyPolicyCustom({
    required String cropName,
    required String season,
    required double landAreaAcres,
    String category = 'crop',
    String schemeName = 'PMFBY',
    String? khasraNumber,
    String? sowingDate,
  }) async {
    final res = await _client.post(pathInsurancePoliciesApply, body: {
      'cropName': cropName,
      'season': season,
      'landAreaAcres': landAreaAcres,
      'category': category,
      'schemeName': schemeName,
      if (khasraNumber != null) 'khasraNumber': khasraNumber,
      if (sowingDate != null) 'sowingDate': sowingDate,
    });
    return CropInsurancePolicy.fromJson(res);
  }

  Future<String?> getCertificate(String policyId) async {
    final res = await _client.get(insurancePolicyCertificatePath(policyId));
    return res['certificateUrl'] as String?;
  }

  Future<List<CropPremiumRate>> getRates({String? season, String? crop}) async {
    final res = await _client.get(pathInsuranceRates, query: {
      if (season != null) 'season': season,
      if (crop != null) 'crop': crop,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map(
            (e) => CropPremiumRate.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<InsuranceScheme>> listSchemes() async {
    final res = await _client.get(pathInsuranceSchemes);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) =>
            InsuranceScheme.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, dynamic>> submitClaim(
    Map<String, String> fields,
    List<XFile> photos,
  ) async {
    try {
      final form = FormData.fromMap(fields);
      for (final photo in photos) {
        form.files.add(MapEntry(
          'damagePhotos',
          MultipartFile.fromBytes(
            await photo.readAsBytes(),
            filename: photo.name,
          ),
        ));
      }
      return await _client.postMultipart(pathInsuranceClaims, form);
    } on ApiException catch (e) {
      if (e.code == 'NETWORK_ERROR' && photos.isEmpty) {
        await _queue.enqueue(
          method: 'POST',
          path: pathInsuranceClaims,
          body: fields,
        );
        return {'queued': true};
      }
      rethrow;
    }
  }

  Future<List<InsuranceClaimRecord>> listClaims() async {
    final res = await _client.get(pathInsuranceClaims);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) =>
            InsuranceClaimRecord.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<InsuranceClaimRecord> getClaim(String id) async {
    final res = await _client.get(insuranceClaimPath(id));
    return InsuranceClaimRecord.fromJson(res);
  }

  Future<InsuranceClaimRecord> appealClaim(
    String id,
    String reason,
    List<String> photos,
  ) async {
    final res = await _client.post(insuranceClaimAppealPath(id), body: {
      'reason': reason,
      'photos': photos,
    });
    return InsuranceClaimRecord.fromJson(res);
  }

  // ---------------------------------------------------------------------------
  // Insurance Provider Workspace Endpoints
  // ---------------------------------------------------------------------------

  Future<InsuranceProviderStats> getProviderStats() async {
    final res = await _client.get(pathInsuranceProviderStats);
    return InsuranceProviderStats.fromJson(res);
  }

  Future<Map<String, dynamic>> listProviderPolicies({
    String? status,
    String? crop,
    String? category,
    String? q,
    int page = 1,
    int pageSize = 20,
  }) async {
    final res = await _client.get(pathInsuranceProviderPolicies, query: {
      if (status != null && status != 'all') 'status': status,
      if (crop != null) 'crop': crop,
      if (category != null) 'category': category,
      if (q != null && q.isNotEmpty) 'q': q,
      'page': page,
      'pageSize': pageSize,
    });
    final list = ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) =>
            CropInsurancePolicy.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    return {
      'data': list,
      'page': res['page'] ?? page,
      'pageSize': res['pageSize'] ?? pageSize,
      'total': res['total'] ?? list.length,
    };
  }

  Future<CropInsurancePolicy> getProviderPolicy(String id) async {
    final res = await _client.get(insuranceProviderPolicyPath(id));
    return CropInsurancePolicy.fromJson(res);
  }

  Future<CropInsurancePolicy> reviewPolicy(
    String id, {
    required String action,
    String? rejectionReason,
    String? underwriterNotes,
    String? insuranceCompany,
  }) async {
    final res = await _client.post(
      insuranceProviderPolicyReviewPath(id),
      body: {
        'action': action,
        if (rejectionReason != null) 'rejectionReason': rejectionReason,
        if (underwriterNotes != null) 'underwriterNotes': underwriterNotes,
        if (insuranceCompany != null) 'insuranceCompany': insuranceCompany,
      },
    );
    return CropInsurancePolicy.fromJson(res);
  }

  Future<Map<String, dynamic>> listProviderClaims({
    String? status,
    String? calamityType,
    String? q,
    int page = 1,
    int pageSize = 20,
  }) async {
    final res = await _client.get(pathInsuranceProviderClaims, query: {
      if (status != null && status != 'all') 'status': status,
      if (calamityType != null) 'calamityType': calamityType,
      if (q != null && q.isNotEmpty) 'q': q,
      'page': page,
      'pageSize': pageSize,
    });
    final list = ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) =>
            InsuranceClaimRecord.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
    return {
      'data': list,
      'page': res['page'] ?? page,
      'pageSize': res['pageSize'] ?? pageSize,
      'total': res['total'] ?? list.length,
    };
  }

  Future<InsuranceClaimRecord> getProviderClaim(String id) async {
    final res = await _client.get(insuranceProviderClaimPath(id));
    return InsuranceClaimRecord.fromJson(res);
  }

  Future<InsuranceClaimRecord> scheduleClaimSurvey(
    String claimId, {
    required String surveyorName,
    required String surveyorPhone,
    required String surveyorVisitDate,
    String? notes,
  }) async {
    final res = await _client.post(
      insuranceProviderClaimScheduleSurveyPath(claimId),
      body: {
        'surveyorName': surveyorName,
        'surveyorPhone': surveyorPhone,
        'surveyorVisitDate': surveyorVisitDate,
        if (notes != null) 'notes': notes,
      },
    );
    return InsuranceClaimRecord.fromJson(res);
  }

  Future<InsuranceClaimRecord> submitClaimSurveyReport(
    String claimId, {
    required double assessedLossPercent,
    String? cropStageVerified,
    String? surveyorNotes,
  }) async {
    final res = await _client.post(
      insuranceProviderClaimSurveyReportPath(claimId),
      body: {
        'assessedLossPercent': assessedLossPercent,
        if (cropStageVerified != null) 'cropStageVerified': cropStageVerified,
        if (surveyorNotes != null) 'surveyorNotes': surveyorNotes,
      },
    );
    return InsuranceClaimRecord.fromJson(res);
  }

  Future<InsuranceClaimRecord> reviewClaim(
    String claimId, {
    required String action,
    double? approvedAmount,
    String? rejectionReason,
    String? notes,
  }) async {
    final res = await _client.post(
      insuranceProviderClaimReviewPath(claimId),
      body: {
        'action': action,
        if (approvedAmount != null) 'approvedAmount': approvedAmount,
        if (rejectionReason != null) 'rejectionReason': rejectionReason,
        if (notes != null) 'notes': notes,
      },
    );
    return InsuranceClaimRecord.fromJson(res);
  }

  Future<InsuranceClaimRecord> disburseClaim(
    String claimId, {
    String? dbtTransactionId,
    double? amount,
    String? notes,
  }) async {
    final res = await _client.post(
      insuranceProviderClaimDisbursePath(claimId),
      body: {
        if (dbtTransactionId != null) 'dbtTransactionId': dbtTransactionId,
        if (amount != null) 'amount': amount,
        if (notes != null) 'notes': notes,
      },
    );
    return InsuranceClaimRecord.fromJson(res);
  }

  Future<CropPremiumRate> createRate({
    required String cropName,
    required String category,
    required String season,
    required double sumInsuredPerAcre,
    required double farmerSharePercent,
    required double totalActuarialRatePercent,
    required String cutoffDate,
  }) async {
    final res = await _client.post(pathInsuranceProviderRates, body: {
      'cropName': cropName,
      'category': category,
      'season': season,
      'sumInsuredPerAcre': sumInsuredPerAcre,
      'farmerSharePercent': farmerSharePercent,
      'totalActuarialRatePercent': totalActuarialRatePercent,
      'cutoffDate': cutoffDate,
    });
    return CropPremiumRate.fromJson(res);
  }
}
