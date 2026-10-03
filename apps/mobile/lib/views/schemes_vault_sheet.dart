// Document vault bottom sheet (ported from flutter-prototype schemes_view,
// wired to /v1/vault/documents).

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../api/vault_api.dart';
import '../models/vault_document.dart';
import '../state/app_state.dart';

void showVaultSheet(BuildContext context, VaultApi vaultApi,
    {required AppState state}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => VaultSheet(vaultApi: vaultApi, state: state),
  );
}

class VaultSheet extends StatefulWidget {
  final VaultApi vaultApi;
  final AppState state;
  const VaultSheet(
      {super.key, required this.vaultApi, required this.state});

  @override
  State<VaultSheet> createState() => _VaultSheetState();
}

class _VaultSheetState extends State<VaultSheet> {
  List<VaultDocument> _docs = const [];
  bool _loading = true;
  bool _uploading = false;
  String _uploadDocType = 'aadhaar';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final docs = await widget.vaultApi.listDocuments();
      if (!mounted) return;
      setState(() {
        _docs = docs;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _docs = const [];
        _loading = false;
      });
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _pickAndUpload() async {
    final result = await FilePicker.platform.pickFiles(
      withData: true,
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf'],
    );
    final file = result?.files.firstOrNull;
    if (file == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      await widget.vaultApi.uploadDocument(_uploadDocType, file);
      _snack(widget.state.tr('schemes.docUploaded'));
      await _load();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty
          ? e.message
          : widget.state
              .tr('schemes.uploadFailedCode')
              .replaceAll('{code}', e.code));
    } catch (_) {
      _snack(widget.state.tr('schemes.uploadFailed'));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _confirmDelete(VaultDocument doc) async {
    final docLabel =
        VaultDocument.docTypeLabelFor(doc.docType, widget.state.language);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dctx) => AlertDialog(
        title: Text(widget.state.tr('schemes.deleteDocConfirm')),
        content: Text(widget.state
            .tr('schemes.docWillBeDeleted')
            .replaceAll('{doc}', '$docLabel (${doc.fileName})')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dctx, false),
            child: Text(widget.state.tr('cancel')),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(dctx, true),
            child: Text(widget.state.tr('schemes.delete')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await widget.vaultApi.deleteDocument(doc.id);
      _snack(widget.state.tr('schemes.docDeleted'));
      await _load();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty
          ? e.message
          : widget.state.tr('schemes.deleteFailed'));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        22, 22, 22, 22 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.lock_rounded, color: Color(0xFF2E7D32), size: 20),
              const SizedBox(width: 8),
              Text(
                widget.state.tr('schemes.vaultTitle'),
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Center(
                child: CircularProgressIndicator(color: Color(0xFF43A047)),
              ),
            )
          else ...[
            if (_docs.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  widget.state.tr('schemes.vaultEmpty'),
                  style: const TextStyle(fontSize: 12.5, color: Colors.grey),
                ),
              )
            else
              ..._docs.map((d) => _docRow(d)),
            const Divider(),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _uploadDocType,
                    isDense: true,
                    decoration: InputDecoration(
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 8),
                    ),
                    items: VaultDocument.docTypeLabels.entries
                        .map((e) => DropdownMenuItem(
                            value: e.key,
                            child: Text(VaultDocument.docTypeLabelFor(
                                e.key, widget.state.language))))
                        .toList(),
                    onChanged: (v) =>
                        setState(() => _uploadDocType = v ?? 'aadhaar'),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: _uploading ? null : _pickAndUpload,
                  icon: const Icon(Icons.upload_rounded, size: 16),
                  label: Text(_uploading
                      ? widget.state.tr('schemes.uploading')
                      : widget.state.tr('schemes.upload')),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF43A047),
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _docRow(VaultDocument d) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  VaultDocument.docTypeLabelFor(
                      d.docType, widget.state.language),
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 13),
                ),
                Text(
                  d.fileName,
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
          ),
          const Icon(Icons.verified_rounded,
              color: Color(0xFF16A34A), size: 16),
          const SizedBox(width: 4),
          Text(
            widget.state.tr('schemes.encrypted'),
            style: const TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: Color(0xFF16A34A),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded,
                size: 18, color: Color(0xFFDC2626)),
            onPressed: () => _confirmDelete(d),
          ),
        ],
      ),
    );
  }
}
