// ज्ञान सेतु: Krishi Gyan Media Hub (API-wired port: /v1/workshops + enroll
// with coin redeem + Razorpay, /v1/expert-talks + register + questions,
// /v1/videos, /v1/blogs + bookmark/like).

import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../api/gyan_api.dart';
import '../core/razorpay_payment.dart';
import '../models/gyan_models.dart';
import '../state/app_state.dart';
import 'courses/ad_banner_widget.dart';
import 'courses/courses_view.dart';
import 'gyan_hub_header_widgets.dart';
import 'gyan_hub_media_sheets.dart';
import 'gyan_hub_sheets.dart';
import 'gyan_hub_tabs.dart';

class GyanHubView extends StatefulWidget {
  final AppState state;
  final GyanApi? gyanApi;

  // Tests pass false so video_player is never touched off-device.
  final bool enableVideo;

  const GyanHubView({
    super.key,
    required this.state,
    this.gyanApi,
    this.enableVideo = true,
  });

  @override
  State<GyanHubView> createState() => _GyanHubViewState();
}

class _GyanHubViewState extends State<GyanHubView> {
  late final GyanApi _api = widget.gyanApi ?? GyanApi();

  int _selectedTab = 0; // 0: Workshops, 1: Expert Talks, 2: Videos, 3: Blogs
  final _questionController = TextEditingController();

