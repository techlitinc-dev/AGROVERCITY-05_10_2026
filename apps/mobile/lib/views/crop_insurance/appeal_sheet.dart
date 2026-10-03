// Rejected-claim appeal sheet (Day 11 B5.2/3): prefilled claim summary,
// required appeal reason (min 10 chars), optional extra photos uploaded via
// PhotoUploader first so the API receives URLs.

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/insurance_api.dart';
import '../../core/photo_upload.dart';
import '../../models/insurance_models.dart';

class AppealSheet extends StatefulWidget {
  final InsuranceClaimRecord claim;
  final InsuranceApi api;
  final PhotoUploader? photoUploader;
  final Future<void> Function() onAppealed;

  const AppealSheet({
    super.key,
    required this.claim,
    required this.api,
    this.photoUploader,
    required this.onAppealed,
  });

  @override
  State<AppealSheet> createState() => _AppealSheetState();
}

class _AppealSheetState extends State<AppealSheet> {
  late final PhotoUploader _uploader =
      widget.photoUploader ?? const PhotoUploader();
  final _reasonCtrl = TextEditingController();
  final List<String> _photoUrls = [];
  bool _submitting = false;
  bool _showErrors = false;
  String? _error;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  bool get _reasonValid => _reasonCtrl.text.trim().length >= 10;

  void _snack(String message) {
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _addPhoto() async {
    if (widget.claim.damagePhotos.length + _photoUrls.length >= 5) {
      _snack('अधिकतम 5 फोटो हो सकती हैं');
      return;
    }
    try {
      final url = await _uploader.pickAndUpload(
        'claims/appeal_${DateTime.now().millisecondsSinceEpoch}_${_photoUrls.length}.jpg',
      );
      if (url != null && mounted) setState(() => _photoUrls.add(url));
    } catch (_) {
      _snack('फोटो अपलोड नहीं हुई — पुनः प्रयास करें');
    }
  }

  Future<void> _submit() async {
    if (!_reasonValid || _submitting) {
      setState(() => _showErrors = true);
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.api.appealClaim(
        widget.claim.id,
        _reasonCtrl.text.trim(),
        _photoUrls,
      );
      if (!mounted) return;
      final messenger = ScaffoldMessenger.maybeOf(context);
      Navigator.pop(context);
      messenger?.showSnackBar(
        const SnackBar(content: Text('अपील दर्ज हुई — दावा फिर से सुना जाएगा')),
      );
      await widget.onAppealed();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.code == 'CLAIM_NOT_REJECTED'
            ? 'दावा अस्वीकृत स्थिति में नहीं है'
            : (e.message.isNotEmpty ? e.message : e.code);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'अपील विफल — पुनः प्रयास करें';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final clm = widget.claim;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        22, 22, 22, 22 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'अपील करें / पुनः जमा करें',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${clm.claimNumber} • ${clm.cropName}',
                      style: const TextStyle(
                          fontSize: 12.5, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(
                    '${clm.calamityType} • ${clm.dateOfDamage} • ${clm.estimatedLossPercent.toInt()}% क्षति',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${clm.damagePhotos.length} फोटो पहले से संलग्न',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const Text('अपील का कारण',
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            TextField(
              controller: _reasonCtrl,
              maxLines: 4,
              maxLength: 1000,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'सर्वेक्षक निरीक्षण में क्या गलत रहा, नया साक्ष्य लिखें...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            if (_showErrors && !_reasonValid)
              const Text(
                'कम से कम 10 अक्षर लिखें',
                style: TextStyle(
                  color: Color(0xFFDC2626),
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            const SizedBox(height: 6),
            OutlinedButton.icon(
              onPressed: _addPhoto,
              icon: const Icon(Icons.add_a_photo_rounded, size: 16),
              label: Text(
                'नई फोटो जोड़ें (${_photoUrls.length} जुड़ी)',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF047857),
                side: const BorderSide(color: Color(0xFF047857)),
                minimumSize: const Size(double.infinity, 40),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: const TextStyle(
                  color: Color(0xFFDC2626),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
            const SizedBox(height: 14),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 46),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                _submitting ? 'अपील जमा हो रही...' : 'अपील जमा करें',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
