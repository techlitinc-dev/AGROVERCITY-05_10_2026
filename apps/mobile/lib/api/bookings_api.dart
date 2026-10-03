import '../models/booking.dart';
import 'api_client.dart';
import 'endpoints.dart';

class BookingsApi {
  BookingsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<MyBookings> getMyBookings({String? status}) async {
    final res = await _client.get(pathUsersMeBookings, query: {
      'status': ?status,
    });
    return MyBookings.fromJson(res);
  }

  Future<void> cancelEquipmentBooking(String id) =>
      _client.delete(equipmentBookingPath(id)).then((_) {});
}
