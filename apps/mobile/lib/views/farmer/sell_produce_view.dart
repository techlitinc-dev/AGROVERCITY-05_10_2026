// F7: Sell-produce flow — farmer posts harvested lots and manages listings.

import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../api/api_exception.dart';
import '../../api/lots_api.dart';
import '../../components/market/lot_card.dart';
import '../../state/app_state.dart';

class SellProduceView extends StatefulWidget {
  final AppState state;
  final LotsApi? lotsApi;

  const SellProduceView({super.key, required this.state, this.lotsApi});

  @override
  State<SellProduceView> createState() => _SellProduceViewState();
}

class _SellProduceViewState extends State<SellProduceView> {
  late final LotsApi _api = widget.lotsApi ?? LotsApi();
  final _quantityCtrl = TextEditingController();
  final _rateCtrl = TextEditingController();

  late String _crop = _cropOptions().first;
  DateTime _harvestDate = DateTime.now();
  final List<String> _photos = [];
  String? _editingId;
  String? _quantityError;
  bool _submitting = false;
  bool _loadingLots = true;
  List<Map<String, dynamic>> _lots = [];

  @override
  void initState() {
    super.initState();
    _loadLots();
  }

  @override
  void dispose() {
    _quantityCtrl.dispose();
    _rateCtrl.dispose();
    super.dispose();
  }

  List<String> _cropOptions() {
    final crops = [...widget.state.profile.activeCrops];
    for (final c in const ['Onion (प्याज)', 'Tomato (टमाटर)', 'Wheat (गेहूं)']) {
      if (!crops.contains(c)) crops.add(c);
    }
    return crops;
  }

  (double, double) _centroid() {
    final points = widget.state.profile.farmBoundaryPoints;
    if (points.isEmpty) return (20.0, 73.8);
    final lat = points.map((p) => p['lat'] ?? 0.0).reduce((a, b) => a + b) / points.length;
    final lng = points.map((p) => p['lng'] ?? 0.0).reduce((a, b) => a + b) / points.length;
    return (lat, lng);
  }

  String get _harvestDateStr =>
      "${_harvestDate.year}-${_harvestDate.month.toString().padLeft(2, '0')}-${_harvestDate.day.toString().padLeft(2, '0')}";

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _loadLots() async {
    try {
      final res = await _api.getMyLots();
      if (!mounted) return;
      setState(() {
        _lots = (res['data'] as List).cast<Map<String, dynamic>>();
        _loadingLots = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _lots = const [];
        _loadingLots = false;
      });
    }
  }

  Future<void> _pickPhotos() async {
    try {
      final picked = await ImagePicker().pickMultiImage(limit: 3);
      for (final file in picked.take(3 - _photos.length)) {
        try {
          final uid = widget.state.currentUser?['id'] ?? 'demo';
          final ts = DateTime.now().millisecondsSinceEpoch;
          final ref = FirebaseStorage.instance.ref('lots/$uid/lot_$ts.jpg');
          await ref.putData(await file.readAsBytes());
          _photos.add(await ref.getDownloadURL());
        } catch (_) {
          _snack("फोटो अपलोड विफल");
        }
      }
      if (mounted) setState(() {});
    } catch (_) {}
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _harvestDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (d != null) setState(() => _harvestDate = d);
  }

