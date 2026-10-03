// Modal bottom sheets for Livestock, Dairy, Gaushala and Vet Clinic management.

import 'package:flutter/material.dart';

import '../api/livestock_api.dart';
import '../models/livestock_models.dart';
import '../state/app_state.dart';

/// Sheet to record farmer milk collection with FAT / SNF quality testing & rate payout.
class MilkCollectionEntrySheet extends StatefulWidget {
  final AppState state;
  final LivestockApi api;
  final VoidCallback? onSaved;

  const MilkCollectionEntrySheet({
    super.key,
    required this.state,
    required this.api,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required LivestockApi api,
    VoidCallback? onSaved,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => MilkCollectionEntrySheet(
        state: state,
        api: api,
        onSaved: onSaved,
      ),
    );
  }

  @override
  State<MilkCollectionEntrySheet> createState() =>
      _MilkCollectionEntrySheetState();
}

class _MilkCollectionEntrySheetState extends State<MilkCollectionEntrySheet> {
  final _nameCtrl = TextEditingController(text: 'रामभाऊ पाटील');
  final _phoneCtrl = TextEditingController(text: '+91 98220 12345');
  final _litersCtrl = TextEditingController(text: '12.5');
  final _fatCtrl = TextEditingController(text: '4.2');
  final _snfCtrl = TextEditingController(text: '8.7');

  String _cattleType = 'cow'; // 'cow' or 'buffalo'
  String _shift = 'morning'; // 'morning' or 'evening'
  bool _calculating = false;
  bool _saving = false;
  RateChartCalcResult? _calculatedResult;

  @override
  void initState() {
    super.initState();
    _recalculateRate();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _litersCtrl.dispose();
    _fatCtrl.dispose();
    _snfCtrl.dispose();
    super.dispose();
  }

  Future<void> _recalculateRate() async {
    final fat = double.tryParse(_fatCtrl.text.trim()) ?? 4.0;
    final snf = double.tryParse(_snfCtrl.text.trim()) ?? 8.5;
    final liters = double.tryParse(_litersCtrl.text.trim()) ?? 10.0;

    setState(() => _calculating = true);
    try {
      final res = await widget.api.calcRateChart(
        cattleType: _cattleType,
        fatPercentage: fat,
        snfPercentage: snf,
        quantityLiters: liters,
      );
      if (mounted) setState(() => _calculatedResult = res);
    } catch (_) {
      // Offline fallback formula
      final baseRate = _cattleType == 'cow' ? 35.0 : 55.0;
      final fatDelta = fat - (_cattleType == 'cow' ? 3.5 : 6.0);
      final snfDelta = snf - (_cattleType == 'cow' ? 8.5 : 9.0);
      final rate = baseRate +
          (fatDelta * 10 * (_cattleType == 'cow' ? 0.40 : 0.50)) +
          (snfDelta * 10 * (_cattleType == 'cow' ? 0.25 : 0.30));
      final total = rate * liters;
      if (mounted) {
        setState(() {
          _calculatedResult = RateChartCalcResult(
            cattleType: _cattleType,
            fatPercentage: fat,
            snfPercentage: snf,
            quantityLiters: liters,
            ratePerLiter: double.parse(rate.toStringAsFixed(2)),
            totalPayout: double.parse(total.toStringAsFixed(2)),
            baseRate: baseRate,
            fatBonus: 0.0,
            snfBonus: 0.0,
          );
        });
      }
    } finally {
      if (mounted) setState(() => _calculating = false);
    }
  }

