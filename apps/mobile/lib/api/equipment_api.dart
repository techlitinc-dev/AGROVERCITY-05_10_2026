import '../services/offline_queue.dart';
import 'api_client.dart';
import 'api_exception.dart';
import 'endpoints.dart';

class EquipmentApi {
  EquipmentApi({ApiClient? client, OfflineQueue? queue})
      : _client = client ?? ApiClient(),
        _queue = queue ?? OfflineQueue.instance;

  final ApiClient _client;
  final OfflineQueue _queue;

  Future<Map<String, dynamic>> getEquipment({String? type}) =>
      _client.get(pathEquipment, query: {'type': ?type});

  Future<Map<String, dynamic>> getSlots(String equipmentId, String date) =>
      _client.get(equipmentSlotsPath(equipmentId), query: {'date': date});

  // On a network failure the booking queues for /v1/sync replay and the
  // caller gets {'queued': true} (Day 11 B4.2); 4xx errors still throw.
  Future<Map<String, dynamic>> bookSlot(String slotId, String farmerName) async {
    try {
      return await _client.post(equipmentSlotBookPath(slotId), body: {
        'farmerName': farmerName,
      });
    } on ApiException catch (e) {
      if (e.code == 'NETWORK_ERROR') {
        await _queue.enqueue(
          method: 'POST',
          path: equipmentSlotBookPath(slotId),
          body: {'farmerName': farmerName},
        );
        return {'queued': true};
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> joinWaitlist(String slotId) =>
      _client.post(equipmentSlotWaitlistPath(slotId));

  Future<Map<String, dynamic>> cancelBooking(String bookingId) =>
      _client.delete(equipmentBookingPath(bookingId));

  Future<Map<String, dynamic>> createEquipment({
    required String name,
    required String type,
    required double hourlyRate,
    double? perAcreRate,
    List<Map<String, dynamic>>? slotTemplate,
  }) =>
      _client.post(pathEquipment, body: {
        'name': name,
        'type': type,
        'hourlyRate': hourlyRate,
        'perAcreRate': ?perAcreRate,
        'slotTemplate': ?slotTemplate,
      });

  Future<Map<String, dynamic>> updateEquipment(
    String id, {
    String? name,
    String? type,
    double? hourlyRate,
    double? perAcreRate,
    List<Map<String, dynamic>>? slotTemplate,
  }) =>
      _client.put(equipmentPath(id), body: {
        'name': ?name,
        'type': ?type,
        'hourlyRate': ?hourlyRate,
        'perAcreRate': ?perAcreRate,
        'slotTemplate': ?slotTemplate,
      });

  Future<Map<String, dynamic>> getOwnerFleet() =>
      _client.get(pathEquipmentOwnerFleet);

  Future<Map<String, dynamic>> getPendingBookings() =>
      _client.get(pathEquipmentBookingsPending);

  Future<Map<String, dynamic>> approveBooking(String id) =>
      _client.post(equipmentBookingApprovePath(id));

  Future<Map<String, dynamic>> rejectBooking(String id, String reason) =>
      _client.post(equipmentBookingRejectPath(id), body: {'reason': reason});
}
