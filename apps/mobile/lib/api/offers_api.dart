import 'api_client.dart';
import 'endpoints.dart';
import '../models/direct_buyer_models.dart';

class OffersApi {
  OffersApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Offer> createOffer({
    required String targetType,
    required String targetId,
    required int pricePerUnit,
    required double quantity,
    String message = '',
  }) async {
    final res = await _client.post(pathOffers, body: {
      'targetType': targetType,
      'targetId': targetId,
      'pricePerUnit': pricePerUnit,
      'quantity': quantity,
      'message': message,
    });
    return Offer.fromJson(res);
  }

  Future<Map<String, dynamic>> listMine({
    String filter = 'sent',
    String? targetType,
    int page = 1,
    int pageSize = 20,
  }) =>
      _client.get(pathOffersMine, query: {
        'filter': filter,
        'targetType': ?targetType,
        'page': page,
        'pageSize': pageSize,
      });

  Future<Offer> getOffer(String id) async {
    final res = await _client.get(offerPath(id));
    return Offer.fromJson(res);
  }

  Future<Offer> accept(String id) async {
    final res = await _client.post(offerAcceptPath(id));
    return Offer.fromJson((res['offer'] as Map?)?.cast<String, dynamic>() ?? res);
  }

  Future<Offer> reject(String id) async {
    final res = await _client.post(offerRejectPath(id));
    return Offer.fromJson(res);
  }

  Future<Offer> withdraw(String id) async {
    final res = await _client.post(offerWithdrawPath(id));
    return Offer.fromJson(res);
  }

  Future<Offer> counter(String id, int pricePerUnit, String note) async {
    final res = await _client.post(offerCounterPath(id),
        body: {'pricePerUnit': pricePerUnit, 'note': note});
    return Offer.fromJson(res);
  }
}