  List<PaidWorkshop> _workshops = const [];
  List<ExpertTalk> _talks = const [];
  List<VideoGuide> _videos = const [];
  List<BlogArticle> _blogs = const [];
  bool _loading = true;
  final Set<String> _registeredTalks = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _questionController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    List<PaidWorkshop> workshops = const [];
    List<ExpertTalk> talks = const [];
    List<VideoGuide> videos = const [];
    List<BlogArticle> blogs = const [];
    try {
      workshops = await _api.listWorkshops();
    } catch (_) {}
    try {
      talks = await _api.listTalks();
    } catch (_) {}
    try {
      videos = await _api.listVideos();
    } catch (_) {}
    try {
      blogs = await _api.listBlogs();
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _workshops = workshops;
      _talks = talks;
      _videos = videos;
      _blogs = blogs;
      _loading = false;
    });
  }

  Future<void> _refreshWorkshops() async {
    try {
      final workshops = await _api.listWorkshops();
      if (!mounted) return;
      setState(() => _workshops = workshops);
    } catch (_) {}
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(SnackBar(content: Text(message)));
  }

  void _openWorkshopDetail(PaidWorkshop ws) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => WorkshopEnrollSheet(
        workshop: ws,
        state: widget.state,
        coinBalance: widget.state.profile.agriCoins,
        onEnroll: (useCoins, coins) => _enroll(ws, useCoins, coins),
      ),
    );
  }

  Future<void> _enroll(PaidWorkshop ws, bool useCoins, int coinsToRedeem) async {
    try {
      final res = await _api.enrollWorkshop(
        ws.id,
        useCoins: useCoins,
        coinsToRedeem: coinsToRedeem,
      );
      if (!mounted) return;
      if (res['enrolled'] == true) {
        setState(() => ws.isEnrolled = true);
        _snack(widget.state.tr('gyanHub.enrollSuccess'));
        return;
      }
      final orderId = res['paymentOrderId'] as String?;
      if (orderId != null) {
        RazorpayPayment.open(
          orderId: orderId,
          amountPaise: (((res['amountDue'] as num?) ?? 0) * 100).toInt(),
          contact: widget.state.profile.phone,
          onSuccess: (_, _) {
            _snack(widget.state.tr('gyanHub.paymentSuccess'));
            _refreshWorkshops();
          },
          onError: () => _snack(widget.state.tr('purchaseFailed')),
        );
      }
    } on ApiException catch (e) {
      _snack(switch (e.code) {
        'ALREADY_ENROLLED' => widget.state.tr('gyanHub.alreadyEnrolled'),
        'INSUFFICIENT_COINS' => widget.state.tr('gyanHub.insufficientCoins'),
        'WORKSHOP_FULL' => widget.state.tr('gyanHub.seatsFull'),
        _ => e.message.isNotEmpty ? e.message : e.code,
      });
    }
  }

  Future<void> _registerTalk(ExpertTalk talk) async {
    try {
      await _api.registerTalk(talk.id);
      if (!mounted) return;
      setState(() => _registeredTalks.add(talk.id));
      _snack(widget.state.tr('gyanHub.coinsEarned').replaceAll('{coins}', '25'));
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'ALREADY_REGISTERED') {
        setState(() => _registeredTalks.add(talk.id));
        _snack(e.message.isNotEmpty ? e.message : widget.state.tr('gyanHub.alreadyRegistered'));
      } else {
        _snack(e.message.isNotEmpty ? e.message : e.code);
      }
    }
  }

  void _askScientistDialog(ExpertTalk talk) {
    showDialog(
      context: context,
      builder: (ctx) => AskQuestionDialog(
        talk: talk,
        state: widget.state,
        controller: _questionController,
        onSubmit: () {
          final question = _questionController.text.trim();
          Navigator.pop(ctx);
          _submitQuestion(talk, question);
        },
      ),
    );
  }

  Future<void> _submitQuestion(ExpertTalk talk, String question) async {
    _questionController.clear();
    try {
      await _api.askQuestion(talk.id, question);
      _snack(widget.state.tr('gyanHub.questionSent'));
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  void _playVideoModal(VideoGuide vid) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) =>
          VideoPlayerModal(video: vid, state: widget.state, enableVideo: widget.enableVideo),
    );
  }

  Future<void> _toggleBookmark(BlogArticle blog) async {
    try {
      final bookmarked = await _api.toggleBookmark(blog.id);
      if (!mounted) return;
      setState(() => blog.isBookmarked = bookmarked);
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  Future<void> _likeBlog(BlogArticle blog) async {
    try {
      final likes = await _api.likeBlog(blog.id);
      if (!mounted) return;
      setState(() => blog.likesCount = likes);
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Banner
          GyanHubHeaderBanner(state: widget.state),
          const SizedBox(height: 12),

          // Platform Sponsored Ad Banner
          const AdBannerWidget(placement: 'home_hero'),

          // Online Course Superstore Action Card
          InkWell(
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => CoursesView(state: widget.state),
              ),
            ),
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1B4332), Color(0xFF2D6A4F)],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.school_rounded,
                        color: Color(0xFFE9C46A), size: 24),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Online Course Superstore 🎓',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Browse certified masterclasses & learn anytime',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.arrow_forward_ios_rounded,
                      color: Colors.white, size: 14),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Sub-Tab Switcher (4 Tabs)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                GyanHubTabButton(
                  selected: _selectedTab == 0,
                  label: "🎓 ${widget.state.tr('gyanHub.tabWorkshops')} (${_workshops.length})",
                  onTap: () => setState(() => _selectedTab = 0),
                ),
                GyanHubTabButton(
                  selected: _selectedTab == 1,
                  label: "🎙️ ${widget.state.tr('gyanHub.tabExpertTalks')} (${_talks.length})",
                  onTap: () => setState(() => _selectedTab = 1),
                ),
                GyanHubTabButton(
                  selected: _selectedTab == 2,
                  label: "🎬 ${widget.state.tr('gyanHub.tabVideos')} (${_videos.length})",
                  onTap: () => setState(() => _selectedTab = 2),
                ),
                GyanHubTabButton(
                  selected: _selectedTab == 3,
                  label: "📰 ${widget.state.tr('gyanHub.tabBlogs')} (${_blogs.length})",
                  onTap: () => setState(() => _selectedTab = 3),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: CircularProgressIndicator(color: Color(0xFF1B4332)),
              ),
            )
          else
            GyanHubTabContent(
              selectedTab: _selectedTab,
              state: widget.state,
              workshops: _workshops,
              talks: _talks,
              videos: _videos,
              blogs: _blogs,
              registeredTalks: _registeredTalks,
              onOpenWorkshop: _openWorkshopDetail,
              onRegisterTalk: _registerTalk,
              onAskQuestion: _askScientistDialog,
              onPlayVideo: _playVideoModal,
              onToggleBookmark: _toggleBookmark,
              onLikeBlog: _likeBlog,
            ),
        ],
      ),
    );
  }
}
