import 'api_client.dart';
import 'endpoints.dart';

class WishlistApi {
  WishlistApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<Map<String, dynamic>>> getWishlist() async {
    final res = await _client.get(pathWishlist);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => (e as Map).cast<String, dynamic>())
        .toList();
  }

  Future<void> addItem(String productId) async {
    await _client.post(pathWishlistItems, body: {'productId': productId});
  }

  Future<void> removeItem(String productId) async {
    await _client.delete(wishlistItemPath(productId));
  }
}
