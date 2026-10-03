import 'api_client.dart';
import 'endpoints.dart';

class MarketplaceApi {
  MarketplaceApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> getProducts({
    String? category,
    String? query,
    int page = 1,
  }) =>
      _client.get(pathProducts, query: {
        'category': ?category,
        'query': ?query,
        'page': page,
      });

  Future<Map<String, dynamic>> getProduct(String id) =>
      _client.get(productPath(id));

  Future<Map<String, dynamic>> getCertificate(String id) =>
      _client.get(productCertificatePath(id));

  Future<Map<String, dynamic>> getCart() => _client.get(pathCart);

  Future<Map<String, dynamic>> addToCart(String productId, int quantity) =>
      _client.post(pathCartItems,
          body: {'productId': productId, 'quantity': quantity});

  Future<Map<String, dynamic>> updateCartItem(
    String productId,
    int quantity,
  ) =>
      _client.put(cartItemPath(productId), body: {'quantity': quantity});

  Future<Map<String, dynamic>> removeCartItem(String productId) =>
      _client.delete(cartItemPath(productId));

  Future<Map<String, dynamic>> postReview(
    String productId,
    int rating,
    String comment,
  ) =>
      _client.post(productReviewsPath(productId), body: {
        'rating': rating,
        'comment': comment,
      });

  Future<Map<String, dynamic>> listReviews(String productId) =>
      _client.get(productReviewsPath(productId));
}
