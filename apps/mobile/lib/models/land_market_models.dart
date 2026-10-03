class LandListing {
  final String id;
  final String village;
  final String district;
  final double lat;
  final double lng;
  final double areaAcres;
  final double expectedRentRupees;
  final String? soilType;
  final String? waterSource;
  final String? plotId;
  final String landlordId;
  final String landlordName;
  final String status; // 'open' | 'leased' | 'closed'
  final String createdAt;

  const LandListing({
    required this.id,
    required this.village,
    required this.district,
    required this.lat,
    required this.lng,
    required this.areaAcres,
    required this.expectedRentRupees,
    this.soilType,
    this.waterSource,
    this.plotId,
    required this.landlordId,
    required this.landlordName,
    required this.status,
    required this.createdAt,
  });

  factory LandListing.fromJson(Map<String, dynamic> json) => LandListing(
        id: json['id'] as String? ?? '',
        village: json['village'] as String? ?? '',
        district: json['district'] as String? ?? '',
        lat: (json['lat'] as num?)?.toDouble() ?? 0,
        lng: (json['lng'] as num?)?.toDouble() ?? 0,
        areaAcres: (json['areaAcres'] as num?)?.toDouble() ?? 0,
        expectedRentRupees: (json['expectedRentRupees'] as num?)?.toDouble() ?? 0,
        soilType: json['soilType'] as String?,
        waterSource: json['waterSource'] as String?,
        plotId: json['plotId'] as String?,
        landlordId: json['landlordId'] as String? ?? '',
        landlordName: json['landlordName'] as String? ?? '',
        status: json['status'] as String? ?? 'open',
        createdAt: json['createdAt'] as String? ?? '',
      );
}

class LeaseRequest {
  final String id;
  final String listingId;
  final String message;
  final int durationMonths;
  final String farmerId;
  final String farmerName;
  final String farmerPhone;
  final String landlordId;
  final String status; // 'pending' | 'accepted' | 'rejected'
  final String createdAt;

  const LeaseRequest({
    required this.id,
    required this.listingId,
    required this.message,
    required this.durationMonths,
    required this.farmerId,
    required this.farmerName,
    required this.farmerPhone,
    required this.landlordId,
    required this.status,
    required this.createdAt,
  });

  factory LeaseRequest.fromJson(Map<String, dynamic> json) => LeaseRequest(
        id: json['id'] as String? ?? '',
        listingId: json['listingId'] as String? ?? '',
        message: json['message'] as String? ?? '',
        durationMonths: (json['durationMonths'] as num?)?.toInt() ?? 12,
        farmerId: json['farmerId'] as String? ?? '',
        farmerName: json['farmerName'] as String? ?? '',
        farmerPhone: json['farmerPhone'] as String? ?? '',
        landlordId: json['landlordId'] as String? ?? '',
        status: json['status'] as String? ?? 'pending',
        createdAt: json['createdAt'] as String? ?? '',
      );
}
