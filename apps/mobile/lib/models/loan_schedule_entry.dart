// Loan repayment schedule entry — mirrors backend LoanScheduleEntry.

class LoanScheduleEntry {
  final int installmentNo;
  final String dueDate;
  final int emi;
  final int principal;
  final int interest;
  final int outstanding;

  const LoanScheduleEntry({
    required this.installmentNo,
    required this.dueDate,
    required this.emi,
    required this.principal,
    required this.interest,
    required this.outstanding,
  });

  factory LoanScheduleEntry.fromJson(Map<String, dynamic> json) =>
      LoanScheduleEntry(
        installmentNo: (json['installmentNo'] as num?)?.toInt() ?? 0,
        dueDate: json['dueDate'] as String? ?? '',
        emi: (json['emi'] as num?)?.toInt() ?? 0,
        principal: (json['principal'] as num?)?.toInt() ?? 0,
        interest: (json['interest'] as num?)?.toInt() ?? 0,
        outstanding: (json['outstanding'] as num?)?.toInt() ?? 0,
      );
}
