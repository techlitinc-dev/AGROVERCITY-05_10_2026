import 'package:flutter/material.dart';

import '../../api/teachers_api.dart';
import '../../state/app_state.dart';

class TeacherProfileSheet extends StatefulWidget {
  const TeacherProfileSheet({
    super.key,
    required this.state,
    this.api,
    this.onSaved,
  });

  final AppState state;
  final TeachersApi? api;
  final VoidCallback? onSaved;

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    TeachersApi? api,
    VoidCallback? onSaved,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TeacherProfileSheet(
        state: state,
        api: api,
        onSaved: onSaved,
      ),
    );
  }

  @override
  State<TeacherProfileSheet> createState() => _TeacherProfileSheetState();
}

class _TeacherProfileSheetState extends State<TeacherProfileSheet> {
  late final TeachersApi _api = widget.api ?? TeachersApi();

  final _bioCtrl = TextEditingController();
  final _credCtrl = TextEditingController();
  final _instCtrl = TextEditingController();
  final _expCtrl = TextEditingController();
  final _upiCtrl = TextEditingController();
  final _bankCtrl = TextEditingController();
  final _accCtrl = TextEditingController();
  final _ifscCtrl = TextEditingController();

  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _bioCtrl.dispose();
    _credCtrl.dispose();
    _instCtrl.dispose();
    _expCtrl.dispose();
    _upiCtrl.dispose();
    _bankCtrl.dispose();
    _accCtrl.dispose();
    _ifscCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final p = await _api.getMyProfile();
      if (!mounted) return;
      _bioCtrl.text = p['bio'] as String? ?? '';
      _credCtrl.text = p['credentials'] as String? ?? '';
      _instCtrl.text = p['institution'] as String? ?? '';
      _expCtrl.text = '${p['experienceYears'] ?? 5}';
      _upiCtrl.text = p['upiId'] as String? ?? '';
      _bankCtrl.text = p['bankName'] as String? ?? '';
      _accCtrl.text = p['accountNumber'] as String? ?? '';
      _ifscCtrl.text = p['ifscCode'] as String? ?? '';
    } catch (_) {} finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await _api.updateMyProfile({
        'bio': _bioCtrl.text.trim(),
        'credentials': _credCtrl.text.trim(),
        'institution': _instCtrl.text.trim(),
        'experienceYears': int.tryParse(_expCtrl.text.trim()) ?? 0,
        'upiId': _upiCtrl.text.trim(),
        'bankName': _bankCtrl.text.trim(),
        'accountNumber': _accCtrl.text.trim(),
        'ifscCode': _ifscCtrl.text.trim(),
      });
      if (!mounted) return;
      widget.state.showToast('Teacher profile & payout settings updated! ✅');
      widget.onSaved?.call();
      Navigator.pop(context);
    } catch (e) {
      if (mounted) widget.state.showToast('Could not save: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 8),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Teacher Profile & Payout Settings',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1E293B),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      const Text(
                        'Academic & Professional Info',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF1B4332),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _credCtrl,
                        decoration: InputDecoration(
                          labelText: 'Credentials / Degree',
                          hintText: 'e.g. M.Sc. Agronomy (IARI)',
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _instCtrl,
                        decoration: InputDecoration(
                          labelText: 'Institution / Organization',
                          hintText: 'e.g. MPKV Rahuri / ICAR',
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _expCtrl,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'Years of Experience',
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _bioCtrl,
                        maxLines: 3,
                        decoration: InputDecoration(
                          labelText: 'Instructor Bio',
                          hintText:
                              'Specialist in precision organic farming...',
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                      const SizedBox(height: 20),

                      const Text(
                        'Earnings & Payout Information',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF1B4332),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _upiCtrl,
                        decoration: InputDecoration(
                          labelText: 'UPI ID for Direct Payouts',
                          hintText: 'e.g. instructor@okaxis',
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _bankCtrl,
                        decoration: InputDecoration(
                          labelText: 'Bank Name',
                          hintText: 'e.g. State Bank of India',
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _accCtrl,
                              decoration: InputDecoration(
                                labelText: 'Account No.',
                                border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              controller: _ifscCtrl,
                              decoration: InputDecoration(
                                labelText: 'IFSC Code',
                                border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF1B4332),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: _saving ? null : _save,
                        child: _saving
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white),
                              )
                            : const Text('Save Profile & Settings',
                                style: TextStyle(fontWeight: FontWeight.w900)),
                      ),
                      const SizedBox(height: 20),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
