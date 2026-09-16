import 'package:kisan_setu/api/equipment_api.dart';
import 'package:kisan_setu/api/fpo_api.dart';

class FakeEquipmentApi extends EquipmentApi {
  Map<String, dynamic> equipmentResponse = const {'data': <Map<String, dynamic>>[]};
  Map<String, dynamic> slotsResponse = const {'data': <Map<String, dynamic>>[]};
  Map<String, dynamic> fleetResponse = const {'data': <Map<String, dynamic>>[]};
  Map<String, dynamic> pendingResponse = const {'data': <Map<String, dynamic>>[]};

  Object? bookError;
  Object? waitlistError;
  Object? cancelError;
  Object? approveError;
  Object? rejectError;

  final List<Map<String, dynamic>> bookSlotCalls = [];
  final List<String> waitlistCalls = [];
  final List<String> cancelCalls = [];
  final List<String> approveCalls = [];
  final List<Map<String, dynamic>> rejectCalls = [];
  final List<Map<String, dynamic>> createCalls = [];
  final List<Map<String, dynamic>> updateCalls = [];

  String? lastSlotsEquipmentId;
  String? lastSlotsDate;

  @override
  Future<Map<String, dynamic>> getEquipment({String? type}) async =>
      equipmentResponse;

  @override
  Future<Map<String, dynamic>> getSlots(String equipmentId, String date) async {
    lastSlotsEquipmentId = equipmentId;
    lastSlotsDate = date;
    return slotsResponse;
  }

  @override
  Future<Map<String, dynamic>> bookSlot(String slotId, String farmerName) async {
    bookSlotCalls.add({'slotId': slotId, 'farmerName': farmerName});
    final error = bookError;
    if (error != null) throw error;
    return {
      'booking': {'id': 'bkeq_new', 'slotId': slotId, 'status': 'booked'},
      'status': 'booked',
      'agriCoinsEarned': 50,
    };
  }

  @override
  Future<Map<String, dynamic>> joinWaitlist(String slotId) async {
    waitlistCalls.add(slotId);
    final error = waitlistError;
    if (error != null) throw error;
    return {'ok': true};
  }

  @override
  Future<Map<String, dynamic>> cancelBooking(String bookingId) async {
    cancelCalls.add(bookingId);
    final error = cancelError;
    if (error != null) throw error;
    return {'ok': true, 'promotedUserId': null};
  }

  @override
  Future<Map<String, dynamic>> createEquipment({
    required String name,
    required String type,
    required double hourlyRate,
    double? perAcreRate,
    List<Map<String, dynamic>>? slotTemplate,
  }) async {
    createCalls.add({
      'name': name,
      'type': type,
      'hourlyRate': hourlyRate,
      'perAcreRate': perAcreRate,
      'slotTemplate': slotTemplate,
    });
    return {'id': 'eq_new', 'docStatus': 'pending', 'active': true};
  }

  @override
  Future<Map<String, dynamic>> updateEquipment(
    String id, {
    String? name,
    String? type,
    double? hourlyRate,
    double? perAcreRate,
    List<Map<String, dynamic>>? slotTemplate,
  }) async {
    updateCalls.add({
      'id': id,
      'name': name,
      'type': type,
      'hourlyRate': hourlyRate,
      'perAcreRate': perAcreRate,
      'slotTemplate': slotTemplate,
    });
    return {'id': id};
  }

  @override
  Future<Map<String, dynamic>> getOwnerFleet() async => fleetResponse;

  @override
  Future<Map<String, dynamic>> getPendingBookings() async => pendingResponse;

  @override
  Future<Map<String, dynamic>> approveBooking(String id) async {
    approveCalls.add(id);
    final error = approveError;
    if (error != null) throw error;
    return {'id': id, 'status': 'booked'};
  }

  @override
  Future<Map<String, dynamic>> rejectBooking(String id, String reason) async {
    rejectCalls.add({'id': id, 'reason': reason});
    final error = rejectError;
    if (error != null) throw error;
    return {'ok': true, 'promotedUserId': null};
  }
}

class FakeFpoApi extends FpoApi {
  Map<String, dynamic> meResponse = const {
    'name': 'Sahyadri Shetkari FPO',
    'memberCount': 214,
    'district': 'Nashik',
  };
  Map<String, dynamic> poolsResponse = const {'data': <Map<String, dynamic>>[]};
  Map<String, dynamic> machineryResponse = const {'data': <Map<String, dynamic>>[]};

  Object? joinError;
  final List<Map<String, dynamic>> joinCalls = [];

  @override
  Future<Map<String, dynamic>> getFpoMe() async => meResponse;

  @override
  Future<Map<String, dynamic>> getPools() async => poolsResponse;

  @override
  Future<Map<String, dynamic>> joinPool(String id, int units) async {
    joinCalls.add({'id': id, 'units': units});
    final error = joinError;
    if (error != null) throw error;
    final pools = (poolsResponse['data'] as List).cast<Map<String, dynamic>>();
    final pool = pools.firstWhere((p) => p['id'] == id, orElse: () => const {});
    final booked = ((pool['bookedUnits'] as num?) ?? 0).toInt() + units;
    return {...pool, 'bookedUnits': booked};
  }

  @override
  Future<Map<String, dynamic>> getMachinery({String? week}) async =>
      machineryResponse;
}
