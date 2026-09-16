import 'api_client.dart';
import 'endpoints.dart';

class EquipmentApi {
  EquipmentApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> getEquipment({String? type}) =>
      _client.get(pathEquipment, query: {'type': ?type});

  Future<Map<String, dynamic>> getSlots(String equipmentId, String date) =>
      _client.get(equipmentSlotsPath(equipmentId), query: {'date': date});

  Future<Map<String, dynamic>> bookSlot(String slotId, String farmerName) =>
      _client.post(equipmentSlotBookPath(slotId), body: {
        'farmerName': farmerName,
      });

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
