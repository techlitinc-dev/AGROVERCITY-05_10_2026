// Loan application models — mirrors backend LoanApplicationOut (camelCase).

class LoanStatus {
  static const submitted = 'submitted';
  static const underReview = 'underReview';
  static const infoRequested = 'infoRequested';
  static const approved = 'approved';
  static const rejected = 'rejected';
  static const disbursed = 'disbursed';
  static const cancelled = 'cancelled';

  static const all = [
    submitted,
    underReview,
    infoRequested,
    approved,
    rejected,
    disbursed,
    cancelled,
  ];
}

class LoanTimelineEntry {
  final String status;
  final String statusText;
  final String? note;
  final String at;
  final String? by;

  const LoanTimelineEntry({
    required this.status,
    required this.statusText,
    this.note,
    required this.at,
    this.by,
  });

  factory LoanTimelineEntry.fromJson(Map<String, dynamic> json) =>
      LoanTimelineEntry(
        status: json['status'] as String? ?? '',
        statusText: json['statusText'] as String? ?? '',
        note: json['note'] as String?,
        at: json['at'] as String? ?? '',
        by: json['by'] as String?,
      );
}

class LoanDocument {
  final String documentId;
  final String name;
  final String storagePath;
  final String uploadedAt;

  const LoanDocument({
    required this.documentId,
    required this.name,
    required this.storagePath,
    required this.uploadedAt,
  });

  factory LoanDocument.fromJson(Map<String, dynamic> json) => LoanDocument(
        documentId: json['documentId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        storagePath: json['storagePath'] as String? ?? '',
        uploadedAt: json['uploadedAt'] as String? ?? '',
      );
}

class LoanApplication {
  final String applicationId;
  final String? applicationNumber;
  final String? userId;
  final double amount;
  final int tenureMonths;
  final String purpose;
  final String status;
  final String createdAt;
  final String? farmerName;
  final String? farmerPhone;
  final int? farmerCreditScore;
  final String? farmerCreditTier;
  final String? bankAccountId;
  final String? bankAccountLast4;
  final String? bankIfsc;
  final int? sanctionedAmount;
  final double? interestRate;
  final String? disbursementRef;
  final String? disbursedAt;
  final String? rejectionReason;
  final String? assignedOfficerId;
  final String? assignedOfficerName;
  final List<LoanDocument> documents;
  final List<LoanTimelineEntry> timeline;
  final String? note;
  final String? updatedAt;

  const LoanApplication({
    required this.applicationId,
    this.applicationNumber,
    this.userId,
    required this.amount,
    required this.tenureMonths,
    required this.purpose,
    required this.status,
    required this.createdAt,
    this.farmerName,
    this.farmerPhone,
    this.farmerCreditScore,
    this.farmerCreditTier,
    this.bankAccountId,
    this.bankAccountLast4,
    this.bankIfsc,
    this.sanctionedAmount,
    this.interestRate,
    this.disbursementRef,
    this.disbursedAt,
    this.rejectionReason,
    this.assignedOfficerId,
    this.assignedOfficerName,
    this.documents = const [],
    this.timeline = const [],
    this.note,
    this.updatedAt,
  });

  factory LoanApplication.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic>? asMap(dynamic v) =>
        v is Map ? v.cast<String, dynamic>() : null;
    return LoanApplication(
      applicationId: json['applicationId'] as String? ?? '',
      applicationNumber: json['applicationNumber'] as String?,
      userId: json['userId'] as String?,
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      tenureMonths: (json['tenureMonths'] as num?)?.toInt() ?? 0,
      purpose: json['purpose'] as String? ?? '',
      status: json['status'] as String? ?? LoanStatus.submitted,
      createdAt: json['createdAt'] as String? ?? '',
      farmerName: json['farmerName'] as String?,
      farmerPhone: json['farmerPhone'] as String?,
      farmerCreditScore: (json['farmerCreditScore'] as num?)?.toInt(),
      farmerCreditTier: json['farmerCreditTier'] as String?,
      bankAccountId: json['bankAccountId'] as String?,
      bankAccountLast4: json['bankAccountLast4'] as String?,
      bankIfsc: json['bankIfsc'] as String?,
      sanctionedAmount: (json['sanctionedAmount'] as num?)?.toInt(),
      interestRate: (json['interestRate'] as num?)?.toDouble(),
      disbursementRef: json['disbursementRef'] as String?,
      disbursedAt: json['disbursedAt'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      assignedOfficerId: json['assignedOfficerId'] as String?,
      assignedOfficerName: json['assignedOfficerName'] as String?,
      documents: ((json['documents'] as List?) ?? const <dynamic>[])
          .map((e) => LoanDocument.fromJson(asMap(e) ?? const {}))
          .toList(),
      timeline: ((json['timeline'] as List?) ?? const <dynamic>[])
          .map((e) => LoanTimelineEntry.fromJson(asMap(e) ?? const {}))
          .toList(),
      note: json['note'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  /// Terminal statuses can no longer be acted upon by either side.
  bool get isTerminal =>
      status == LoanStatus.rejected ||
      status == LoanStatus.disbursed ||
      status == LoanStatus.cancelled;

  /// Farmer may reply to an information request.
  bool get canRespond => status == LoanStatus.infoRequested;

  /// Farmer may withdraw the application while it is still open.
  bool get canCancel =>
      status == LoanStatus.submitted || status == LoanStatus.infoRequested;

  /// Display name fallback: name → phone → em-dash.
  String get farmerDisplayName =>
      (farmerName != null && farmerName!.isNotEmpty)
          ? farmerName!
          : (farmerPhone != null && farmerPhone!.isNotEmpty)
              ? farmerPhone!
              : '—';
}
