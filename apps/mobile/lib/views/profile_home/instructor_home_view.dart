// Instructor Studio home — KPIs, course creator, student roster, profile and ads.

import 'package:flutter/material.dart';

import '../../api/courses_api.dart';
import '../../state/app_state.dart';
import '../courses/ad_campaign_sheet.dart';
import '../courses/course_builder_sheet.dart';
import '../courses/course_widgets.dart';
import '../courses/teacher_profile_sheet.dart';
import '../courses/teacher_student_roster_sheet.dart';

class InstructorHomeView extends StatefulWidget {
  const InstructorHomeView({super.key, required this.state, this.api});

  final AppState state;
  final CoursesApi? api;

  @override
  State<InstructorHomeView> createState() => _InstructorHomeViewState();
}

class _InstructorHomeViewState extends State<InstructorHomeView> {
  late final CoursesApi _api = widget.api ?? CoursesApi();
  List<Map<String, dynamic>> _courses = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    try {
      final courses = await _api.myCourses();
      if (mounted) setState(() => _courses = courses);
    } catch (_) {
      // Offline / backend unavailable — keep previous data.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int get _totalSales =>
      _courses.fold(0, (sum, c) => sum + ((c['salesCount'] as num?) ?? 0).toInt());

  double get _totalEarnings => _courses.fold(
      0.0, (sum, c) => sum + ((c['instructorEarningsRupees'] as num?) ?? 0));

  Future<void> _openBuilder() async {
    await CourseBuilderSheet.show(
      context,
      state: widget.state,
      api: _api,
      onSaved: _refresh,
    );
  }

  Future<void> _openStudents() async {
    await TeacherStudentRosterSheet.show(context, state: widget.state);
  }

  Future<void> _openProfile() async {
    await TeacherProfileSheet.show(context, state: widget.state);
  }

  Future<void> _openAds() async {
    await AdCampaignSheet.show(context, state: widget.state);
  }

  Future<void> _deleteCourse(Map<String, dynamic> course) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(widget.state.tr('deleteCourseConfirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(widget.state.tr('cancel')),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626)),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(widget.state.tr('deleteK')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _api.deleteCourse(course['id'] as String);
      widget.state.showToast(widget.state.tr('deleteK'));
      await _refresh();
    } catch (e) {
      widget.state.showToast('$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final meta = widget.state.activeProfileMeta;
    return Scaffold(
      backgroundColor: const Color(0xFFF6F8F5),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Studio Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                        colors: [meta.primaryColor, meta.accentColor]),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(Icons.school_rounded,
                      color: Colors.white, size: 26),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.state.tr('instructorStudio'),
                          style: const TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF112A1F))),
                      Text(
                        widget.state.profile.name,
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Teacher Profile',
                  icon: const Icon(Icons.manage_accounts_rounded,
                      color: Color(0xFF1B4332)),
                  onPressed: _openProfile,
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Top KPIs
            Row(
              children: [
                _kpi(widget.state.tr('totalCoursesK'), '${_courses.length}'),
                _kpi(widget.state.tr('salesCountK'), '$_totalSales'),
                _kpi('₹${_totalEarnings.round()}',
                    widget.state.tr('earningsK')),
              ],
            ),
            const SizedBox(height: 14),

            // Quick Studio Actions Grid
            Row(
              children: [
                Expanded(
                  child: _studioActionCard(
                    icon: Icons.add_circle_outline_rounded,
                    title: 'New Course',
                    subtitle: 'Curriculum Builder',
                    color: const Color(0xFF1B4332),
                    onTap: _openBuilder,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _studioActionCard(
                    icon: Icons.people_outline_rounded,
                    title: 'Students',
                    subtitle: 'Roster & Certs',
                    color: const Color(0xFF2563EB),
                    onTap: _openStudents,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _studioActionCard(
                    icon: Icons.campaign_outlined,
                    title: 'Ad Manager',
                    subtitle: 'Promote Course',
                    color: const Color(0xFFD97706),
                    onTap: _openAds,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Courses List Section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  widget.state.tr('myCoursesK'),
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF112A1F),
                  ),
                ),
                TextButton(
                  onPressed: _openBuilder,
                  child: const Text('+ Add Course',
                      style: TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 12)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_courses.isEmpty)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Text(
                    widget.state.tr('noCoursesYet'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Color(0xFF64748B)),
                  ),
                ),
              )
            else
              for (final course in _courses) ...[
                _courseTile(course),
                const SizedBox(height: 10),
              ],
          ],
        ),
      ),
    );
  }

  Widget _kpi(String value, String label) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 3),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          children: [
            Text(value,
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF7C3AED))),
            const SizedBox(height: 2),
            Text(label,
                style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
          ],
        ),
      ),
    );
  }

  Widget _studioActionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 4),
            Text(
              title,
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 12,
                color: color,
              ),
            ),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 9.5,
                color: Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _courseTile(Map<String, dynamic> course) {
    final status = course['status'] as String? ?? 'pendingReview';
    final kind = course['kind'] as String? ?? 'videoPodcast';
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFF7C3AED).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(courseKindIcon(kind), color: const Color(0xFF7C3AED)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(course['title'] as String? ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 13.5)),
                const SizedBox(height: 3),
                Row(
                  children: [
                    courseStatusChip(widget.state, status),
                    const SizedBox(width: 6),
                    Text(
                      '${coursePriceLabel(widget.state, course)} • ${(course['salesCount'] as num?) ?? 0} ${widget.state.tr('salesCountK')}',
                      style: const TextStyle(
                          fontSize: 10.5, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
                if (status == 'rejected' &&
                    (course['rejectedReason'] as String?)?.isNotEmpty == true)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '${widget.state.tr('statusRejected')}: ${course['rejectedReason']}',
                      style: const TextStyle(
                          fontSize: 10.5, color: Color(0xFFDC2626)),
                    ),
                  ),
              ],
            ),
          ),
          if (status != 'published')
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded,
                  size: 20, color: Color(0xFFDC2626)),
              onPressed: () => _deleteCourse(course),
            ),
        ],
      ),
    );
  }
}
