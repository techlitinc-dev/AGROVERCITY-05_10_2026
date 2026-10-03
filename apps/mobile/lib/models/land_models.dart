class LandPlot {
  final String id;
  final String name;
  final String village;
  final String district;
  final double areaAcres;
  final String? gatNumber;
  final String? soilType;
  final String status; // 'vacant' | 'leased'

  const LandPlot({
    required this.id,
    required this.name,
    required this.village,
    required this.district,
    required this.areaAcres,
    this.gatNumber,
    this.soilType,
    required this.status,
  });

  factory LandPlot.fromJson(Map<String, dynamic> json) => LandPlot(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        village: json['village'] as String? ?? '',
        district: json['district'] as String? ?? '',
        areaAcres: (json['areaAcres'] as num?)?.toDouble() ?? 0,
        gatNumber: json['gatNumber'] as String?,
        soilType: json['soilType'] as String?,
        status: json['status'] as String? ?? 'vacant',
      );
}

class LandLease {
  final String id;
  final String plotId;
  final String tenantName;
  final String tenantPhone;
  final double monthlyRentRupees;
  final String startDate;
  final String endDate;
  final String status; // 'active' | 'ended'
  final bool verified;

  const LandLease({
    required this.id,
    required this.plotId,
    required this.tenantName,
    required this.tenantPhone,
    required this.monthlyRentRupees,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.verified,
  });

  factory LandLease.fromJson(Map<String, dynamic> json) => LandLease(
        id: json['id'] as String? ?? '',
        plotId: json['plotId'] as String? ?? '',
        tenantName: json['tenantName'] as String? ?? '',
        tenantPhone: json['tenantPhone'] as String? ?? '',
        monthlyRentRupees: (json['monthlyRentRupees'] as num?)?.toDouble() ?? 0,
        startDate: json['startDate'] as String? ?? '',
        endDate: json['endDate'] as String? ?? '',
        status: json['status'] as String? ?? 'active',
        verified: json['verified'] as bool? ?? false,
      );
}

class RentPayment {
  final String id;
  final String leaseId;
  final double amountRupees;
  final String month; // YYYY-MM
  final String method; // 'cash' | 'upi' | 'bank'
  final String paidAt;

  const RentPayment({
    required this.id,
    required this.leaseId,
    required this.amountRupees,
    required this.month,
    required this.method,
    required this.paidAt,
  });

  factory RentPayment.fromJson(Map<String, dynamic> json) => RentPayment(
        id: json['id'] as String? ?? '',
        leaseId: json['leaseId'] as String? ?? '',
        amountRupees: (json['amountRupees'] as num?)?.toDouble() ?? 0,
        month: json['month'] as String? ?? '',
        method: json['method'] as String? ?? 'cash',
        paidAt: json['paidAt'] as String? ?? '',
      );
}

class LeasePayments {
  final List<RentPayment> payments;
  final double totalCollectedRupees;
  final List<String> pendingMonths;

  const LeasePayments({
    required this.payments,
    required this.totalCollectedRupees,
    required this.pendingMonths,
  });

  factory LeasePayments.fromJson(Map<String, dynamic> json) => LeasePayments(
        payments: ((json['data'] as List?) ?? const <dynamic>[])
            .map((e) => RentPayment.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
        totalCollectedRupees:
            (json['totalCollectedRupees'] as num?)?.toDouble() ?? 0,
        pendingMonths:
            ((json['pendingMonths'] as List?) ?? const <dynamic>[])
                .map((e) => "$e")
                .toList(),
      );
}
