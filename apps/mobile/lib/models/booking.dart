// Aggregate "My Bookings" model — tolerant union parser over the per-kind
// shapes returned by GET /v1/users/me/bookings (Day 11 Task A3).

class Booking {
  final String id;
  final String kind; // equipment | vet | transport | coldStorage
  final String status;
  final String date;
  final String? slotName;
  final int? priceRupees;
  final String? vetName;
  final String? visitType;
  final String? slot;
  final String? animalType;
  final String? vehicleType;
  final String? pickup;
  final String? drop;
  final int? fare;
  final String? facilityName;
  final double? quantityQuintals;
  final String? fromDate;
  final int? months;

  const Booking({
    required this.id,
    required this.kind,
    required this.status,
    required this.date,
    this.slotName,
    this.priceRupees,
    this.vetName,
    this.visitType,
    this.slot,
    this.animalType,
    this.vehicleType,
    this.pickup,
    this.drop,
    this.fare,
    this.facilityName,
    this.quantityQuintals,
    this.fromDate,
    this.months,
  });

  factory Booking.fromJson(Map<String, dynamic> json) => Booking(
        id: json['id'] as String? ?? '',
        kind: json['kind'] as String? ?? '',
        status: json['status'] as String? ?? '',
        date: json['date'] as String? ?? '',
        slotName: json['slotName'] as String?,
        priceRupees: (json['priceRupees'] as num?)?.toInt(),
        vetName: json['vetName'] as String?,
        visitType: json['visitType'] as String?,
        slot: json['slot'] as String?,
        animalType: json['animalType'] as String?,
        vehicleType: json['vehicleType'] as String?,
        pickup: json['pickup'] as String?,
        drop: json['drop'] as String?,
        fare: (json['fare'] as num?)?.toInt(),
        facilityName: json['facilityName'] as String?,
        quantityQuintals: (json['quantityQuintals'] as num?)?.toDouble(),
        fromDate: json['fromDate'] as String?,
        months: (json['months'] as num?)?.toInt(),
      );
}

class MyBookings {
  final List<Booking> equipment;
  final List<Booking> vet;
  final List<Booking> transport;
  final List<Booking> coldStorage;

  const MyBookings({
    this.equipment = const [],
    this.vet = const [],
    this.transport = const [],
    this.coldStorage = const [],
  });

  bool get isEmpty =>
      equipment.isEmpty &&
      vet.isEmpty &&
      transport.isEmpty &&
      coldStorage.isEmpty;

  factory MyBookings.fromJson(Map<String, dynamic> json) {
    List<Booking> parse(String key) =>
        ((json[key] as List?) ?? const <dynamic>[])
            .map((e) => Booking.fromJson((e as Map).cast<String, dynamic>()))
            .toList();
    return MyBookings(
      equipment: parse('equipment'),
      vet: parse('vet'),
      transport: parse('transport'),
      coldStorage: parse('coldStorage'),
    );
  }
}
