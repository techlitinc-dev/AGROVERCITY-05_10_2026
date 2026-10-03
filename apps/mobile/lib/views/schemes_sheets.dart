// Scheme apply (vault doc picker) and official-portal security banner sheets
// (portal modal ported verbatim from flutter-prototype schemes_view).

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/vault_api.dart';
import '../models/govt_scheme.dart';
import '../models/vault_document.dart';
import '../state/app_state.dart';

// Returns the selected vault document ids, or null when cancelled.
Future<List<String>?> showSchemeApplySheet(
  BuildContext context,
  VaultApi vaultApi,
  GovtScheme scheme, {
  required AppState state,
}) {
  return showModalBottomSheet<List<String>>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) =>
        SchemeApplySheet(vaultApi: vaultApi, scheme: scheme, state: state),
  );
}

class SchemeApplySheet extends StatefulWidget {
  final VaultApi vaultApi;
  final GovtScheme scheme;
  final AppState state;
  const SchemeApplySheet(
      {super.key,
      required this.vaultApi,
      required this.scheme,
      required this.state});

  @override
  State<SchemeApplySheet> createState() => _SchemeApplySheetState();
}

class _SchemeApplySheetState extends State<SchemeApplySheet> {
  List<VaultDocument> _docs = const [];
  final Set<String> _selected = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    widget.vaultApi.listDocuments().then((docs) {
      if (mounted) {
        setState(() {
          _docs = docs;
          _loading = false;
        });
      }
    }).catchError((_) {
      if (mounted) setState(() => _loading = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(22),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${widget.scheme.name} — ${widget.state.tr('schemes.selectDocuments')}',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            '${widget.state.tr('schemes.requiredDocs')}: ${widget.scheme.documentsRequired.join(', ')}',
            style: const TextStyle(fontSize: 11.5, color: Colors.grey),
          ),
          const SizedBox(height: 10),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: CircularProgressIndicator(color: Color(0xFF43A047)),
              ),
            )
          else if (_docs.isEmpty)
            Text(
              widget.state.tr('schemes.vaultEmptyApply'),
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            )
          else
            ..._docs.map(
              (d) => CheckboxListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                value: _selected.contains(d.id),
                title: Text(
                    VaultDocument.docTypeLabelFor(
                        d.docType, widget.state.language),
                    style: const TextStyle(fontSize: 13)),
                subtitle: Text(d.fileName,
                    style: const TextStyle(fontSize: 11, color: Colors.grey)),
                onChanged: (v) => setState(() {
                  if (v == true) {
                    _selected.add(d.id);
                  } else {
                    _selected.remove(d.id);
                  }
                }),
              ),
            ),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(_selected.toList()),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF43A047),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 44),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Text(
              widget.state.tr('schemes.submitApplication'),
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

void showSchemePortalSheet(
  BuildContext context,
  GovtScheme scheme,
  String portalUrl, {
  required AppState state,
}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => Container(
      height: MediaQuery.of(context).size.height * 0.75,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFE8F5E9),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFA5D6A7)),
            ),
            child: Row(
              children: [
                const Icon(Icons.security_rounded,
                    color: Color(0xFF2E7D32), size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    state.tr('schemes.portalSecurityBanner'),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1B5E20),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  scheme.name,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF263238),
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(ctx),
              ),
            ],
          ),
          Text(
            '${state.tr('schemes.redirectingTo')}: $portalUrl',
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF0284C7)),
          ),
          const SizedBox(height: 14),
          Expanded(
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.public_rounded,
                      size: 48, color: Color(0xFF43A047)),
                  const SizedBox(height: 12),
                  Text(
                    '${state.tr('schemes.officialPortal')}: ${scheme.name}',
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    state.tr('schemes.farmerLoginOtp'),
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton.icon(
                    onPressed: () async {
                      Navigator.pop(ctx);
                      try {
                        await launchUrl(
                          Uri.parse(portalUrl),
                          mode: LaunchMode.externalApplication,
                        );
                      } catch (_) {}
                    },
                    icon: const Icon(Icons.open_in_browser_rounded, size: 16),
                    label: Text(
                      state.tr('schemes.openExternalBrowser'),
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF43A047),
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            state.tr('schemes.fallbackNote'),
            style: const TextStyle(
              fontSize: 11,
              fontStyle: FontStyle.italic,
              color: Colors.grey,
            ),
          ),
        ],
      ),
    ),
  );
}
