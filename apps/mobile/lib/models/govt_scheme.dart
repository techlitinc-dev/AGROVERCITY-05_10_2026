class GovtScheme {
  final String id;
  final String name;
  final String category;
  final bool eligible;
  final String benefitAmount;
  final List<String> documentsRequired;
  final String status;
  final String nextDeadline;
  final String description;

  const GovtScheme({
    required this.id,
    required this.name,
    required this.category,
    required this.eligible,
    required this.benefitAmount,
    required this.documentsRequired,
    required this.status,
    required this.nextDeadline,
    required this.description,
  });

  factory GovtScheme.fromJson(Map<String, dynamic> json) => GovtScheme(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        category: json['category'] as String? ?? '',
        eligible: json['eligible'] as bool? ?? false,
        benefitAmount: json['benefitAmount'] as String? ?? '',
        documentsRequired:
            (json['documentsRequired'] as List?)?.cast<String>() ??
                const <String>[],
        status: json['status'] as String? ?? '',
        nextDeadline: json['nextDeadline'] as String? ?? '',
        description: json['description'] as String? ?? '',
      );
}

class PortalEntry {
  final String schemeId;
  final String portalUrl;

  const PortalEntry({required this.schemeId, required this.portalUrl});

  factory PortalEntry.fromJson(Map<String, dynamic> json) => PortalEntry(
        schemeId: json['schemeId'] as String? ?? '',
        portalUrl: json['portalUrl'] as String? ?? '',
      );
}
