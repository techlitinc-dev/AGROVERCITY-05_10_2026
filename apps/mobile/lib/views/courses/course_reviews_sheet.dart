import 'package:flutter/material.dart';

import '../../api/courses_api.dart';
import '../../state/app_state.dart';

class CourseReviewsSheet extends StatefulWidget {
  const CourseReviewsSheet({
    super.key,
    required this.state,
    required this.courseId,
    this.api,
  });

  final AppState state;
  final String courseId;
  final CoursesApi? api;

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    required String courseId,
    CoursesApi? api,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CourseReviewsSheet(
        state: state,
        courseId: courseId,
        api: api,
      ),
    );
  }

  @override
  State<CourseReviewsSheet> createState() => _CourseReviewsSheetState();
}

class _CourseReviewsSheetState extends State<CourseReviewsSheet> {
  late final CoursesApi _api = widget.api ?? CoursesApi();
  List<Map<String, dynamic>> _reviews = [];
  bool _loading = true;
  int _userRating = 5;
  final _commentController = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final reviews = await _api.getReviews(widget.courseId);
      if (mounted) setState(() => _reviews = reviews);
    } catch (_) {} finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitReview() async {
    final comment = _commentController.text.trim();
    if (comment.isEmpty) {
      widget.state.showToast('Please enter your feedback');
      return;
    }
    setState(() => _submitting = true);
    try {
      await _api.addReview(
        widget.courseId,
        rating: _userRating,
        comment: comment,
      );
      _commentController.clear();
      widget.state.showToast('Review submitted!');
      await _load();
    } catch (e) {
      widget.state.showToast('Could not submit review: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.8,
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
                  'Student Reviews & Ratings',
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

          // Write Review Section
          Container(
            padding: const EdgeInsets.all(14),
            color: const Color(0xFFF8FAFC),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Rate this course:',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF475569),
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    for (int s = 1; s <= 5; s++)
                      IconButton(
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 32),
                        icon: Icon(
                          s <= _userRating
                              ? Icons.star_rounded
                              : Icons.star_border_rounded,
                          color: const Color(0xFFD97706),
                          size: 26,
                        ),
                        onPressed: () => setState(() => _userRating = s),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _commentController,
                        decoration: InputDecoration(
                          hintText: 'Share your experience with other farmers...',
                          hintStyle: const TextStyle(fontSize: 12),
                          filled: true,
                          fillColor: Colors.white,
                          isDense: true,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide:
                                const BorderSide(color: Color(0xFFCBD5E1)),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF1B4332),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 12),
                      ),
                      onPressed: _submitting ? null : _submitReview,
                      child: _submitting
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Post',
                              style: TextStyle(fontWeight: FontWeight.w900)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Reviews List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _reviews.isEmpty
                    ? const Center(
                        child: Text(
                          'No reviews yet. Be the first to review!',
                          style: TextStyle(color: Color(0xFF64748B)),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _reviews.length,
                        separatorBuilder: (_, _) =>
                            const Divider(height: 20, color: Color(0xFFF1F5F9)),
                        itemBuilder: (context, i) {
                          final r = _reviews[i];
                          final rating = (r['rating'] as num?)?.toInt() ?? 5;
                          final author =
                              r['userName'] as String? ?? 'Verified Student';
                          final comment = r['comment'] as String? ?? '';
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    author,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13,
                                      color: Color(0xFF1E293B),
                                    ),
                                  ),
                                  Row(
                                    children: [
                                      for (int s = 0; s < rating; s++)
                                        const Icon(
                                          Icons.star_rounded,
                                          size: 14,
                                          color: Color(0xFFD97706),
                                        ),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                comment,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  color: Color(0xFF475569),
                                  height: 1.4,
                                ),
                              ),
                            ],
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
