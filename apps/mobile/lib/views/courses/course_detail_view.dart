// Course / podcast detail — buy with AgriCoins discount, Razorpay, or enter classroom.

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/api_exception.dart';
import '../../api/courses_api.dart';
import '../../core/razorpay_payment.dart';
import '../../state/app_state.dart';
import 'course_classroom_view.dart';
import 'course_qa_sheet.dart';
import 'course_reviews_sheet.dart';
import 'course_widgets.dart';

class CourseDetailView extends StatefulWidget {
  const CourseDetailView({
    super.key,
    required this.state,
    required this.courseId,
    this.api,
  });

  final AppState state;
  final String courseId;
  final CoursesApi? api;

  @override
  State<CourseDetailView> createState() => _CourseDetailViewState();
}

class _CourseDetailViewState extends State<CourseDetailView> {
  late final CoursesApi _api = widget.api ?? CoursesApi();
  Map<String, dynamic>? _course;
  bool _loading = true;
  bool _enrolling = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final course = await _api.getCourse(widget.courseId);
      if (mounted) setState(() => _course = course);
    } on ApiException catch (_) {
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openClassroom() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CourseClassroomView(
          state: widget.state,
          courseId: widget.courseId,
          api: _api,
        ),
      ),
    ).then((_) => _load());
  }

  void _openReviews() {
    CourseReviewsSheet.show(
      context,
      state: widget.state,
      courseId: widget.courseId,
      api: _api,
    ).then((_) => _load());
  }

  void _openQa() {
    CourseQaSheet.show(
      context,
      state: widget.state,
      courseId: widget.courseId,
      api: _api,
    );
  }

  Future<void> _openTrailer() async {
    final url = _course?['previewUrl'] as String? ??
        _course?['mediaUrl'] as String?;
    if (url == null || url.isEmpty) {
      widget.state.showToast('No preview available for this course');
      return;
    }
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _openEnrollCheckoutSheet() {
    final price = (_course?['priceRupees'] as num?)?.toDouble() ?? 0;
    final maxCoins = (_course?['maxCoinsDiscount'] as num?)?.toInt() ?? 0;
    final userCoins = widget.state.profile.agriCoins;
    final redeemableCoins = userCoins > maxCoins ? maxCoins : userCoins;

    bool useCoins = redeemableCoins > 0;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setSheetState) {
          final discount = useCoins ? redeemableCoins : 0;
          final finalPrice = (price - discount) > 0 ? (price - discount) : 0.0;

          return Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Confirm Course Enrollment',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Standard Course Fee:'),
                    Text('₹${price.round()}',
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                  ],
                ),
                if (redeemableCoins > 0) ...[
                  const SizedBox(height: 8),
                  CheckboxListTile(
                    title: Text(
                      'Redeem $redeemableCoins AgriCoins (Save ₹$redeemableCoins)',
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFD97706)),
                    ),
                    subtitle: Text('Balance: $userCoins coins available',
                        style: const TextStyle(fontSize: 11)),
                    value: useCoins,
                    contentPadding: EdgeInsets.zero,
                    onChanged: (v) =>
                        setSheetState(() => useCoins = v ?? false),
                  ),
                ],
                const Divider(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Final Amount to Pay:',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w900)),
                    Text('₹${finalPrice.round()}',
                        style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF1B4332))),
                  ],
                ),
                const SizedBox(height: 18),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF1B4332),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    _executeEnrollment(
                      useCoins: useCoins,
                      coinsRedeemed: useCoins ? redeemableCoins : 0,
                      finalPrice: finalPrice,
                    );
                  },
                  child: Text(
                    finalPrice == 0
                        ? 'Enroll Free Now ⚡'
                        : 'Proceed to Pay ₹${finalPrice.round()}',
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w900),
                  ),
                ),
                const SizedBox(height: 10),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _executeEnrollment({
    required bool useCoins,
    required int coinsRedeemed,
    required double finalPrice,
  }) async {
    setState(() => _enrolling = true);
    try {
      final res = await _api.enrollCourse(
        widget.courseId,
        useAgriCoins: useCoins,
        coinsRedeemed: coinsRedeemed,
      );
      if (!mounted) return;
      if (res['enrolled'] == true) {
        widget.state.showToast('Successfully enrolled in course! 🎉');
        _load();
        return;
      }
      final orderId = res['paymentOrderId'] as String?;
      if (orderId != null) {
        RazorpayPayment.open(
          orderId: orderId,
          amountPaise: (((res['amountDue'] as num?) ?? finalPrice) * 100).toInt(),
          contact: widget.state.profile.phone,
          onSuccess: (paymentId, signature) async {
            try {
              await _api.verifyPurchase(
                razorpayOrderId: orderId,
                razorpayPaymentId: paymentId,
                razorpaySignature: signature,
              );
              widget.state.showToast('Payment successful! Enrolled 🎉');
              _load();
            } catch (e) {
              widget.state.showToast('$e');
            }
          },
          onError: () =>
              widget.state.showToast(widget.state.tr('purchaseFailed')),
        );
      }
    } on ApiException catch (e) {
      widget.state.showToast(e.message.isNotEmpty ? e.message : e.code);
    } finally {
      if (mounted) setState(() => _enrolling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final course = _course;
    return Scaffold(
      backgroundColor: const Color(0xFFF6F8F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF112A1F)),
        title: Text(
          widget.state.tr('coursesTitle'),
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w900,
            color: Color(0xFF112A1F),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.forum_outlined, color: Color(0xFF1B4332)),
            tooltip: 'Q&A Forum',
            onPressed: _openQa,
          ),
        ],
      ),
      body: _loading || course == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.only(bottom: 40),
              children: [
                Stack(
                  alignment: Alignment.center,
                  children: [
                    courseArtwork(course, height: 210, iconSize: 64),
                    Positioned(
                      child: GestureDetector(
                        onTap: _openTrailer,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.75),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.play_circle_fill_rounded,
                                  color: Color(0xFF52B788), size: 22),
                              SizedBox(width: 6),
                              Text(
                                'Watch Trailer',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 12.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEDE9FE),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              course['category'] as String? ?? 'Agronomy',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF6D28D9),
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              course['level'] as String? ?? 'All Levels',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF15803D),
                              ),
                            ),
                          ),
                          const Spacer(),
                          GestureDetector(
                            onTap: _openReviews,
                            child: Row(
                              children: [
                                const Icon(Icons.star_rounded,
                                    size: 18, color: Color(0xFFD97706)),
                                const SizedBox(width: 2),
                                Text(
                                  '${((course['rating'] as num?) ?? 4.8).toStringAsFixed(1)} (${course['reviewsCount'] ?? 0})',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 12.5,
                                    color: Color(0xFF1E293B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        course['title'] as String? ?? '',
                        style: const TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF112A1F),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'By ${course['instructorName'] ?? 'Lead Agronomist'} • ${(course['totalDurationMinutes'] ?? 120)} mins • Verified ICAR Content',
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        course['description'] as String? ?? '',
                        style: const TextStyle(
                          fontSize: 13.5,
                          height: 1.5,
                          color: Color(0xFF334155),
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Curriculum Accordion
                      _curriculumSummary(course),
                      const SizedBox(height: 16),

                      // Instructor Card
                      _instructorCard(course),
                      const SizedBox(height: 20),

                      // Action Button Area
                      _actionArea(course),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _curriculumSummary(Map<String, dynamic> course) {
    final modules =
        (course['modules'] as List?)?.cast<Map<String, dynamic>>() ?? const [];
    int totalLessons = 0;
    for (final m in modules) {
      totalLessons += ((m['lessons'] as List?)?.length ?? 0);
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Syllabus & Curriculum',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1E293B),
                ),
              ),
              Text(
                '${modules.length} Modules • $totalLessons Lessons',
                style:
                    const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          for (final m in modules.take(3))
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_outline_rounded,
                      size: 15, color: Color(0xFF15803D)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      m['title'] as String? ?? 'Module',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
          if (modules.length > 3)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '+ ${modules.length - 3} more comprehensive sections',
                style: const TextStyle(
                    fontSize: 11,
                    fontStyle: FontStyle.italic,
                    color: Color(0xFF64748B)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _instructorCard(Map<String, dynamic> course) {
    final instructor = course['instructorName'] as String? ?? 'Lead Expert';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: const Color(0xFF1B4332),
            child: Text(
              instructor.isNotEmpty ? instructor[0] : 'I',
              style: const TextStyle(
                  color: Color(0xFFE9C46A), fontWeight: FontWeight.w900),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      instructor,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.verified_rounded,
                        size: 14, color: Color(0xFF2563EB)),
                  ],
                ),
                const Text(
                  'Verified Instructor • Agrovercity Faculty',
                  style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionArea(Map<String, dynamic> course) {
    final isOwner = course['isOwner'] == true;
    final isPurchased =
        course['isPurchased'] == true || course['isEnrolled'] == true;
    final price = (course['priceRupees'] as num?)?.toDouble() ?? 0;

    if (isOwner) {
      return Center(
        child: Text(
          widget.state.tr('ownCourseLabel'),
          style: const TextStyle(
              fontWeight: FontWeight.w800, color: Color(0xFF64748B)),
        ),
      );
    }

    if (isPurchased) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF1B4332),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: _openClassroom,
            icon: const Icon(Icons.school_rounded),
            label: const Text(
              'Enter Interactive Classroom 🎓',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF1B4332),
              side: const BorderSide(color: Color(0xFF1B4332)),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: _openReviews,
            icon: const Icon(Icons.rate_review_outlined, size: 16),
            label: const Text('Write Review / Feedback'),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF1B4332),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          onPressed: _enrolling ? null : _openEnrollCheckoutSheet,
          icon: _enrolling
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.bolt_rounded),
          label: Text(
            price == 0
                ? widget.state.tr('enrollFree')
                : 'Enroll Now — ₹${price.round()}',
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.monetization_on_outlined,
                size: 14, color: Color(0xFFD97706)),
            const SizedBox(width: 4),
            Text(
              'Save up to ₹${course['maxCoinsDiscount'] ?? 100} with AgriCoins',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: Color(0xFFD97706),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
