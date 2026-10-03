class Settlement {
  final String id;
  final String role; // 'transport' | 'equipmentRental' | 'broker'
  final String entityId;
  final String periodStart;
  final String periodEnd;
  final int grossRupees;
  final int commissionRupees;
  final int netRupees;
  final String status; // 'pending' | 'approved' | 'paid'
  final String createdAt;

  const Settlement({
    required this.id,
    required this.role,
    required this.entityId,
    required this.periodStart,
    required this.periodEnd,
    required this.grossRupees,
    required this.commissionRupees,
    required this.netRupees,
    required this.status,
    required this.createdAt,
  });

  factory Settlement.fromJson(Map<String, dynamic> json) => Settlement(
        id: json['id'] as String? ?? '',
        role: json['role'] as String? ?? '',
        entityId: json['entityId'] as String? ?? '',
        periodStart: json['periodStart'] as String? ?? '',
        periodEnd: json['periodEnd'] as String? ?? '',
        grossRupees: (json['grossRupees'] as num?)?.toInt() ?? 0,
        commissionRupees: (json['commissionRupees'] as num?)?.toInt() ?? 0,
        netRupees: (json['netRupees'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'pending',
        createdAt: json['createdAt'] as String? ?? '',
      );
}
