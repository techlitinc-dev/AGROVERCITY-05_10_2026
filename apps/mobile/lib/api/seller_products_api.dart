import '../models/emarket_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class SellerProductsApi {
  SellerProductsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<SellerProduct>> list() async {
    final res = await _client.get(pathSellerProducts);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => SellerProduct.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<SellerProduct> create({
    required String title,
    required String category,
    required String brand,
    required double mrp,
    required double discountedPrice,
    required int stock,
    required String unit,
    String? description,
    String? imageUrl,
  }) async {
    final res = await _client.post(pathSellerProducts, body: {
      'title': title,
      'category': category,
      'brand': brand,
      'mrp': mrp,
      'discountedPrice': discountedPrice,
      'stock': stock,
      'unit': unit,
      if (description != null && description.isNotEmpty)
        'description': description,
      if (imageUrl != null && imageUrl.isNotEmpty) 'imageUrl': imageUrl,
    });
    return SellerProduct.fromJson(res);
  }

  Future<SellerProduct> update(
    String id, {
    double? mrp,
    double? discountedPrice,
    int? stock,
    String? title,
    String? category,
    String? brand,
    String? unit,
    String? description,
    String? imageUrl,
  }) async {
    final res = await _client.put(sellerProductPath(id), body: {
      'mrp': ?mrp,
      'discountedPrice': ?discountedPrice,
      'stock': ?stock,
      'title': ?title,
      'category': ?category,
      'brand': ?brand,
      'unit': ?unit,
      'description': ?description,
      'imageUrl': ?imageUrl,
    });
    return SellerProduct.fromJson(res);
  }
}
