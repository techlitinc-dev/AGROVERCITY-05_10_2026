import '../models/tree_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class TreeApi {
  TreeApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<TreeArticle>> listArticles({String? category}) async {
    final res = await _client.get(pathTreeArticles, query: {
      'category': ?category,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => TreeArticle.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<NgoOrganization>> listNgos() async {
    final res = await _client.get(pathTreeNgos);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => NgoOrganization.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, dynamic>> requestSaplings(
    String ngoId, {
    required String treeType,
    required int count,
  }) =>
      _client.post(treeNgoSaplingRequestPath(ngoId), body: {
        'treeType': treeType,
        'count': count,
      });

  Future<List<BiofuelTree>> listBiofuel() async {
    final res = await _client.get(pathTreeBiofuel);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => BiofuelTree.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<TreeCareGuide>> listCareGuides() async {
    final res = await _client.get(pathTreeCareGuides);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => TreeCareGuide.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<CarbonEstimate> estimateCarbon({
    required String treeSpecies,
    required int treeCount,
    int ageYears = 1,
  }) async {
    final res = await _client.post(pathTreeCarbonEstimate, body: {
      'treeSpecies': treeSpecies,
      'treeCount': treeCount,
      'ageYears': ageYears,
    });
    return CarbonEstimate.fromJson(res);
  }

  Future<TreePlantation> registerPlantation({
    required String parcelName,
    required String treeSpecies,
    String vernacularSpecies = '',
    required int treeCount,
    required String plantingDate,
    String landType = 'bund',
    required double latitude,
    required double longitude,
    double initialHeightCm = 30.0,
    String photoUrl = '',
    String irrigationType = 'drip',
  }) async {
    final res = await _client.post(pathTreePlantations, body: {
      'parcelName': parcelName,
      'treeSpecies': treeSpecies,
      'vernacularSpecies': vernacularSpecies,
      'treeCount': treeCount,
      'plantingDate': plantingDate,
      'landType': landType,
      'latitude': latitude,
      'longitude': longitude,
      'initialHeightCm': initialHeightCm,
      'photoUrl': photoUrl,
      'irrigationType': irrigationType,
    });
    return TreePlantation.fromJson(res);
  }

  Future<List<TreePlantation>> listMyPlantations() async {
    final res = await _client.get(pathTreePlantationsMine);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => TreePlantation.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<TreePlantation> getPlantation(String id) async {
    final res = await _client.get(treePlantationPath(id));
    return TreePlantation.fromJson(res);
  }

  Future<PlantationLogEntry> addPlantationLog(
    String plantationId, {
    required double heightCm,
    double girthCm = 0.0,
    required int survivalCount,
    String healthStatus = 'healthy',
    String notes = '',
    String photoUrl = '',
    String auditDate = '',
  }) async {
    final res = await _client.post(treePlantationLogsPath(plantationId), body: {
      'heightCm': heightCm,
      'girthCm': girthCm,
      'survivalCount': survivalCount,
      'healthStatus': healthStatus,
      'notes': notes,
      'photoUrl': photoUrl,
      'auditDate': auditDate,
    });
    return PlantationLogEntry.fromJson(res);
  }

  Future<List<AgroforestryScheme>> listSchemes() async {
    final res = await _client.get(pathTreeSchemes);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) =>
            AgroforestryScheme.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<SpeciesRecommendation>> getSpeciesSuitability({
    String soilType = 'black_cotton',
    String waterAvailability = 'limited_drip',
  }) async {
    final res = await _client.get(pathTreeSpeciesSuitability, query: {
      'soilType': soilType,
      'waterAvailability': waterAvailability,
    });
    return ((res['recommendations'] as List?) ?? const <dynamic>[])
        .map((e) =>
            SpeciesRecommendation.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<TreeAdoption>> listMyAdoptions() async {
    final res = await _client.get(pathTreeAdoptionsMine);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => TreeAdoption.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }
}

