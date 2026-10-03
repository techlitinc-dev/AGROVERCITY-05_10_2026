import 'api_client.dart';
import 'endpoints.dart';

class TransportApi {
  TransportApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  // ==========================================
  // 1. VEHICLE CATALOG & MANAGEMENT
  // ==========================================

  Future<Map<String, dynamic>> getVehicleTypes({bool extended = false}) =>
      _client.get(pathTransportVehicles, query: {
        if (extended) 'extended': 'true',
      });

  Future<Map<String, dynamic>> fareEstimate(
    String vehicleType,
    double distanceKm,
  ) =>
      _client.post(pathTransportFareEstimate, body: {
        'vehicleType': vehicleType,
        'distanceKm': distanceKm,
      });

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
    String? pucExpiry,
    String? fitnessExpiry,
    String? insuranceExpiry,
    String? permitType,
    String? driverName,
    String? driverPhone,
    String? driverLicense,
  }) =>
      _client.post(pathTransportVehicles, body: {
        'vehicleType': vehicleType,
        'registrationNo': registrationNo,
        'capacityTonnes': capacityTonnes,
        'rcDocUrl': ?rcDocUrl,
        'insuranceDocUrl': ?insuranceDocUrl,
        'pucExpiry': ?pucExpiry,
        'fitnessExpiry': ?fitnessExpiry,
        'insuranceExpiry': ?insuranceExpiry,
        'permitType': ?permitType,
        'driverName': ?driverName,
        'driverPhone': ?driverPhone,
        'driverLicense': ?driverLicense,
      });

  Future<Map<String, dynamic>> updateVehicle(
    String id, {
    String? vehicleType,
    String? registrationNo,
    double? capacityTonnes,
    String? rcDocUrl,
    String? insuranceDocUrl,
    String? pucExpiry,
    String? fitnessExpiry,
    String? insuranceExpiry,
    String? permitType,
    String? driverName,
    String? driverPhone,
    String? driverLicense,
  }) =>
      _client.put(transportVehiclePath(id), body: {
        'vehicleType': ?vehicleType,
        'registrationNo': ?registrationNo,
        'capacityTonnes': ?capacityTonnes,
        'rcDocUrl': ?rcDocUrl,
        'insuranceDocUrl': ?insuranceDocUrl,
        'pucExpiry': ?pucExpiry,
        'fitnessExpiry': ?fitnessExpiry,
        'insuranceExpiry': ?insuranceExpiry,
        'permitType': ?permitType,
        'driverName': ?driverName,
        'driverPhone': ?driverPhone,
        'driverLicense': ?driverLicense,
      });

  Future<Map<String, dynamic>> deleteVehicle(String id) =>
      _client.delete(transportVehiclePath(id));

  Future<Map<String, dynamic>> getVehicleCalendar(String id) =>
      _client.get(transportVehicleCalendarPath(id));

  Future<Map<String, dynamic>> setAvailability(String id, List<String> dates) =>
      _client.put(transportVehicleAvailabilityPath(id), body: {
        'availableDates': dates,
      });

  // ==========================================
  // 2. TRANSPORTER PROFILE & STATS
  // ==========================================

  Future<Map<String, dynamic>> getTransporterProfile() =>
      _client.get(pathTransportProfile);

  Future<Map<String, dynamic>> updateTransporterProfile(
          Map<String, dynamic> data) =>
      _client.put(pathTransportProfile, body: data);

  // ==========================================
  // 3. BOOKINGS & TRIP LIFECYCLE
  // ==========================================

  Future<Map<String, dynamic>> createBooking({
    required String vehicleType,
    required double distanceKm,
    required String pickup,
    required String drop,
    required String date,
    String? lotId,
    String? commodity,
    double? weightQuintals,
    String? packaging,
    String? notes,
  }) =>
      _client.post(pathTransportBookings, body: {
        'vehicleType': vehicleType,
        'distanceKm': distanceKm,
        'pickup': pickup,
        'drop': drop,
        'date': date,
        'lotId': ?lotId,
        'commodity': ?commodity,
        'weightQuintals': ?weightQuintals,
        'packaging': ?packaging,
        'notes': ?notes,
      });

  Future<Map<String, dynamic>> getBookings({String? status, int page = 1}) =>
      _client.get(pathTransportBookings,
          query: {'status': ?status, 'page': page});

  Future<Map<String, dynamic>> getBookingDetail(String id) =>
      _client.get(transportBookingPath(id));

  Future<Map<String, dynamic>> updateBooking(
    String id,
    String status, {
    String? vehicleId,
    String? vehicleNo,
    List<String>? podPhotos,
    String? receiverName,
    String? receiverPhone,
    String? damageNotes,
  }) =>
      _client.patch(transportBookingPath(id), body: {
        'status': status,
        'vehicleId': ?vehicleId,
        'vehicleNo': ?vehicleNo,
        'podPhotos': ?podPhotos,
        'receiverName': ?receiverName,
        'receiverPhone': ?receiverPhone,
        'damageNotes': ?damageNotes,
      });

  Future<Map<String, dynamic>> acceptBooking(
    String id, {
    String? vehicleId,
    String? vehicleNo,
    String? driverName,
    String? driverPhone,
  }) =>
      _client.post(transportBookingAcceptPath(id), body: {
        'vehicleId': ?vehicleId,
        'vehicleNo': ?vehicleNo,
        'driverName': ?driverName,
        'driverPhone': ?driverPhone,
      });

  Future<Map<String, dynamic>> rejectBooking(String id, String reason) =>
      _client.post(transportBookingRejectPath(id), body: {'reason': reason});

  // ==========================================
  // 4. LOAD BOARD (लोड बाज़ार)
  // ==========================================

  Future<Map<String, dynamic>> getOpenLoads({
    String? crop,
    String? pickup,
    String? drop,
  }) =>
      _client.get(pathTransportLoads, query: {
        'crop': ?crop,
        'pickup': ?pickup,
        'drop': ?drop,
      });

  Future<Map<String, dynamic>> postOpenLoad({
    required String pickupLocation,
    required String dropLocation,
    required String crop,
    required double quantityQuintals,
    String packaging = 'Gunny Bags',
    bool perishable = false,
    String preferredVehicleType = 'Tata Ace',
    required String pickupDate,
    required double targetFare,
    String? notes,
  }) =>
      _client.post(pathTransportLoads, body: {
        'pickupLocation': pickupLocation,
        'dropLocation': dropLocation,
        'crop': crop,
        'quantityQuintals': quantityQuintals,
        'packaging': packaging,
        'perishable': perishable,
        'preferredVehicleType': preferredVehicleType,
        'pickupDate': pickupDate,
        'targetFare': targetFare,
        'notes': ?notes,
      });

  Future<Map<String, dynamic>> submitLoadBid(
    String loadId, {
    required double quotedFare,
    String? vehicleId,
    String? vehicleNo,
    String? estimatedPickupTime,
    String? notes,
  }) =>
      _client.post(transportLoadBidPath(loadId), body: {
        'quotedFare': quotedFare,
        'vehicleId': ?vehicleId,
        'vehicleNo': ?vehicleNo,
        'estimatedPickupTime': ?estimatedPickupTime,
        'notes': ?notes,
      });

  Future<Map<String, dynamic>> getLoadBids(String loadId) =>
      _client.get(transportLoadBidsPath(loadId));

  Future<Map<String, dynamic>> acceptLoadBid(String loadId, String bidId) =>
      _client.post(transportLoadAcceptBidPath(loadId),
          query: {'bidId': bidId});

  // ==========================================
  // 5. GPS LIVE LOCATION TRACKING
  // ==========================================

  Future<Map<String, dynamic>> updateTripLocation(
    String bookingId, {
    required double lat,
    required double lng,
    double speedKmH = 0.0,
    double heading = 0.0,
    String? waypoint,
    String? waypointLabel,
    String? notes,
  }) =>
      _client.post(transportBookingLocationPath(bookingId), body: {
        'lat': lat,
        'lng': lng,
        'speedKmH': speedKmH,
        'heading': heading,
        'waypoint': ?waypoint,
        'waypointLabel': ?waypointLabel,
        'notes': ?notes,
      });

  Future<Map<String, dynamic>> getTripLocation(String bookingId) =>
      _client.get(transportBookingLocationPath(bookingId));

  // ==========================================
  // 6. DIGITAL BILTY & WEIGHBRIDGE SLIP
  // ==========================================

  Future<Map<String, dynamic>> getDigitalBilty(String bookingId) =>
      _client.get(transportBookingBiltyPath(bookingId));

  Future<Map<String, dynamic>> recordWeighbridge(
    String bookingId, {
    required String slipNo,
    required double tareWeightKg,
    required double grossWeightKg,
    double? netWeightKg,
    String weighbridgeName = 'धर्मकांटा',
    String? slipPhotoUrl,
    String? notes,
  }) =>
      _client.post(transportBookingWeighbridgePath(bookingId), body: {
        'slipNo': slipNo,
        'weighbridgeName': weighbridgeName,
        'tareWeightKg': tareWeightKg,
        'grossWeightKg': grossWeightKg,
        'netWeightKg': ?netWeightKg,
        'slipPhotoUrl': ?slipPhotoUrl,
        'notes': ?notes,
      });

  // ==========================================
  // 7. TRIP EXPENSES & NET PROFIT
  // ==========================================

  Future<Map<String, dynamic>> addTripExpense(
    String bookingId, {
    required String category,
    required double amount,
    String? notes,
    String? receiptPhotoUrl,
  }) =>
      _client.post(transportBookingExpensesPath(bookingId), body: {
        'category': category,
        'amount': amount,
        'notes': ?notes,
        'receiptPhotoUrl': ?receiptPhotoUrl,
      });

  Future<Map<String, dynamic>> getTripExpenses(String bookingId) =>
      _client.get(transportBookingExpensesPath(bookingId));

  // ==========================================
  // 8. TMS PERFORMANCE ANALYTICS
  // ==========================================

  Future<Map<String, dynamic>> getTransportAnalytics() =>
      _client.get(pathTransportAnalytics);
}
