import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';

import '../models/vault_document.dart';
import 'api_client.dart';
import 'endpoints.dart';

class VaultApi {
  VaultApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<VaultDocument>> listDocuments() async {
    final res = await _client.get(pathVaultDocuments);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => VaultDocument.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<VaultDocument> uploadDocument(
    String docType,
    PlatformFile file,
  ) async {
    final MultipartFile multipart;
    if (file.bytes != null) {
      multipart = MultipartFile.fromBytes(file.bytes!, filename: file.name);
    } else {
      multipart = await MultipartFile.fromFile(file.path!, filename: file.name);
    }
    final res = await _client.postMultipart(
      pathVaultDocuments,
      FormData.fromMap({'docType': docType, 'file': multipart}),
    );
    return VaultDocument.fromJson(res);
  }

  Future<void> deleteDocument(String id) =>
      _client.delete(vaultDocumentPath(id));
}