  Future<void> _submit() async {
    final name = _nameCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    final liters = double.tryParse(_litersCtrl.text.trim()) ?? 0.0;
    final fat = double.tryParse(_fatCtrl.text.trim()) ?? 0.0;
    final snf = double.tryParse(_snfCtrl.text.trim()) ?? 0.0;

    if (name.isEmpty || liters <= 0 || fat <= 0 || snf <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('कृपया सर्व माहिती अचूक भरा')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final slip = await widget.api.createMilkCollection({
        'farmerName': name,
        'farmerPhone': phone,
        'date': DateTime.now().toIso8601String().substring(0, 10),
        'shift': _shift,
        'cattleType': _cattleType,
        'quantityLiters': liters,
        'fatPercentage': fat,
        'snfPercentage': snf,
        'paymentStatus': 'pending',
      });
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onSaved?.call();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'दूध पावती तयार झाली! पावती क्र: ${slip.slipNumber} (₹${slip.totalPayout})',
          ),
          backgroundColor: const Color(0xFF1E88E5),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('नोंदणी अयशस्वी: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final isCow = _cattleType == 'cow';

    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: bottomInset + 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 48,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE3F2FD),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.water_drop_rounded,
                    color: Color(0xFF1E88E5),
                    size: 26,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'दूध संकलन नोंद (Milk Slip)',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        'फॅट व एसएनएफ गुणवत्ता चाचणी आणि दर आकारणी',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Shift and Cattle Type Selectors
            Row(
              children: [
                Expanded(
                  child: SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                        value: 'morning',
                        label: Text('सकाळ'),
                        icon: Icon(Icons.wb_sunny_outlined, size: 16),
                      ),
                      ButtonSegment(
                        value: 'evening',
                        label: Text('संध्याकाळ'),
                        icon: Icon(Icons.nights_stay_outlined, size: 16),
                      ),
                    ],
                    selected: {_shift},
                    onSelectionChanged: (val) =>
                        setState(() => _shift = val.first),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                        value: 'cow',
                        label: Text('गाय (Cow)'),
                        icon: Icon(Icons.pets, size: 16),
                      ),
                      ButtonSegment(
                        value: 'buffalo',
                        label: Text('म्हैस (Buffalo)'),
                        icon: Icon(Icons.agriculture, size: 16),
                      ),
                    ],
                    selected: {_cattleType},
                    onSelectionChanged: (val) {
                      setState(() {
                        _cattleType = val.first;
                        if (_cattleType == 'buffalo' &&
                            double.parse(_fatCtrl.text) < 5.0) {
                          _fatCtrl.text = '6.5';
                          _snfCtrl.text = '9.0';
                        }
                      });
                      _recalculateRate();
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Farmer details
            TextField(
              controller: _nameCtrl,
              decoration: InputDecoration(
                labelText: 'शेतकऱ्याचे नाव',
                prefixIcon: const Icon(Icons.person_outline),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: 'मोबाईल क्रमांक',
                prefixIcon: const Icon(Icons.phone_outlined),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Quantity, Fat, SNF
            Row(
              children: [
                Expanded(
                  flex: 4,
                  child: TextField(
                    controller: _litersCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: 'प्रमाण (लिटर)',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onChanged: (_) => _recalculateRate(),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: _fatCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: 'FAT %',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onChanged: (_) => _recalculateRate(),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: _snfCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: 'SNF %',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onChanged: (_) => _recalculateRate(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Calculated payout card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isCow
                    ? const Color(0xFFF1F8E9)
                    : const Color(0xFFECEFF1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isCow
                      ? const Color(0xFF81C784)
                      : const Color(0xFFB0BEC5),
                ),
              ),
              child: _calculating
                  ? const Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'दर प्रति लिटर',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                            Text(
                              '₹${_calculatedResult?.ratePerLiter.toStringAsFixed(2) ?? "0.00"} /L',
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF2E7D32),
                              ),
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text(
                              'एकूण देय रक्कम (Payout)',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                            Text(
                              '₹${_calculatedResult?.totalPayout.toStringAsFixed(2) ?? "0.00"}',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF1565C0),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
            ),
            const SizedBox(height: 20),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E88E5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: _saving ? null : _submit,
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.print_rounded, color: Colors.white),
                label: Text(
                  _saving ? 'जतन करत आहे...' : 'डिजिटल दूध पावती जतन करा',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Sheet to register new cattle with 12-digit Pashu Aadhaar ear tag passport.
class RegisterAnimalSheet extends StatefulWidget {
  final AppState state;
  final LivestockApi api;
  final VoidCallback? onSaved;

  const RegisterAnimalSheet({
    super.key,
    required this.state,
    required this.api,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required LivestockApi api,
    VoidCallback? onSaved,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => RegisterAnimalSheet(
        state: state,
        api: api,
        onSaved: onSaved,
      ),
    );
  }

  @override
  State<RegisterAnimalSheet> createState() => _RegisterAnimalSheetState();
}

class _RegisterAnimalSheetState extends State<RegisterAnimalSheet> {
  final _tagCtrl = TextEditingController(text: '100293847501');
  final _nameCtrl = TextEditingController(text: 'गंगा (Ganga)');
  final _breedCtrl = TextEditingController(text: 'Gir (गीर)');
  final _yieldCtrl = TextEditingController(text: '14.5');

  String _species = 'cow';
  String _lactationStage = 'milking';
  String _healthStatus = 'healthy';
  int _lactationNumber = 2;
  bool _saving = false;

  @override
  void dispose() {
    _tagCtrl.dispose();
    _nameCtrl.dispose();
    _breedCtrl.dispose();
    _yieldCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final tag = _tagCtrl.text.trim();
    final name = _nameCtrl.text.trim();
    final breed = _breedCtrl.text.trim();
    final avgYield = double.tryParse(_yieldCtrl.text.trim()) ?? 0.0;

    if (tag.isEmpty || name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('कृपया टॅग आयडी व नाव भरा')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final animal = await widget.api.createAnimal({
        'tagId': tag,
        'name': name,
        'species': _species,
        'breed': breed,
        'dateOfBirth': '2021-06-15',
        'lactationStage': _lactationStage,
        'lactationNumber': _lactationNumber,
        'dailyAvgYield': avgYield,
        'healthStatus': _healthStatus,
      });
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onSaved?.call();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('पशू आधार नोंदणी पूर्ण: ${animal.name} (${animal.tagId})'),
          backgroundColor: const Color(0xFF2E7D32),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('नोंदणी अयशस्वी: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: bottomInset + 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 48,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Row(
              children: [
                Icon(Icons.badge_rounded, color: Color(0xFF2E7D32), size: 28),
                SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'पशू आधार व कळप नोंदणी',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        '१२-अंकी इअर टॅग, जात आणि दूध उत्पादक अवस्था',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Species
            Row(
              children: [
                Expanded(
                  child: SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'cow', label: Text('गाय (Cow)')),
                      ButtonSegment(value: 'buffalo', label: Text('म्हैस (Buffalo)')),
                      ButtonSegment(value: 'goat', label: Text('शेळी (Goat)')),
                    ],
                    selected: {_species},
                    onSelectionChanged: (val) {
                      setState(() {
                        _species = val.first;
                        if (_species == 'buffalo') {
                          _breedCtrl.text = 'Murrah (मुर्रा)';
                        } else if (_species == 'cow') {
                          _breedCtrl.text = 'Gir (गीर)';
                        } else {
                          _breedCtrl.text = 'Osmanabadi (उस्मानाबादी)';
                        }
                      });
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            TextField(
              controller: _tagCtrl,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'इअर टॅग / पशू आधार क्र. (12 Digit UID)',
                prefixIcon: const Icon(Icons.qr_code),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _nameCtrl,
              decoration: InputDecoration(
                labelText: 'जनावराचे नाव',
                prefixIcon: const Icon(Icons.pets),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _breedCtrl,
                    decoration: InputDecoration(
                      labelText: 'जात (Breed)',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _yieldCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: 'दैनिक दूध (L/Day)',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Lactation Stage Dropdown
            DropdownButtonFormField<String>(
              value: _lactationStage,
              decoration: InputDecoration(
                labelText: 'उत्पादक टप्पा (Lactation Stage)',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              items: const [
                DropdownMenuItem(value: 'milking', child: Text('दुधाळ (Milking)')),
                DropdownMenuItem(value: 'pregnant', child: Text('गाभण (Pregnant)')),
                DropdownMenuItem(value: 'dry', child: Text('गाभण कोरडी (Dry Period)')),
                DropdownMenuItem(value: 'heifer', child: Text('कालवड (Heifer)')),
                DropdownMenuItem(value: 'calf', child: Text('वासरू (Calf)')),
              ],
              onChanged: (val) {
                if (val != null) setState(() => _lactationStage = val);
              },
            ),
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2E7D32),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: _saving ? null : _submit,
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.check_circle_outline, color: Colors.white),
                label: Text(
                  _saving ? 'जतन करत आहे...' : 'पशू नोंदणी जतन करा',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Sheet to record Artificial Insemination / Breeding Cycle.
class LogBreedingSheet extends StatefulWidget {
  final AppState state;
  final LivestockApi api;
  final List<Animal> animals;
  final VoidCallback? onSaved;

  const LogBreedingSheet({
    super.key,
    required this.state,
    required this.api,
    required this.animals,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required LivestockApi api,
    required List<Animal> animals,
    VoidCallback? onSaved,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => LogBreedingSheet(
        state: state,
        api: api,
        animals: animals,
        onSaved: onSaved,
      ),
    );
  }

  @override
  State<LogBreedingSheet> createState() => _LogBreedingSheetState();
}

class _LogBreedingSheetState extends State<LogBreedingSheet> {
  late String _selectedAnimalId =
      widget.animals.isNotEmpty ? widget.animals.first.id : '';
  late String _selectedTag =
      widget.animals.isNotEmpty ? widget.animals.first.tagId : '';

  final _strawCtrl = TextEditingController(text: 'GIR-BULL-BAHUBALI-889');
  final _techCtrl = TextEditingController(text: 'डॉ. कदम (AI Technician)');
  bool _saving = false;

  @override
  void dispose() {
    _strawCtrl.dispose();
    _techCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selectedAnimalId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('कृपया जनावर निवडा')),
      );
      return;
    }

    setState(() => _saving = true);
    final now = DateTime.now();
    final today = now.toIso8601String().substring(0, 10);
    // 280 days gestation for cow
    final expectedCalving = now.add(const Duration(days: 280));
    final expectedCalvingStr =
        expectedCalving.toIso8601String().substring(0, 10);

    try {
      await widget.api.createBreedingCycle({
        'animalId': _selectedAnimalId,
        'tagId': _selectedTag,
        'heatDate': today,
        'aiDate': today,
        'bullSemenStrawId': _strawCtrl.text.trim(),
        'technicianName': _techCtrl.text.trim(),
        'pdStatus': 'pending',
        'expectedCalvingDate': expectedCalvingStr,
        'notes': 'उच्च वंशावळ वीर्य कांड्या वापरली',
      });
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onSaved?.call();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'कृत्रिम रेतन (AI) नोंदवले! अंदाजित विण्याची तारीख: $expectedCalvingStr',
          ),
          backgroundColor: const Color(0xFF8E24AA),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('नोंद अयशस्वी: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: bottomInset + 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 48,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Row(
              children: [
                Icon(Icons.favorite_rounded, color: Color(0xFF8E24AA), size: 28),
                SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'प्रजनन व कृत्रिम रेतन नोंद (AI Log)',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        'वीर्य नळी क्र., गर्भधारणा चाचणी व विण्याचा कालावधी',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Select Animal
            if (widget.animals.isNotEmpty)
              DropdownButtonFormField<String>(
                value: _selectedAnimalId,
                decoration: InputDecoration(
                  labelText: 'जनावर निवडा',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                items: widget.animals
                    .map(
                      (a) => DropdownMenuItem(
                        value: a.id,
                        child: Text('${a.name} [टॅग: ${a.tagId}]'),
                      ),
                    )
                    .toList(),
                onChanged: (val) {
                  if (val != null) {
                    final selected =
                        widget.animals.firstWhere((a) => a.id == val);
                    setState(() {
                      _selectedAnimalId = val;
                      _selectedTag = selected.tagId;
                    });
                  }
                },
              ),
            const SizedBox(height: 12),

            TextField(
              controller: _strawCtrl,
              decoration: InputDecoration(
                labelText: 'वळू वीर्य कांडी क्र. (Bull Semen Straw ID)',
                prefixIcon: const Icon(Icons.science_outlined),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _techCtrl,
              decoration: InputDecoration(
                labelText: 'पशुवैद्यक / AI तंत्रज्ञाचे नाव',
                prefixIcon: const Icon(Icons.medical_services_outlined),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 16),

            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF3E5F5),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFCE93D8)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, color: Color(0xFF8E24AA)),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'AI नंतर ६० दिवसांनी गर्भधारणा चाचणी (PD Check) ची सूचना दिली जाईल. गाईंचा गर्भधारणा कालावधी अंदाजे २८० दिवस असतो.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF4A148C)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF8E24AA),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: _saving ? null : _submit,
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.save_rounded, color: Colors.white),
                label: Text(
                  _saving ? 'नोंद होत आहे...' : 'AI नोंद पूर्ण करा',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Sheet to add veterinary diagnosis, e-prescription and withdrawal warning.
class AddVetRecordSheet extends StatefulWidget {
  final AppState state;
  final LivestockApi api;
  final List<Animal> animals;
  final VoidCallback? onSaved;

  const AddVetRecordSheet({
    super.key,
    required this.state,
    required this.api,
    required this.animals,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required LivestockApi api,
    required List<Animal> animals,
    VoidCallback? onSaved,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => AddVetRecordSheet(
        state: state,
        api: api,
        animals: animals,
        onSaved: onSaved,
      ),
    );
  }

  @override
  State<AddVetRecordSheet> createState() => _AddVetRecordSheetState();
}

class _AddVetRecordSheetState extends State<AddVetRecordSheet> {
  late String _selectedAnimalId =
      widget.animals.isNotEmpty ? widget.animals.first.id : 'anim-01';
  late String _selectedTag =
      widget.animals.isNotEmpty ? widget.animals.first.tagId : '100293847501';

  final _docNameCtrl = TextEditingController(text: 'डॉ. आनंद पाटील (B.V.Sc)');
  final _symptomsCtrl =
      TextEditingController(text: 'ताप १०३° फॅ., कास सुजलेली, दूध घटले');
  final _diagnosisCtrl =
      TextEditingController(text: 'तीव्र कासदाह (Acute Mastitis)');
  final _treatmentCtrl =
      TextEditingController(text: 'Intramammary Cefquinome infusion, Meloxicam');
  int _withdrawalDays = 4;
  bool _saving = false;

  @override
  void dispose() {
    _docNameCtrl.dispose();
    _symptomsCtrl.dispose();
    _diagnosisCtrl.dispose();
    _treatmentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    final today = DateTime.now().toIso8601String().substring(0, 10);
    try {
      await widget.api.createVetRecord({
        'animalId': _selectedAnimalId,
        'tagId': _selectedTag,
        'vetDoctorName': _docNameCtrl.text.trim(),
        'examinationDate': today,
        'symptoms': _symptomsCtrl.text.trim(),
        'clinicalDiagnosis': _diagnosisCtrl.text.trim(),
        'treatmentsGiven': [_treatmentCtrl.text.trim()],
        'prescriptions': [
          {
            'medicine': 'Cefquinome',
            'dose': '1 tube',
            'frequency': 'Every 12h for 3 days',
          }
        ],
        'milkWithdrawalDays': _withdrawalDays,
        'status': 'under_treatment',
      });
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onSaved?.call();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('पशुवैद्यकीय केस नोंदवली! दूध विथड्रॉवल अलर्ट सक्रिय केला.'),
          backgroundColor: Color(0xFFD32F2F),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('नोंद अयशस्वी: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: bottomInset + 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 48,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Row(
              children: [
                Icon(
                  Icons.medical_services_rounded,
                  color: Color(0xFFD32F2F),
                  size: 28,
                ),
                SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'पशुवैद्यकीय निदान व ई-प्रिस्क्रिप्शन',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        'औषधोपचार, क्लिनिकल तपासणी व दूध विथड्रॉवल नियम',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            TextField(
              controller: _docNameCtrl,
              decoration: InputDecoration(
                labelText: 'पशुवैद्यक डॉक्टरांचे नाव',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _symptomsCtrl,
              decoration: InputDecoration(
                labelText: 'लक्षणे (Symptoms)',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _diagnosisCtrl,
              decoration: InputDecoration(
                labelText: 'रोग निदान (Clinical Diagnosis)',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _treatmentCtrl,
              decoration: InputDecoration(
                labelText: 'औषधोपचार (Medications Given)',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Milk withdrawal days selector
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'दूध विथड्रॉवल कालावधी (दिवस):',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                DropdownButton<int>(
                  value: _withdrawalDays,
                  items: [0, 1, 2, 3, 4, 5, 7, 10]
                      .map((d) => DropdownMenuItem(value: d, child: Text('$d दिवस')))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _withdrawalDays = val);
                  },
                ),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFEBEE),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFFCDD2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: Color(0xFFD32F2F)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'एंटीबायोटिक अवशेषांमुळे पुढील $_withdrawalDays दिवस या गाईचे दूध संकलन केंद्रावर पाठवू नये!',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFFB71C1C),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD32F2F),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: _saving ? null : _submit,
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.check, color: Colors.white),
                label: Text(
                  _saving ? 'जतन करत आहे...' : 'केस रेकॉर्ड सुरक्षित जतन करा',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Sheet for Cow Adoption & Sponsorship with 80G tax exemption.
class CowAdoptionSheet extends StatefulWidget {
  final AppState state;
  final LivestockApi api;
  final VoidCallback? onSaved;

  const CowAdoptionSheet({
    super.key,
    required this.state,
    required this.api,
    this.onSaved,
  });

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required LivestockApi api,
    VoidCallback? onSaved,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CowAdoptionSheet(
        state: state,
        api: api,
        onSaved: onSaved,
      ),
    );
  }

  @override
  State<CowAdoptionSheet> createState() => _CowAdoptionSheetState();
}

class _CowAdoptionSheetState extends State<CowAdoptionSheet> {
  final _nameCtrl = TextEditingController(text: 'राजेश कुलकर्णी');
  final _phoneCtrl = TextEditingController(text: '+91 99887 76655');
  final _panCtrl = TextEditingController(text: 'ABCDE1234F');

  String _tier = 'gau_gras'; // gau_gras (1100), gau_seva (2500), purna_dattak (5000)
  int _amount = 1100;
  bool _saving = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _panCtrl.dispose();
    super.dispose();
  }

  void _updateTier(String tier) {
    setState(() {
      _tier = tier;
      if (tier == 'gau_gras') _amount = 1100;
      if (tier == 'gau_seva') _amount = 2500;
      if (tier == 'purna_dattak') _amount = 5000;
    });
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    final today = DateTime.now().toIso8601String().substring(0, 10);
    try {
      final adoption = await widget.api.createCowAdoption({
        'gaushalaId': 'gaushala-01',
        'cowTagId': '100293847501',
        'cowName': 'गंगा (Desi Gir)',
        'donorName': _nameCtrl.text.trim(),
        'donorPhone': _phoneCtrl.text.trim(),
        'donorPan': _panCtrl.text.trim(),
        'adoptionTier': _tier,
        'amountRupees': _amount,
        'durationMonths': 1,
        'startDate': today,
      });
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onSaved?.call();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'गोदत्तक नोंदणी यशस्वी! 80G पावती क्र.: ${adoption.receiptNumber}',
          ),
          backgroundColor: const Color(0xFFEF6C00),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('नोंद अयशस्वी: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: bottomInset + 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 48,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Row(
              children: [
                Icon(Icons.volunteer_activism, color: Color(0xFFEF6C00), size: 28),
                SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'गोदत्तक व गोसेवा प्रायोजकत्व',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        'कलम 80G कर सवलत पावतीसह गोशाळा आधार',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Tier options
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => _updateTier('gau_gras'),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: _tier == 'gau_gras'
                            ? const Color(0xFFFFF3E0)
                            : Colors.grey.shade100,
                        border: Border.all(
                          color: _tier == 'gau_gras'
                              ? const Color(0xFFEF6C00)
                              : Colors.grey.shade300,
                          width: 2,
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Column(
                        children: [
                          Text('गौ-ग्रास', style: TextStyle(fontWeight: FontWeight.bold)),
                          SizedBox(height: 4),
                          Text('₹१,१००/महिना', style: TextStyle(color: Color(0xFFEF6C00), fontSize: 13, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: InkWell(
                    onTap: () => _updateTier('gau_seva'),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: _tier == 'gau_seva'
                            ? const Color(0xFFFFF3E0)
                            : Colors.grey.shade100,
                        border: Border.all(
                          color: _tier == 'gau_seva'
                              ? const Color(0xFFEF6C00)
                              : Colors.grey.shade300,
                          width: 2,
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Column(
                        children: [
                          Text('गौ-सेवा', style: TextStyle(fontWeight: FontWeight.bold)),
                          SizedBox(height: 4),
                          Text('₹२,५००/महिना', style: TextStyle(color: Color(0xFFEF6C00), fontSize: 13, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: InkWell(
                    onTap: () => _updateTier('purna_dattak'),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: _tier == 'purna_dattak'
                            ? const Color(0xFFFFF3E0)
                            : Colors.grey.shade100,
                        border: Border.all(
                          color: _tier == 'purna_dattak'
                              ? const Color(0xFFEF6C00)
                              : Colors.grey.shade300,
                          width: 2,
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Column(
                        children: [
                          Text('पूर्ण दत्तक', style: TextStyle(fontWeight: FontWeight.bold)),
                          SizedBox(height: 4),
                          Text('₹५,०००/महिना', style: TextStyle(color: Color(0xFFEF6C00), fontSize: 13, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            TextField(
              controller: _nameCtrl,
              decoration: InputDecoration(
                labelText: 'दानशूर / पालकाचे नाव',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: 'मोबाईल क्र.',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _panCtrl,
              decoration: InputDecoration(
                labelText: 'पॅन कार्ड क्र. (80G कर सवलतीसाठी)',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEF6C00),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: _saving ? null : _submit,
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.favorite, color: Colors.white),
                label: Text(
                  _saving ? 'प्रक्रिया सुरू आहे...' : 'दत्तक स्वीकारा व 80G पावती मिळवा',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
