// Leaf disease scan tab — POST /advisory/disease-scan (multipart image upload).

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../api/advisory_api.dart';
import '../../../models/advisory_models.dart';
import '../../../state/app_state.dart';
import '../../../components/common/glass_card.dart';
import 'advisory_shared.dart';

typedef LeafImagePicker = Future<({String filename, List<int> bytes, String? contentType})?>
    Function();

Future<({String filename, List<int> bytes, String? contentType})?> defaultLeafImagePicker() async {
  final file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 80);
  if (file == null) return null;
  final bytes = await file.readAsBytes();
  final mime = file.mimeType;
  return (filename: file.name, bytes: bytes, contentType: mime);
}

class DiseaseScanTab extends StatefulWidget {
  const DiseaseScanTab({
    super.key,
    required this.state,
    required this.api,
    this.pickImage = defaultLeafImagePicker,
  });

  final AppState state;
  final AdvisoryApi api;
  final LeafImagePicker pickImage;

  @override
  State<DiseaseScanTab> createState() => _DiseaseScanTabState();
}

class _DiseaseScanTabState extends State<DiseaseScanTab> {
  bool _uploading = false;
  bool _error = false;
  List<DiseaseScanResult> _results = const [];

  Future<void> _scan() async {
    final picked = await widget.pickImage();
    if (picked == null || !mounted) return;
    setState(() {
      _uploading = true;
      _error = false;
    });
    try {
      final results = await widget.api.scanDisease(
        imageBytes: picked.bytes,
        filename: picked.filename,
        contentType: picked.contentType,
      );
      if (!mounted) return;
      setState(() {
        _results = results;
        _uploading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _uploading = false;
        _error = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GlassCard(
          backgroundColor: Colors.white,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.state.tr('advisory.scanHint'),
                  style: const TextStyle(fontSize: 12.5, color: Color(0xFF455A64))),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _uploading ? null : _scan,
                  icon: _uploading
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.photo_camera_rounded, size: 16),
                  label: Text(
                      _uploading
                          ? widget.state.tr('advisory.scanning')
                          : widget.state.tr('advisory.scanLeaf'),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF43A047),
                      foregroundColor: Colors.white),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (_error)
          AdvisoryAsyncError(state: widget.state, onRetry: _scan)
        else if (_results.isEmpty && !_uploading)
          const SizedBox.shrink()
        else if (_uploading)
          const AdvisoryLoading()
        else
          for (final r in _results) ...[
            _buildResultCard(r),
            const SizedBox(height: 12),
          ],
      ],
    );
  }

  Widget _buildResultCard(DiseaseScanResult r) {
    return GlassCard(
      backgroundColor: Colors.white,
      border: Border.all(color: const Color(0xFF43A047), width: 1.5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(r.diseaseName,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                    color: const Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.circular(10)),
                child: Text(
                  widget.state
                      .tr('advisory.confidence')
                      .replaceAll('{percent}', '${(r.confidence * 100).round()}'),
                  style: const TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32)),
                ),
              ),
            ],
          ),
          if (r.crop.isNotEmpty)
            Text(r.crop,
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF90A4AE))),
          const SizedBox(height: 8),
          _line(widget.state.tr('advisory.symptoms'), r.symptoms),
          _line(widget.state.tr('advisory.chemicalTreatment'), r.chemicalTreatment),
          _line(widget.state.tr('advisory.organicTreatment'), r.organicTreatment),
          _line(widget.state.tr('advisory.dosage'), r.dosage),
          Text(
            widget.state
                .tr('advisory.estimatedCost')
                .replaceAll('{cost}', '${r.estimatedCost}'),
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }

  Widget _line(String label, String value) {
    if (value.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text('$label: $value',
          style: const TextStyle(fontSize: 12, height: 1.35, color: Colors.black87)),
    );
  }
}
