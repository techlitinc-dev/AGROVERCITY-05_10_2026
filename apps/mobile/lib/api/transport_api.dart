import 'api_client.dart';
import 'endpoints.dart';

class TransportApi {
  TransportApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> getVehicleTypes() =>
      _client.get(pathTransportVehicles);

  Future<Map<String, dynamic>> fareEstimate(
    String vehicleType,
    double distanceKm,
  ) =>
      _client.post(pathTransportFareEstimate, body: {
        'vehicleType': vehicleType,
        'distanceKm': distanceKm,
      });

  Future<Map<String, dynamic>> createBooking({
    required String vehicleType,
    required double distanceKm,
    required String pickup,
    required String drop,
    required String date,
    String? lotId,
  }) =>
      _client.post(pathTransportBookings, body: {
        'vehicleType': vehicleType,
        'distanceKm': distanceKm,
        'pickup': pickup,
        'drop': drop,
        'date': date,
        'lotId': ?lotId,
      });

  Future<Map<String, dynamic>> getBookings({String? status, int page = 1}) =>
      _client.get(pathTransportBookings, query: {'status': ?status, 'page': page});

  Future<Map<String, dynamic>> updateBooking(
    String id,
    String status, {
    String? vehicleId,
    String? vehicleNo,
    List<String>? podPhotos,
    String? receiverName,
  }) =>
      _client.patch(transportBookingPath(id), body: {
        'status': status,
        'vehicleId': ?vehicleId,
        'vehicleNo': ?vehicleNo,
        'podPhotos': ?podPhotos,
        'receiverName': ?receiverName,
      });

  Future<Map<String, dynamic>> acceptBooking(
    String id, {
    String? vehicleId,
    String? vehicleNo,
  }) =>
      _client.post(transportBookingAcceptPath(id), body: {
        'vehicleId': ?vehicleId,
        'vehicleNo': ?vehicleNo,
      });

  Future<Map<String, dynamic>> rejectBooking(String id, String reason) =>
      _client.post(transportBookingRejectPath(id), body: {'reason': reason});

  Future<Map<String, dynamic>> getMyVehicles({bool verifiedOnly = false}) =>
      _client.get(pathTransportVehiclesMy, query: {
        if (verifiedOnly) 'verifiedOnly': 'true',
      });

  Future<Map<String, dynamic>> createVehicle({
    required String vehicleType,
    required String registrationNo,
    required double capacityTonnes,
    String? rcDocUrl,
    String? insuranceDocUrl,
  }) =>
      _client.post(pathTransportVehicles, body: {
        'vehicleType': vehicleType,
        'registrationNo': registrationNo,
        'capacityTonnes': capacityTonnes,
        'rcDocUrl': ?rcDocUrl,
        'insuranceDocUrl': ?insuranceDocUrl,
      });

  Future<Map<String, dynamic>> updateVehicle(
    String id, {
    String? vehicleType,
    String? registrationNo,
    double? capacityTonnes,
    String? rcDocUrl,
    String? insuranceDocUrl,
  }) =>
      _client.put(transportVehiclePath(id), body: {
        'vehicleType': ?vehicleType,
        'registrationNo': ?registrationNo,
        'capacityTonnes': ?capacityTonnes,
        'rcDocUrl': ?rcDocUrl,
        'insuranceDocUrl': ?insuranceDocUrl,
      });

  Future<Map<String, dynamic>> deleteVehicle(String id) =>
      _client.delete(transportVehiclePath(id));

  Future<Map<String, dynamic>> getVehicleCalendar(String id) =>
      _client.get(transportVehicleCalendarPath(id));

  Future<Map<String, dynamic>> setAvailability(String id, List<String> dates) =>
      _client.put(transportVehicleAvailabilityPath(id), body: {
        'availableDates': dates,
      });
}
