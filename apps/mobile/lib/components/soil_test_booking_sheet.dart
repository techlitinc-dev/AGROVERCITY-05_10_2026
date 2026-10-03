// Soil-test booking bottom sheet (F9) — shared by Schemes (Soil Health Card)
// and, later, the rewards-store "free soil test" redemption hook (Day 13).

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/api_exception.dart';
import '../api/land_api.dart';
import '../api/soil_tests_api.dart';
import '../models/land_models.dart';
import '../state/app_state.dart';

Future<void> showSoilTestBookingSheet(
  BuildContext context, {
  required AppState state,
  SoilTestsApi? soilTestsApi,
  LandApi? landApi,
}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) => SoilTestBookingSheet(
      state: state,
      soilTestsApi: soilTestsApi,
      landApi: landApi,
      messenger: messenger,
    ),
  );
}

class SoilTestBookingSheet extends StatefulWidget {
  final AppState state;
  final SoilTestsApi? soilTestsApi;
  final LandApi? landApi;
  final ScaffoldMessengerState? messenger;

  const SoilTestBookingSheet({
    super.key,
    required this.state,
    this.soilTestsApi,
    this.landApi,
    this.messenger,
  });

  @override
  State<SoilTestBookingSheet> createState() => _SoilTestBookingSheetState();
}

class _SoilTestBookingSheetState extends State<SoilTestBookingSheet> {
  late final SoilTestsApi _api = widget.soilTestsApi ?? SoilTestsApi();
  late final LandApi _landApi = widget.landApi ?? LandApi();

  final _addressController = TextEditingController();
  List<LandPlot> _plots = const [];
  String? _selectedPlotId; // null = बिना प्लॉट
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  String _slotHalf = 'am'; // 'am' सुबह | 'pm' दोपहर
  String? _addressError;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadPlots();
  }

  @override
  void dispose() {
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _loadPlots() async {
    try {
      final plots = await _landApi.listPlots();
      if (!mounted) return;
      setState(() => _plots = plots);
    } catch (_) {}
  }

  void _snack(String message) {
    final messenger = widget.messenger ?? ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 60)),
    );
    if (picked != null && mounted) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    final address = _addressController.text.trim();
    if (address.length < 10) {
      setState(() => _addressError = 'पूरा पता लिखें');
      return;
    }
    setState(() {
      _addressError = null;
      _submitting = true;
    });
    final slot = '${DateFormat('yyyy-MM-dd').format(_date)} $_slotHalf';
    try {
      await _api.bookSoilTest(
        plotId: _selectedPlotId,
        address: address,
        slot: slot,
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      _snack('मिट्टी परीक्षण बुक हुआ');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      if (e.code == 'SOIL_TEST_ALREADY_BOOKED') {
        _snack('इस प्लॉट का परीक्षण पहले से बुक है');
      } else {
        _snack(e.message.isNotEmpty ? e.message : 'बुकिंग विफल — पुनः प्रयास करें');
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      _snack('बुकिंग विफल — पुनः प्रयास करें');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20, 18, 20, 18 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.science_rounded, color: Color(0xFF2E7D32), size: 20),
              SizedBox(width: 8),
              Text(
                'मिट्टी परीक्षण बुक करें',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
              ),
            ],
          ),
          const SizedBox(height: 14),
          DropdownButtonFormField<String?>(
            initialValue: _selectedPlotId,
            decoration: InputDecoration(
              labelText: 'प्लॉट (वैकल्पिक)',
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              isDense: true,
            ),
            items: [
              const DropdownMenuItem<String?>(
                value: null,
                child: Text('बिना प्लॉट'),
              ),
              ..._plots.map(
                (p) => DropdownMenuItem<String?>(
                  value: p.id,
                  child: Text('${p.name} — ${p.village}'),
                ),
              ),
            ],
            onChanged: (v) => setState(() => _selectedPlotId = v),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _addressController,
            maxLines: 2,
            decoration: InputDecoration(
              labelText: 'नमूना लेने का पता',
              hintText: 'गांव, गट क्रमांक, लैंडमार्क...',
              errorText: _addressError,
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickDate,
                  icon: const Icon(Icons.calendar_month_rounded, size: 16),
                  label: Text(DateFormat('dd MMM yyyy').format(_date)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF2E7D32),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('सुबह'),
                selected: _slotHalf == 'am',
                selectedColor: const Color(0xFFE8F5E9),
                onSelected: (_) => setState(() => _slotHalf = 'am'),
              ),
              const SizedBox(width: 6),
              ChoiceChip(
                label: const Text('दोपहर'),
                selected: _slotHalf == 'pm',
                selectedColor: const Color(0xFFE8F5E9),
                onSelected: (_) => setState(() => _slotHalf = 'pm'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _submitting ? null : _submit,
            icon: const Icon(Icons.check_circle_rounded, size: 18),
            label: Text(
              _submitting ? 'बुक हो रहा है...' : 'बुक करें',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF43A047),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 46),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
