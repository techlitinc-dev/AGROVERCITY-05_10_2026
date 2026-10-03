// Farmer-facing course & podcast storefront (browse / search / filter / ads).

import 'package:flutter/material.dart';

import '../../api/courses_api.dart';
import '../../state/app_state.dart';
import 'ad_banner_widget.dart';
import 'course_detail_view.dart';
import 'course_widgets.dart';
import 'my_library_view.dart';

class CoursesView extends StatefulWidget {
  const CoursesView({super.key, required this.state, this.api});

  final AppState state;
  final CoursesApi? api;

  @override
  State<CoursesView> createState() => _CoursesViewState();
}

class _CoursesViewState extends State<CoursesView> {
  late final CoursesApi _api = widget.api ?? CoursesApi();
  final _search = TextEditingController();
  List<Map<String, dynamic>> _courses = [];
  String? _category;
  bool _loading = true;

  static const categories = [
    null,
    'Agronomy',
    'Organic Farming',
    'Dairy & Livestock',
    'Polyhouse & Hydroponics',
    'AgTech & Drones',
    'Agri Business',
  ];

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    try {
      final courses = await _api.browseCourses(
        category: _category,
        search: _search.text.trim(),
      );
      if (mounted) setState(() => _courses = courses);
    } catch (_) {
      // Keep previous data when offline.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F8F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          widget.state.tr('coursesTitle'),
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w900,
            color: Color(0xFF112A1F),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.library_books_rounded,
                color: Color(0xFF1B4332)),
            tooltip: widget.state.tr('myLibraryK'),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                  builder: (_) => MyLibraryView(state: widget.state)),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Sponsored Promotion Banner
          const AdBannerWidget(placement: 'course_banner'),

          // Search Box
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
            child: TextField(
              controller: _search,
              onChanged: (_) => _refresh(),
              decoration: InputDecoration(
                hintText: widget.state.tr('searchCourses'),
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                isDense: true,
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),

          // Category Chips
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              children: [
                for (final c in categories)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(c ?? widget.state.tr('allKinds')),
                      selected: _category == c,
                      onSelected: (_) {
                        setState(() => _category = c);
                        _refresh();
                      },
                    ),
                  ),
              ],
            ),
          ),

          // Course Cards List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _refresh,
                    child: _courses.isEmpty
                        ? ListView(
                            children: [
                              const SizedBox(height: 120),
                              Center(
                                child: Text(
                                  widget.state.tr('noDataAvailable'),
                                  style: const TextStyle(
                                      color: Color(0xFF64748B)),
                                ),
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(14),
                            itemCount: _courses.length,
                            itemBuilder: (context, i) =>
                                _courseCard(_courses[i]),
                          ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _courseCard(Map<String, dynamic> course) {
    final isFeatured = course['isFeatured'] == true;
    final isPurchased =
        course['isPurchased'] == true || course['isEnrolled'] == true;
    final rating = (course['rating'] as num?)?.toDouble() ?? 4.8;
    final maxDiscount = (course['maxCoinsDiscount'] as num?)?.toInt() ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CourseDetailView(
                state: widget.state,
                courseId: course['id'] as String,
              ),
            ),
          );
          _refresh();
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(18)),
              child: Stack(
                alignment: Alignment.topRight,
                children: [
                  courseArtwork(course),
                  if (isFeatured)
                    Container(
                      margin: const EdgeInsets.all(8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE9C46A),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        '★ Featured',
                        style: TextStyle(
                            fontSize: 9.5, fontWeight: FontWeight.w900),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          course['category'] as String? ?? 'General',
                          style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF475569)),
                        ),
                      ),
                      Row(
                        children: [
                          const Icon(Icons.star_rounded,
                              size: 14, color: Color(0xFFD97706)),
                          const SizedBox(width: 2),
                          Text(
                            rating.toStringAsFixed(1),
                            style: const TextStyle(
                                fontSize: 11, fontWeight: FontWeight.w900),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    course['title'] as String? ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 14),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${course['instructorName'] as String? ?? 'Lead Expert'} • ${(course['totalDurationMinutes'] ?? 90)} mins',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Text(
                            coursePriceLabel(widget.state, course),
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 15,
                              color: Color(0xFF1B4332),
                            ),
                          ),
                          if (maxDiscount > 0) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 5, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF3C7),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                'Save ₹$maxDiscount',
                                style: const TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFFB45309),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (isPurchased)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'Enrolled ✓',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF15803D),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
