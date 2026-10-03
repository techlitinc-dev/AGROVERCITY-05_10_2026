import '../data/translations.dart';

class VaultDocument {
  final String id;
  final String docType; // aadhaar | 712 | bankPassbook | soilHealthCard | other
  final String fileName;
  final String downloadUrl;
  final String uploadedAt;
  final int sizeBytes;

  const VaultDocument({
    required this.id,
    required this.docType,
    required this.fileName,
    required this.downloadUrl,
    required this.uploadedAt,
    required this.sizeBytes,
  });

  factory VaultDocument.fromJson(Map<String, dynamic> json) => VaultDocument(
        id: json['id'] as String? ?? '',
        docType: json['docType'] as String? ?? 'other',
        fileName: json['fileName'] as String? ?? '',
        downloadUrl: json['downloadUrl'] as String? ?? '',
        uploadedAt: json['uploadedAt'] as String? ?? '',
        sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
      );

  static const Map<String, String> docTypeLabels = {
    'aadhaar': 'आधार कार्ड',
    '712': 'भूलेख 7/12 खतौनी',
    'bankPassbook': 'बैंक पासबुक',
    'soilHealthCard': 'मृदा स्वास्थ्य कार्ड',
    'other': 'अन्य दस्तावेज़',
  };

  /// Localized display label for [type] in [lang]; unknown types fall back
  /// to the 'other' label. The static docTypeLabels map above is kept as the
  /// Hindi source/compatibility fallback.
  static String docTypeLabelFor(String type, String lang) {
    if (!docTypeLabels.containsKey(type)) return docTypeLabels['other']!;
    return AppTranslations.get('schemes.doc.$type', lang);
  }

  String get docTypeLabel => docTypeLabels[docType] ?? docTypeLabels['other']!;
}
