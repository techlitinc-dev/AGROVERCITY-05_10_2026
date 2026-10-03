import '../models/livestock_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class LivestockApi {
  LivestockApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<GaushalaItem>> listGaushalas({String? district}) async {
    final res = await _client.get(pathGaushalas, query: {
      'district': ?district,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => GaushalaItem.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, dynamic>> orderManure(
    String gaushalaId, {
    required String product,
    required String quantity,
  }) =>
      _client.post(gaushalaManureOrderPath(gaushalaId), body: {
        'product': product,
        'quantity': quantity,
      });

  Future<List<PlantNursery>> listNurseries() async {
    final res = await _client.get(pathNurseries);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => PlantNursery.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<VetDoctor>> listVets({bool emergency = false}) async {
    final res = await _client.get(pathVets, query: {
      if (emergency) 'emergency': 'true',
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => VetDoctor.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, dynamic>> bookVet(
    String vetId, {
    required String visitType,
    required String slot,
    required String animalType,
  }) =>
      _client.post(vetBookPath(vetId), body: {
        'visitType': visitType,
        'slot': slot,
        'animalType': animalType,
      });

  Future<List<DairyProductItem>> listDairyProducts({String? category}) async {
    final res = await _client.get(pathDairyProducts, query: {
      'category': ?category,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map(
            (e) => DairyProductItem.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, dynamic>> orderDairy(
    String productId, {
    required int quantity,
  }) =>
      _client.post(dairyProductOrderPath(productId), body: {
        'quantity': quantity,
      });

  // -------------------------------------------------------------
  // Cattle Herd & Tag Passport
  // -------------------------------------------------------------

  Future<List<Animal>> listAnimals({
    String? species,
    String? lactationStage,
    String? search,
  }) async {
    final res = await _client.get(pathLivestockAnimals, query: {
      if (species != null && species.isNotEmpty) 'species': species,
      if (lactationStage != null && lactationStage.isNotEmpty)
        'lactationStage': lactationStage,
      if (search != null && search.isNotEmpty) 'search': search,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => Animal.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Animal> createAnimal(Map<String, dynamic> data) async {
    final res = await _client.post(pathLivestockAnimals, body: data);
    return Animal.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<Animal> getAnimal(String animalId) async {
    final res = await _client.get(livestockAnimalPath(animalId));
    return Animal.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<AnimalYieldLog> logAnimalYield(
    String animalId,
    Map<String, dynamic> data,
  ) async {
    final res = await _client.post(
      livestockAnimalLogsPath(animalId),
      body: data,
    );
    return AnimalYieldLog.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<List<AnimalYieldLog>> getAnimalYieldLogs(String animalId) async {
    final res = await _client.get(livestockAnimalLogsPath(animalId));
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => AnimalYieldLog.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  // -------------------------------------------------------------
  // Milk Procurement, Rate Chart & Digital Slips
  // -------------------------------------------------------------

  Future<RateChartCalcResult> calcRateChart({
    required String cattleType,
    required double fatPercentage,
    required double snfPercentage,
    required double quantityLiters,
  }) async {
    final res = await _client.post(
      pathLivestockProcurementRateCalc,
      body: {
        'cattleType': cattleType,
        'fatPercentage': fatPercentage,
        'snfPercentage': snfPercentage,
        'quantityLiters': quantityLiters,
      },
    );
    return RateChartCalcResult.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<MilkCollection> createMilkCollection(
    Map<String, dynamic> data, {
    String? memberId,
    Map<String, dynamic>? quality,
  }) async {
    final res = await _client.post(
      pathLivestockProcurementCollections,
      body: {
        ...data,
        if (memberId != null && memberId.isNotEmpty) 'memberId': memberId,
        if (quality != null && quality.isNotEmpty) 'quality': quality,
      },
    );
    return MilkCollection.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<List<MilkCollection>> listMilkCollections({
    String? date,
    String? shift,
    String? cattleType,
  }) async {
    final res = await _client.get(pathLivestockProcurementCollections, query: {
      if (date != null && date.isNotEmpty) 'date': date,
      if (shift != null && shift.isNotEmpty) 'shift': shift,
      if (cattleType != null && cattleType.isNotEmpty) 'cattleType': cattleType,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => MilkCollection.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<MilkProcurementSummary> getProcurementSummary({String? date}) async {
    final res = await _client.get(pathLivestockProcurementSummary, query: {
      if (date != null && date.isNotEmpty) 'date': date,
    });
    return MilkProcurementSummary.fromJson(
      (res as Map).cast<String, dynamic>(),
    );
  }

  // -------------------------------------------------------------
  // Breeding & Calving Lifecycle
  // -------------------------------------------------------------

  Future<List<BreedingCycle>> listBreedingCycles({
    String? pdStatus,
    String? tagId,
  }) async {
    final res = await _client.get(pathLivestockBreeding, query: {
      if (pdStatus != null && pdStatus.isNotEmpty) 'pdStatus': pdStatus,
      if (tagId != null && tagId.isNotEmpty) 'tagId': tagId,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => BreedingCycle.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<BreedingCycle> createBreedingCycle(Map<String, dynamic> data) async {
    final res = await _client.post(pathLivestockBreeding, body: data);
    return BreedingCycle.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<BreedingCycle> updateBreedingStatus(
    String cycleId, {
    String? pdStatus,
    String? pdDate,
    String? calvingDate,
    String? calvingOutcome,
  }) async {
    final res = await _client.put(
      livestockBreedingStatusPath(cycleId),
      body: {
        'pdStatus': ?pdStatus,
        'pdDate': ?pdDate,
        'calvingDate': ?calvingDate,
        'calvingOutcome': ?calvingOutcome,
      },
    );
    return BreedingCycle.fromJson((res as Map).cast<String, dynamic>());
  }

  // -------------------------------------------------------------
  // Veterinary Clinic, Health & Vaccines
  // -------------------------------------------------------------

  Future<List<VetRecord>> listVetRecords({
    String? animalId,
    String? status,
  }) async {
    final res = await _client.get(pathLivestockVetRecords, query: {
      if (animalId != null && animalId.isNotEmpty) 'animalId': animalId,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => VetRecord.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<VetRecord> createVetRecord(Map<String, dynamic> data) async {
    final res = await _client.post(pathLivestockVetRecords, body: data);
    return VetRecord.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<List<VaccinationSchedule>> listVaccinations({
    String? animalId,
    String? status,
  }) async {
    final res = await _client.get(pathLivestockVetVaccinations, query: {
      if (animalId != null && animalId.isNotEmpty) 'animalId': animalId,
      if (status != null && status.isNotEmpty) 'status': status,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) =>
            VaccinationSchedule.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<VaccinationSchedule> scheduleVaccination(
    Map<String, dynamic> data,
  ) async {
    final res = await _client.post(pathLivestockVetVaccinations, body: data);
    return VaccinationSchedule.fromJson((res as Map).cast<String, dynamic>());
  }

  // -------------------------------------------------------------
  // Gaushala Adoptions, Donations & Panchagavya
  // -------------------------------------------------------------

  Future<List<CowAdoption>> listCowAdoptions({
    String? status,
    String? gaushalaId,
  }) async {
    final res = await _client.get(pathLivestockGaushalaAdoptions, query: {
      if (status != null && status.isNotEmpty) 'status': status,
      if (gaushalaId != null && gaushalaId.isNotEmpty)
        'gaushalaId': gaushalaId,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => CowAdoption.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<CowAdoption> createCowAdoption(Map<String, dynamic> data) async {
    final res = await _client.post(pathLivestockGaushalaAdoptions, body: data);
    return CowAdoption.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<List<FodderDonation>> listFodderDonations({
    String? gaushalaId,
  }) async {
    final res = await _client.get(pathLivestockGaushalaDonations, query: {
      if (gaushalaId != null && gaushalaId.isNotEmpty)
        'gaushalaId': gaushalaId,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => FodderDonation.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<FodderDonation> createFodderDonation(
    Map<String, dynamic> data,
  ) async {
    final res = await _client.post(pathLivestockGaushalaDonations, body: data);
    return FodderDonation.fromJson((res as Map).cast<String, dynamic>());
  }

  Future<List<PanchagavyaProduct>> listPanchagavyaProducts({
    String? category,
    String? gaushalaId,
  }) async {
    final res = await _client.get(pathLivestockGaushalaByproducts, query: {
      if (category != null && category.isNotEmpty) 'category': category,
      if (gaushalaId != null && gaushalaId.isNotEmpty)
        'gaushalaId': gaushalaId,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) =>
            PanchagavyaProduct.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<PanchagavyaProduct> createPanchagavyaProduct(
    Map<String, dynamic> data,
  ) async {
    final res = await _client.post(pathLivestockGaushalaByproducts, body: data);
    return PanchagavyaProduct.fromJson((res as Map).cast<String, dynamic>());
  }
}

