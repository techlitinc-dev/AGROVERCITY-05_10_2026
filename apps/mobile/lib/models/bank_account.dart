class BankAccount {
  final String id;
  final String accountHolder;
  final String accountNumberMasked;
  final String ifsc;
  final String bankName;
  final bool isPrimary;
  final String verifyStatus; // 'unverified' | 'pending' | 'verified' | 'failed'
  final String createdAt;

  const BankAccount({
    required this.id,
    required this.accountHolder,
    required this.accountNumberMasked,
    required this.ifsc,
    required this.bankName,
    required this.isPrimary,
    required this.verifyStatus,
    required this.createdAt,
  });

  factory BankAccount.fromJson(Map<String, dynamic> json) => BankAccount(
        id: json['id'] as String? ?? '',
        accountHolder: json['accountHolder'] as String? ?? '',
        accountNumberMasked: json['accountNumberMasked'] as String? ?? '',
        ifsc: json['ifsc'] as String? ?? '',
        bankName: json['bankName'] as String? ?? '',
        isPrimary: json['isPrimary'] as bool? ?? false,
        verifyStatus: json['verifyStatus'] as String? ?? 'unverified',
        createdAt: json['createdAt'] as String? ?? '',
      );
}
