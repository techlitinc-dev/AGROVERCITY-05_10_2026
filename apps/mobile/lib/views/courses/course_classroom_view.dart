import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/api_exception.dart';
import '../../api/courses_api.dart';
import '../../state/app_state.dart';
import 'course_certificate_view.dart';

class CourseClassroomView extends StatefulWidget {
  const CourseClassroomView({
    super.key,
    required this.state,
    required this.courseId,
    this.api,
  });

  final AppState state;
  final String courseId;
  final CoursesApi? api;

  @override
  State<CourseClassroomView> createState() => _CourseClassroomViewState();
}

class _CourseClassroomViewState extends State<CourseClassroomView> {
  late final CoursesApi _api = widget.api ?? CoursesApi();
  Map<String, dynamic>? _classroomData;
  bool _loading = true;
  Map<String, dynamic>? _currentLesson;
  final Set<String> _completedLessonIds = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await _api.getClassroom(widget.courseId);
      if (!mounted) return;
      final completed = (data['enrollment']?['completedLessons'] as List?)
              ?.cast<String>() ??
          const [];
      _completedLessonIds
        ..clear()
        ..addAll(completed);

      // Find first lesson if none selected
      final modules = (data['course']?['modules'] as List?)
              ?.cast<Map<String, dynamic>>() ??
          const [];
      Map<String, dynamic>? firstLesson;
      for (final m in modules) {
        final lessons = (m['lessons'] as List?)?.cast<Map<String, dynamic>>();
        if (lessons != null && lessons.isNotEmpty) {
          firstLesson = lessons.first;
          break;
        }
      }

