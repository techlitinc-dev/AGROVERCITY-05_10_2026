import 'package:flutter/material.dart';

import '../../api/teachers_api.dart';
import '../../state/app_state.dart';

class TeacherStudentRosterSheet extends StatefulWidget {
  const TeacherStudentRosterSheet({
    super.key,
    required this.state,
    this.api,
  });

  final AppState state;
  final TeachersApi? api;

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    TeachersApi? api,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => TeacherStudentRosterSheet(
        state: state,
        api: api,
      ),
    );
  }

  @override
  State<TeacherStudentRosterSheet> createState() =>
      _TeacherStudentRosterSheetState();
}

class _TeacherStudentRosterSheetState extends State<TeacherStudentRosterSheet> {
  late final TeachersApi _api = widget.api ?? TeachersApi();
  List<Map<String, dynamic>> _students = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final list = await _api.getStudents();
      if (mounted) setState(() => _students = list);
    } catch (_) {} finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _issueCertificate(Map<String, dynamic> student) async {
    final sId = student['studentId'] as String? ?? student['id'] as String;
    final cId = student['courseId'] as String;

    try {
      await _api.issueCertificate(studentId: sId, courseId: cId, grade: 'A+');
      widget.state.showToast('Official Certificate issued to student! 🎓');
      await _load();
    } catch (e) {
      widget.state.showToast('Could not issue certificate: $e');
    }
  }

  void _openAnnouncementDialog(String courseId) {
    final titleCtrl = TextEditingController();
    final msgCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Broadcast Announcement',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: titleCtrl,
              decoration: const InputDecoration(labelText: 'Subject / Title'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: msgCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                  labelText: 'Message for enrolled students'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF1B4332)),
            onPressed: () async {
              final t = titleCtrl.text.trim();
              final m = msgCtrl.text.trim();
              if (t.isEmpty || m.isEmpty) return;
              Navigator.pop(ctx);
              try {
                await _api.broadcastAnnouncement(
                  courseId: courseId,
                  title: t,
                  message: m,
                );
                widget.state
                    .showToast('Announcement sent to all enrolled students! 📢');
              } catch (e) {
                widget.state.showToast('Failed to broadcast: $e');
              }
            },
            child: const Text('Send Broadcast'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
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
                  'Enrolled Students & Progress',
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
                : _students.isEmpty
                    ? const Center(
                        child: Text(
                          'No students enrolled yet.',
                          style: TextStyle(color: Color(0xFF64748B)),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _students.length,
                        separatorBuilder: (_, _) =>
                            const Divider(height: 16, color: Color(0xFFF1F5F9)),
                        itemBuilder: (context, i) {
                          final s = _students[i];
                          final name =
                              s['studentName'] as String? ?? 'Student ${i + 1}';
                          final courseTitle =
                              s['courseTitle'] as String? ?? 'Course';
                          final progress =
                              (s['progressPercent'] as num?)?.toInt() ?? 0;
                          final certIssued = s['certificateIssued'] == true;
                          final courseId = s['courseId'] as String? ?? '';

                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(14),
                              border:
                                  Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          name,
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w900,
                                            color: Color(0xFF1E293B),
                                          ),
                                        ),
                                        Text(
                                          courseTitle,
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: Color(0xFF64748B),
                                          ),
                                        ),
                                      ],
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: progress >= 100
                                            ? const Color(0xFFDCFCE7)
                                            : const Color(0xFFFEF3C7),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        '$progress% Done',
                                        style: TextStyle(
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w900,
                                          color: progress >= 100
                                              ? const Color(0xFF15803D)
                                              : const Color(0xFFB45309),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: LinearProgressIndicator(
                                    value: progress / 100.0,
                                    minHeight: 5,
                                    backgroundColor: const Color(0xFFE2E8F0),
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      progress >= 100
                                          ? const Color(0xFF16A34A)
                                          : const Color(0xFF2D6A4F),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    if (courseId.isNotEmpty)
                                      TextButton.icon(
                                        style: TextButton.styleFrom(
                                          visualDensity: VisualDensity.compact,
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 8),
                                        ),
                                        icon: const Icon(
                                            Icons.campaign_outlined,
                                            size: 16),
                                        label: const Text('Announcement',
                                            style: TextStyle(fontSize: 11.5)),
                                        onPressed: () =>
                                            _openAnnouncementDialog(courseId),
                                      ),
                                    const SizedBox(width: 6),
                                    OutlinedButton.icon(
                                      style: OutlinedButton.styleFrom(
                                        visualDensity: VisualDensity.compact,
                                        foregroundColor: certIssued
                                            ? const Color(0xFF16A34A)
                                            : const Color(0xFF1B4332),
                                        side: BorderSide(
                                          color: certIssued
                                              ? const Color(0xFF16A34A)
                                              : const Color(0xFFCBD5E1),
                                        ),
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 10, vertical: 4),
                                      ),
                                      onPressed: certIssued
                                          ? null
                                          : () => _issueCertificate(s),
                                      icon: Icon(
                                        certIssued
                                            ? Icons.verified_rounded
                                            : Icons.workspace_premium_outlined,
                                        size: 15,
                                      ),
                                      label: Text(
                                        certIssued
                                            ? 'Certificate Issued'
                                            : 'Issue Certificate',
                                        style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w800),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
