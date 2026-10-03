import 'api_client.dart';
import 'endpoints.dart';

class RatingsApi {
  RatingsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> postRating({
    required String bookingKind,
    required String bookingId,
    required int stars,
    String comment = '',
  }) =>
      _client.post(pathRatings, body: {
        'bookingKind': bookingKind,
        'bookingId': bookingId,
        'stars': stars,
        'comment': comment,
      });
}
