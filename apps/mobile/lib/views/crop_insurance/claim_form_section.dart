// Tab 2: 72-hour claim intimation form — photo capture via image_picker,
// client-side validation, multipart submit (Day 11 B1.4/4b/6b).

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../api/api_exception.dart';
import '../../api/insurance_api.dart';
import '../../components/common/glass_card.dart';
import '../../models/insurance_models.dart';
import '../../state/app_state.dart';
import 'claim_form_widgets.dart';
import 'insurance_header.dart';

class ClaimFormSection extends StatefulWidget {
  final List<CropInsurancePolicy> policies;
  final InsuranceApi api;
  final AppState appState;
  final Future<XFile?> Function()? photoPicker;
  final String? initialPolicyId;
  final Future<void> Function(String claimNumber, List<String> photoGuidelines)
      onSubmitted;

  const ClaimFormSection({
    super.key,
    required this.policies,
    required this.api,
    required this.appState,
    this.photoPicker,
    this.initialPolicyId,
    required this.onSubmitted,
  });

  @override
  State<ClaimFormSection> createState() => _ClaimFormSectionState();
}

class _ClaimFormSectionState extends State<ClaimFormSection> {
  String? _policyId;
  String? _calamity;
  String _cropStage = kCropStages[2];
  double _damagePercent = 65;
  DateTime _damageDate = DateTime.now();
  final List<XFile> _photos = [];
  bool _submitting = false;
  bool _showErrors = false;

  @override
  void initState() {
    super.initState();
    final ids = widget.policies.map((p) => p.id);
    _policyId = ids.contains(widget.initialPolicyId)
        ? widget.initialPolicyId
        : (widget.policies.isNotEmpty ? widget.policies.first.id : null);
  }

  bool get _valid =>
      _policyId != null &&
      _calamity != null &&
      !_damageDate.isAfter(DateTime.now()) &&
      _photos.isNotEmpty;

  void _snack(String message) {
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _addPhoto() async {
    if (_photos.length >= 5) {
      _snack('अधिकतम 5 फोटो जोड़ सकते हैं');
      return;
    }
    final picker = widget.photoPicker ??
        () => ImagePicker().pickImage(
              // Camera capture isn't available on web — use the file picker.
              source: kIsWeb ? ImageSource.gallery : ImageSource.camera,
              maxWidth: 1600,
              imageQuality: 80,
            );
    try {
      final photo = await picker();
      if (photo != null && mounted) {
        setState(() => _photos.add(photo));
      }
    } catch (_) {
      _snack('फोटो नहीं ली जा सकी');
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _damageDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null && mounted) setState(() => _damageDate = picked);
  }

  Future<void> _submit() async {
    final pol = widget.policies.firstWhere((p) => p.id == _policyId);
    setState(() => _submitting = true);
    final fields = <String, String>{
      'policyId': pol.id,
      'cropName': pol.cropName,
      'calamityType': _calamity!,
      'dateOfDamage':
          '${_damageDate.year}-${_damageDate.month.toString().padLeft(2, '0')}-${_damageDate.day.toString().padLeft(2, '0')}',
      'cropStage': _cropStage,
      'estimatedLossPercent': '${_damagePercent.toInt()}',
      'gpsCoordinates': '19.8762, 75.3433',
      'village':
          '${widget.appState.profile.village}, ${widget.appState.profile.district}',
    };
    try {
      final res = await widget.api.submitClaim(fields, _photos);
      if (!mounted) return;
      if (res['queued'] == true) {
        _snack('ऑफ़लाइन — सिंक हो जाएगा');
        return;
      }
      final guidelines = ((res['photoGuidelines'] as List?) ?? const <dynamic>[])
          .map((e) => '$e')
          .toList();
      await widget.onSubmitted(res['claimNumber'] as String? ?? '', guidelines);
    } on ApiException catch (e) {
      if (!mounted) return;
      _snack(switch (e.code) {
        'FILE_TOO_LARGE' || 'UNSUPPORTED_FILE_TYPE' => 'फोटो बहुत बड़ी/अमान्य है',
        'POLICY_NOT_FOUND' => 'पॉलिसी नहीं मिली',
        'NETWORK_ERROR' => 'नेटवर्क नहीं है — बाद में भेजा जाएगा',
        _ => e.message.isNotEmpty ? e.message : e.code,
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final policies = widget.policies;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const ClaimUrgentCard(),
        const SizedBox(height: 16),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("1. प्रभावित बीमित फसल चुनें (Select Insured Crop)", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _policyId,
                    isExpanded: true,
                    items: policies.map((p) {
                      return DropdownMenuItem(
                        value: p.id,
                        child: Text(
                          "${p.cropName} • ${p.policyNumber}",
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                        ),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _policyId = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text("2. आपदा / नुकसान का कारण चुनें (Calamity Type)", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
              const SizedBox(height: 8),
              CalamityGrid(
                selected: _calamity,
                onSelect: (name) => setState(() => _calamity = name),
              ),
              const SizedBox(height: 16),
              ClaimDateStageRow(
                damageDate: _damageDate,
                cropStage: _cropStage,
                onPickDate: _pickDate,
                onStageChanged: (v) => setState(() => _cropStage = v),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("अनुमानित फसल क्षति (Estimated Loss)", style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: _damagePercent > 70
                          ? const Color(0xFFDC2626)
                          : _damagePercent > 30
                              ? const Color(0xFFD97706)
                              : const Color(0xFF047857),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      "${_damagePercent.toInt()}% क्षति",
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12),
                    ),
                  ),
                ],
              ),
              Slider(
                min: 10,
                max: 100,
                divisions: 18,
                value: _damagePercent,
                activeColor: _damagePercent > 70 ? const Color(0xFFDC2626) : const Color(0xFF047857),
                onChanged: (v) => setState(() => _damagePercent = v),
              ),
              const SizedBox(height: 10),
              ClaimPhotoPicker(
                photos: _photos,
                onAdd: _addPhoto,
                onRemove: (i) => setState(() => _photos.removeAt(i)),
              ),
              if (_showErrors && !_valid) ...[
                const SizedBox(height: 8),
                const Text(
                  'सभी फ़ील्ड भरें और कम से कम 1 फोटो जोड़ें',
                  style: TextStyle(color: Color(0xFFDC2626), fontSize: 11.5, fontWeight: FontWeight.w700),
                ),
              ],
              const SizedBox(height: 16),
              GestureDetector(
                onTap: () {
                  if (!_valid) setState(() => _showErrors = true);
                },
                child: ElevatedButton.icon(
                  onPressed: _valid && !_submitting ? _submit : null,
                  icon: const Icon(Icons.send_rounded, size: 16),
                  label: Text(
                    _submitting ? 'दावा जमा हो रहा...' : 'दावा सूचना दर्ज करें (Submit Claim Intimation)',
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFDC2626),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 46),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 2,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
