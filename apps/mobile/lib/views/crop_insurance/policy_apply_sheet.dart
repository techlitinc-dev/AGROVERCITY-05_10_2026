// Quick-apply sheet: crop dropdown (from premium rates), season chips,
// acreage field → POST /v1/insurance/policies/apply (Day 11 B1.3).

import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../api/insurance_api.dart';
import '../../models/insurance_models.dart';

class PolicyApplySheet extends StatefulWidget {
  final List<CropPremiumRate> rates;
  final InsuranceApi api;
  final Future<void> Function(CropInsurancePolicy policy) onApplied;

  const PolicyApplySheet({
    super.key,
    required this.rates,
    required this.api,
    required this.onApplied,
  });

  @override
  State<PolicyApplySheet> createState() => _PolicyApplySheetState();
}

class _PolicyApplySheetState extends State<PolicyApplySheet> {
  String? _crop;
  String _season = 'Kharif';
  final _acresCtrl = TextEditingController(text: '2.0');
  bool _submitting = false;
  String? _error;

  static const _seasons = {'Kharif': 'खरीफ', 'Rabi': 'रबी', 'Annual': 'वार्षिक'};

  List<String> get _crops =>
      widget.rates.map((r) => r.cropName).toSet().toList();

  @override
  void initState() {
    super.initState();
    final crops = _crops;
    _crop = crops.isNotEmpty ? crops.first : null;
    if (widget.rates.isNotEmpty) _season = widget.rates.first.season;
  }

  @override
  void dispose() {
    _acresCtrl.dispose();
    super.dispose();
  }

  bool get _valid =>
      _crop != null && (double.tryParse(_acresCtrl.text.trim()) ?? 0) > 0;

  Future<void> _submit() async {
    if (!_valid || _submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final policy = await widget.api.applyPolicy(
        cropName: _crop!,
        season: _season,
        landAreaAcres: double.parse(_acresCtrl.text.trim()),
      );
      if (!mounted) return;
      Navigator.pop(context);
      await widget.onApplied(policy);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.code == 'RATE_NOT_FOUND'
            ? 'इस फसल/सीज़न की दर उपलब्ध नहीं'
            : (e.message.isNotEmpty ? e.message : e.code);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'आवेदन विफल — पुनः प्रयास करें';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final crops = _crops;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        22, 22, 22, 22 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'नई फसल बीमा पॉलिसी आवेदन',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 14),
          Row(
            children: _seasons.entries.map((e) {
              final selected = _season == e.key;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(e.value),
                    selected: selected,
                    onSelected: (_) => setState(() => _season = e.key),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _crop,
            decoration: InputDecoration(
              labelText: 'फसल चुनें',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            items: crops
                .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                .toList(),
            onChanged: (v) => setState(() => _crop = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _acresCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'जमीन रकबा (एकड़)',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: const Row(
              children: [
                Icon(Icons.shield_outlined, size: 14, color: Color(0xFF047857)),
                SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'आवेदन बीमा प्रदाता को समीक्षा व स्वीकृति हेतु भेजा जाएगा।',
                    style: TextStyle(fontSize: 10.5, color: Color(0xFF166534), fontWeight: FontWeight.w600),
                  ),
                ),
              ],
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
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _valid && !_submitting ? _submit : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF047857),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 46),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Text(
              _submitting ? 'आवेदन जमा हो रहा...' : 'आवेदन जमा करें',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}