  Future<void> _submit() async {
    final quantity = double.tryParse(_quantityCtrl.text.trim()) ?? 0;
    if (quantity <= 0) {
      setState(() => _quantityError = "मात्रा 0 से अधिक होनी चाहिए");
      return;
    }
    setState(() {
      _quantityError = null;
      _submitting = true;
    });
    final (lat, lng) = _centroid();
    final fields = <String, dynamic>{
      'crop': _crop,
      'quantityQuintals': quantity,
      'expectedRate': int.tryParse(_rateCtrl.text.trim()) ?? 0,
      'harvestDate': _harvestDateStr,
      'photos': _photos,
      'location': {'lat': lat, 'lng': lng},
    };
    try {
      if (_editingId != null) {
        await _api.updateLot(_editingId!, fields);
        _snack("लॉट अपडेट हुआ");
      } else {
        await _api.createLot(fields);
        _snack("लॉट पोस्ट हुआ");
      }
      _quantityCtrl.clear();
      _rateCtrl.clear();
      _photos.clear();
      _editingId = null;
      await _loadLots();
    } on ApiException catch (e) {
      _snack(e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _startEdit(Map<String, dynamic> lot) {
    setState(() {
      _editingId = lot['id'] as String?;
      _crop = lot['crop'] as String? ?? _crop;
      _quantityCtrl.text = "${lot['quantityQuintals']}";
      _rateCtrl.text = "${lot['expectedRate']}";
      final d = DateTime.tryParse("${lot['harvestDate']}");
      if (d != null) _harvestDate = d;
      _photos
        ..clear()
        ..addAll((lot['photos'] as List? ?? const []).cast<String>());
    });
  }

  Future<void> _withdraw(Map<String, dynamic> lot) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("लॉट वापस लें?", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Text("${lot['crop']} — ${lot['quantityQuintals']} क्विंटल"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("रद्द करें")),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("वापस लें"),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.withdrawLot("${lot['id']}");
      _snack("लॉट वापस लिया गया");
      await _loadLots();
    } on ApiException catch (e) {
      _snack(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _editingId == null ? "अपनी उपज बेचें (Lot Form)" : "लॉट संपादित करें",
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          LotFormField(
            label: "फसल",
            child: DropdownButton<String>(
              value: _crop,
              isExpanded: true,
              underline: const SizedBox.shrink(),
              items: [
                for (final c in _cropOptions())
                  DropdownMenuItem(value: c, child: Text(c, style: const TextStyle(fontSize: 13))),
              ],
              onChanged: (v) => setState(() => _crop = v ?? _crop),
            ),
          ),
          LotFormField(
            label: "मात्रा (क्विंटल)",
            error: _quantityError,
            child: TextField(
              controller: _quantityCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration.collapsed(hintText: "जैसे 10"),
            ),
          ),
          LotFormField(
            label: "अपेक्षित भाव (₹/क्विंटल)",
            child: TextField(
              controller: _rateCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration.collapsed(hintText: "जैसे 1950"),
            ),
          ),
          LotFormField(
            label: "कटाई तिथि: $_harvestDateStr",
            child: Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: _pickDate,
                icon: const Icon(Icons.calendar_month_rounded, size: 16),
                label: const Text("तिथि चुनें"),
              ),
            ),
          ),
          LotFormField(
            label: "फोटो (${_photos.length}/3)",
            child: Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: _photos.length >= 3 ? null : _pickPhotos,
                icon: const Icon(Icons.add_a_photo_rounded, size: 16),
                label: const Text("फोटो जोड़ें"),
              ),
            ),
          ),
          const SizedBox(height: 6),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _submitting ? null : _submit,
              child: Text(
                _submitting ? "भेजा जा रहा है..." : (_editingId == null ? "लॉट पोस्ट करें" : "लॉट अपडेट करें"),
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ),
          const SizedBox(height: 18),
          const Text("मेरे लॉट", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          if (_loadingLots)
            Container(
              height: 64,
              decoration: BoxDecoration(color: Colors.grey.shade200, borderRadius: BorderRadius.circular(14)),
            )
          else if (_lots.isEmpty)
            const Text("कोई लॉट नहीं", style: TextStyle(fontSize: 12, color: Colors.grey))
          else
            ..._lots.map(
              (lot) => LotCard(
                lot: lot,
                onEdit: () => _startEdit(lot),
                onWithdraw: () => _withdraw(lot),
              ),
            ),
        ],
      ),
    );
  }
}