      setState(() {
        _classroomData = data;
        _currentLesson ??= firstLesson;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      widget.state.showToast(e.message.isNotEmpty ? e.message : e.code);
      Navigator.pop(context);
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleCurrentLesson() async {
    if (_currentLesson == null) return;
    final lessonId = _currentLesson!['id'] as String;
    final isDone = _completedLessonIds.contains(lessonId);
    final nextState = !isDone;

    try {
      final res = await _api.updateLessonProgress(
        widget.courseId,
        lessonId,
        completed: nextState,
      );
      if (!mounted) return;
      setState(() {
        if (nextState) {
          _completedLessonIds.add(lessonId);
        } else {
          _completedLessonIds.remove(lessonId);
        }
        if (_classroomData != null && _classroomData!['enrollment'] != null) {
          _classroomData!['enrollment']['progressPercent'] =
              res['progressPercent'];
          _classroomData!['enrollment']['completed'] = res['completed'];
        }
      });
      widget.state.showToast(nextState
          ? 'Lesson marked complete! +10 XP'
          : 'Lesson marked incomplete');
    } catch (e) {
      widget.state.showToast('Could not update progress: $e');
    }
  }

  Future<void> _openCertificate() async {
    try {
      final cert = await _api.getCertificate(widget.courseId);
      if (!mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => CourseCertificateView(
            state: widget.state,
            certificate: cert,
          ),
        ),
      );
    } catch (e) {
      widget.state.showToast('Certificate not ready yet');
    }
  }

  Future<void> _openLink(String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8FAFC),
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final course = _classroomData?['course'] as Map<String, dynamic>? ?? {};
    final enrollment =
        _classroomData?['enrollment'] as Map<String, dynamic>? ?? {};
    final progress = (enrollment['progressPercent'] as num?)?.toInt() ?? 0;
    final isCourseComplete = enrollment['completed'] == true || progress == 100;
    final modules =
        (course['modules'] as List?)?.cast<Map<String, dynamic>>() ?? const [];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF1E293B)),
        title: Text(
          course['title'] as String? ?? 'Classroom',
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w900,
            color: Color(0xFF1E293B),
          ),
        ),
        actions: [
          if (isCourseComplete)
            IconButton(
              icon: const Icon(Icons.workspace_premium_rounded,
                  color: Color(0xFFD97706)),
              tooltip: 'Certificate',
              onPressed: _openCertificate,
            ),
        ],
      ),
      body: Column(
        children: [
          // Progress Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Your Course Progress: $progress%',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1B4332),
                      ),
                    ),
                    if (isCourseComplete)
                      GestureDetector(
                        onTap: _openCertificate,
                        child: const Row(
                          children: [
                            Icon(Icons.verified_rounded,
                                size: 14, color: Color(0xFF16A34A)),
                            SizedBox(width: 4),
                            Text(
                              'Claim Certificate 🎓',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF16A34A),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: progress / 100.0,
                    minHeight: 7,
                    backgroundColor: const Color(0xFFE2E8F0),
                    valueColor: AlwaysStoppedAnimation<Color>(
                      isCourseComplete
                          ? const Color(0xFF16A34A)
                          : const Color(0xFF2D6A4F),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Main Lesson Player Area
          if (_currentLesson != null) _buildPlayerArea(_currentLesson!),

          // Curriculum Modules & Lessons Accordion
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(14),
              children: [
                const Text(
                  'Course Curriculum',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 10),
                for (var i = 0; i < modules.length; i++)
                  _buildModuleItem(modules[i], i + 1),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlayerArea(Map<String, dynamic> lesson) {
    final lessonId = lesson['id'] as String? ?? '';
    final isDone = _completedLessonIds.contains(lessonId);
    final videoUrl = lesson['videoUrl'] as String?;
    final notesUrl = lesson['notesUrl'] as String?;

    return Container(
      color: const Color(0xFF0F172A),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.play_circle_filled_rounded,
                    color: Color(0xFF52B788), size: 28),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      lesson['title'] as String? ?? 'Lesson',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      '${lesson['durationMinutes'] ?? 10} mins • Interactive Lecture',
                      style: const TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: isDone
                        ? const Color(0xFF52B788)
                        : Colors.white,
                    side: BorderSide(
                      color: isDone
                          ? const Color(0xFF52B788)
                          : const Color(0xFF475569),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  onPressed: _toggleCurrentLesson,
                  icon: Icon(
                    isDone
                        ? Icons.check_circle_rounded
                        : Icons.radio_button_unchecked_rounded,
                    size: 16,
                  ),
                  label: Text(
                    isDone ? 'Completed ✓' : 'Mark Complete',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              if (videoUrl != null && videoUrl.isNotEmpty) ...[
                const SizedBox(width: 8),
                IconButton(
                  tooltip: 'Watch Stream',
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFF1E293B),
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.open_in_new_rounded, size: 18),
                  onPressed: () => _openLink(videoUrl),
                ),
              ],
              if (notesUrl != null && notesUrl.isNotEmpty) ...[
                const SizedBox(width: 8),
                IconButton(
                  tooltip: 'Lecture Notes PDF',
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFF1E293B),
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.picture_as_pdf_rounded, size: 18),
                  onPressed: () => _openLink(notesUrl),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildModuleItem(Map<String, dynamic> module, int moduleIndex) {
    final title = module['title'] as String? ?? 'Module $moduleIndex';
    final lessons =
        (module['lessons'] as List?)?.cast<Map<String, dynamic>>() ?? const [];

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        clipBehavior: Clip.antiAlias,
        child: ExpansionTile(
          initiallyExpanded: true,
          tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
          title: Text(
            'Section $moduleIndex: $title',
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w900,
              color: Color(0xFF1E293B),
            ),
          ),
          subtitle: Text(
            '${lessons.length} lessons',
            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
          ),
          children: [
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            for (final lesson in lessons) _buildLessonTile(lesson),
          ],
        ),
      ),
    );
  }

  Widget _buildLessonTile(Map<String, dynamic> lesson) {
    final lessonId = lesson['id'] as String? ?? '';
    final isDone = _completedLessonIds.contains(lessonId);
    final isSelected = _currentLesson?['id'] == lessonId;

    return Material(
      color: isSelected
          ? const Color(0xFF1B4332).withValues(alpha: 0.05)
          : Colors.transparent,
      child: ListTile(
        dense: true,
        leading: Icon(
          isDone ? Icons.check_circle_rounded : Icons.play_circle_outline_rounded,
          color: isDone
              ? const Color(0xFF16A34A)
              : (isSelected ? const Color(0xFF1B4332) : const Color(0xFF94A3B8)),
          size: 20,
        ),
        title: Text(
          lesson['title'] as String? ?? 'Lesson',
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
            color: isSelected
                ? const Color(0xFF1B4332)
                : const Color(0xFF334155),
          ),
        ),
        trailing: Text(
          '${lesson['durationMinutes'] ?? 10}m',
          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
        ),
        onTap: () {
          setState(() => _currentLesson = lesson);
        },
      ),
    );
  }
}
