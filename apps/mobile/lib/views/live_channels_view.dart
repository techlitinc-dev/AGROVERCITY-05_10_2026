// Farmer Live Channels — Live Streaming & Agri Broadcasts
// (API-wired: GET /v1/channels, HLS via video_player, Live Chat with
// 5s poll + 2s rate limit, Interactive Polls, Live Q&A with Upvoting,
// Broadcaster Pin Announcements, Virtual Appreciation Gifts, and Broadcast Schedules).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../api/api_exception.dart';
import '../api/content_api.dart';
import '../components/common/audio_button.dart';
import '../components/common/motion_animations.dart';
import '../models/agri_live_channel.dart';
import '../state/app_state.dart';
import 'live_channel_host_dialogs.dart';
import 'live_channel_interactive_widgets.dart';
import 'live_channel_widgets.dart';
import 'live_player_box.dart';

class LiveChannelsView extends StatefulWidget {
  final AppState state;
  final ContentApi? contentApi;

  // Tests pass false so video_player is never touched off-device.
  final bool enableVideo;

  const LiveChannelsView({
    super.key,
    required this.state,
    this.contentApi,
    this.enableVideo = true,
  });

  @override
  State<LiveChannelsView> createState() => _LiveChannelsViewState();
}

class _LiveChannelsViewState extends State<LiveChannelsView> {
  late final ContentApi _api = widget.contentApi ?? ContentApi();

  List<AgriLiveChannel> _channels = const [];
  AgriLiveChannel? _activeChannel;
  bool _loading = true;
  bool _isPlaying = true;
  bool _streamError = false;
  bool _rateLimited = false;

  int _selectedSubTab = 0; // 0: Chat, 1: Polls, 2: Q&A, 3: Gift, 4: Schedule
  List<LivePoll> _polls = const [];
  List<LiveQuestion> _questions = const [];
  List<ScheduledBroadcast> _schedules = const [];

  final TextEditingController _chatController = TextEditingController();
  List<ChatMessage> _chat = const [];

  VideoPlayerController? _videoController;
  Timer? _chatPoll;
  Timer? _channelRefresh;

  @override
  void initState() {
    super.initState();
    _load();
    _chatPoll = Timer.periodic(const Duration(seconds: 5), (_) => _loadChat());
    _channelRefresh =
        Timer.periodic(const Duration(seconds: 60), (_) => _refreshChannels());
  }

  @override
  void dispose() {
    _chatPoll?.cancel();
    _channelRefresh?.cancel();
    _chatController.dispose();
    _videoController?.dispose();
    final active = _activeChannel;
    if (active != null) {
      unawaited(_api.postChat(active.id, '', left: true).catchError((_) => <String, dynamic>{}));
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final channels = await _api.listChannels();
      List<ScheduledBroadcast> schedules = const [];
      try {
        schedules = await _api.listBroadcastSchedules();
      } catch (_) {}

      if (!mounted) return;
      setState(() {
        _channels = channels;
        _schedules = schedules;
        _loading = false;
      });
      if (channels.isNotEmpty) {
        await _openChannel(channels.first);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _channels = const [];
        _loading = false;
      });
    }
  }

  Future<void> _refreshChannels() async {
    try {
      final channels = await _api.listChannels();
      if (!mounted) return;
      final active = _activeChannel;
      AgriLiveChannel? updatedActive;
      if (active != null) {
        for (final c in channels) {
          if (c.id == active.id) updatedActive = c;
        }
      }
      setState(() {
        _channels = channels;
        if (updatedActive != null) _activeChannel = updatedActive;
      });
    } catch (_) {}
  }

  Future<void> _openChannel(AgriLiveChannel channel) async {
    final prev = _activeChannel;
    if (prev != null && prev.id == channel.id) return;
    setState(() {
      _activeChannel = channel;
      _streamError = false;
      _chat = const [];
    });
    if (prev != null) {
      unawaited(_api.postChat(prev.id, '', left: true).catchError((_) => <String, dynamic>{}));
    }
    unawaited(
        _api.postChat(channel.id, '', joined: true).catchError((_) => <String, dynamic>{}));
    await _loadChat();
    await _loadInteractions(channel.id);
    if (widget.enableVideo) {
      await _initVideo(channel);
    }
  }

  Future<void> _loadInteractions(String channelId) async {
    try {
      final polls = await _api.listPolls(channelId);
      final questions = await _api.listQuestions(channelId);
      if (!mounted || _activeChannel?.id != channelId) return;
      setState(() {
        _polls = polls;
        _questions = questions;
      });
    } catch (_) {}
  }

  Future<void> _initVideo(AgriLiveChannel channel) async {
    final old = _videoController;
    setState(() => _videoController = null);
    await old?.dispose();
    if (channel.streamUrl.isEmpty) {
      if (mounted) setState(() => _streamError = true);
      return;
    }
    final controller =
        VideoPlayerController.networkUrl(Uri.parse(channel.streamUrl));
    try {
      await controller.initialize();
      if (!mounted || _activeChannel?.id != channel.id) {
        await controller.dispose();
        return;
      }
      await controller.play();
      setState(() {
        _videoController = controller;
        _streamError = false;
      });
    } catch (_) {
      await controller.dispose();
      if (mounted) setState(() => _streamError = true);
    }
  }

  Future<void> _loadChat() async {
    final active = _activeChannel;
    if (active == null) return;
    try {
      final messages = await _api.getChat(active.id);
      if (!mounted || _activeChannel?.id != active.id) return;
      setState(() => _chat = messages);
    } catch (_) {}
  }

  Future<void> _sendChatMessage() async {
    final active = _activeChannel;
    final text = _chatController.text.trim();
    if (active == null || text.isEmpty) return;
    try {
      await _api.postChat(active.id, text);
      if (!mounted) return;
      _chatController.clear();
      setState(() => _rateLimited = false);
      await _loadChat();
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'CHAT_RATE_LIMITED') {
        setState(() => _rateLimited = true);
      } else {
        widget.state.showToast(e.message.isNotEmpty ? e.message : e.code);
      }
    }
  }

  Future<void> _votePoll(String pollId, int optionIndex) async {
    final active = _activeChannel;
    if (active == null) return;
    try {
      final updated = await _api.votePoll(active.id, pollId, optionIndex);
      if (!mounted) return;
      setState(() {
        _polls = _polls.map((p) => p.id == updated.id ? updated : p).toList();
      });
      widget.state.showToast("मतदान यशस्वीरीत्या नोंदवले गेले!");
    } catch (_) {}
  }

  Future<void> _createPoll(String question, List<String> options) async {
    final active = _activeChannel;
    if (active == null) return;
    try {
      final newPoll = await _api.createPoll(active.id, question: question, options: options);
      if (!mounted) return;
      setState(() {
        _polls = [newPoll, ..._polls];
      });
      widget.state.showToast("नवीन मतदान सुरू झाले!");
    } catch (_) {}
  }

  Future<void> _askQuestion(String text) async {
    final active = _activeChannel;
    if (active == null) return;
    try {
      final newQ = await _api.askQuestion(active.id, text);
      if (!mounted) return;
      setState(() {
        _questions = [newQ, ..._questions];
      });
      widget.state.showToast("प्रश्न विचारला गेला! वक्ते थेट उत्तर देतील.");
    } catch (_) {}
  }

  Future<void> _upvoteQuestion(String questionId) async {
    final active = _activeChannel;
    if (active == null) return;
    try {
      await _api.upvoteQuestion(active.id, questionId);
      final updated = await _api.listQuestions(active.id);
      if (!mounted) return;
      setState(() => _questions = updated);
    } catch (_) {}
  }

  Future<void> _answerQuestion(String questionId) async {
    final active = _activeChannel;
    if (active == null) return;
    try {
      await _api.answerQuestion(active.id, questionId);
      final updated = await _api.listQuestions(active.id);
      if (!mounted) return;
      setState(() => _questions = updated);
      widget.state.showToast("प्रश्न उत्तरित म्हणून नोंदवला गेला.");
    } catch (_) {}
  }

  Future<void> _setPinAnnouncement(String text) async {
    final active = _activeChannel;
    if (active == null) return;
    try {
      await _api.pinAnnouncement(active.id, text);
      if (!mounted) return;
      setState(() {
        _activeChannel = AgriLiveChannel(
          id: active.id,
          channelName: active.channelName,
          broadcaster: active.broadcaster,
          programTitle: active.programTitle,
          currentSpeaker: active.currentSpeaker,
          liveViewersCount: active.liveViewersCount,
          isLiveNow: active.isLiveNow,
          category: active.category,
          streamThumbnail: active.streamThumbnail,
          streamUrl: active.streamUrl,
          scheduleTime: active.scheduleTime,
          pinnedAnnouncement: text,
          isBroadcasterHost: active.isBroadcasterHost,
        );
      });
      widget.state.showToast(text.isNotEmpty ? "सूचना पिन केली गेली!" : "पिन सूचना हटवली गेली.");
    } catch (_) {}
  }

  Future<void> _sendGift(String giftType, int coins, String note) async {
    final active = _activeChannel;
    if (active == null) return;
    try {
      await _api.sendGift(active.id, giftType: giftType, coins: coins, note: note);
      widget.state.showToast("🎁 भेट यशस्वीपणे पाठवली! (🪙 $coins AgriCoins)");
    } catch (_) {
      widget.state.showToast("भेट पाठवण्यात त्रुटी आली.");
    }
  }

  Future<void> _toggleScheduleReminder(ScheduledBroadcast item) async {
    try {
      await _api.toggleScheduleReminder(item.id);
      final updated = await _api.listBroadcastSchedules();
      if (!mounted) return;
      setState(() => _schedules = updated);
      widget.state.showToast(item.hasReminder ? "स्मरणपत्र बंद केले" : "स्मरणपत्र सेट केले!");
    } catch (_) {}
  }

  void _openSendGiftSheet() {
    final active = _activeChannel;
    if (active == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SendGiftSheet(
        channel: active,
        onSend: _sendGift,
      ),
    );
  }

  void _openAskQuestionSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => AskQuestionSheet(onSubmit: _askQuestion),
    );
  }

  void _openSetPinDialog() {
    final active = _activeChannel;
    if (active == null) return;
    showDialog(
      context: context,
      builder: (ctx) => SetPinDialog(
        initialText: active.pinnedAnnouncement,
        onSave: _setPinAnnouncement,
      ),
    );
  }

  void _openCreatePollDialog() {
    showDialog(
      context: context,
      builder: (ctx) => CreatePollDialog(onSubmit: _createPoll),
    );
  }

  void _togglePlay() {
    final c = _videoController;
    setState(() => _isPlaying = !_isPlaying);
    if (c != null && c.value.isInitialized) {
      _isPlaying ? c.play() : c.pause();
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = _activeChannel;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Header Bar
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.live_tv_rounded, color: Color(0xFFE11D48), size: 22),
                      SizedBox(width: 6),
                      Text(
                        "शेतकरी लाईव्ह चॅनेल्स",
                        style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                      ),
                    ],
                  ),
                  Text(
                    "थेट कृषी प्रक्षेपण, मंडी लिलाव व शास्त्रज्ञ संवाद",
                    style: TextStyle(fontSize: 11.5, color: Colors.grey, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              AudioButton(text: "शेतकरी लाईव्ह चॅनेल्स मध्ये आपले स्वागत आहे. येथे डीडी किसान, कृषी विज्ञान केंद्र आणि थेट मंडी लिलाव प्रक्षेपण सुरू आहे."),
            ],
          ),
          const SizedBox(height: 14),

          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: CircularProgressIndicator(color: Color(0xFFE11D48)),
              ),
            )
          else if (active == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(
                child: Text("कोणतीही वाहिनी उपलब्ध नाही", style: TextStyle(fontSize: 13, color: Colors.grey, fontWeight: FontWeight.w700)),
              ),
            )
          else ...[
            // 2. Main Live Video Player Box
            StaggeredSlideFade(
              delayMs: 0,
              child: LivePlayerBox(
                channel: active,
                isPlaying: _isPlaying,
                controller: _videoController,
                streamError: _streamError,
                onTogglePlay: _togglePlay,
                onRetry: () => _initVideo(active),
                onVolume: () => widget.state.showToast("आवाज चालू आहे"),
                onFullscreen: () => widget.state.showToast("फुल स्क्रीन मोड सुरू"),
              ),
            ),
            const SizedBox(height: 12),

            // 3. Channel Info Details
            ChannelInfoCard(channel: active),
            const SizedBox(height: 10),

            // 4. Host Pinned Announcement Banner
            PinnedAnnouncementBanner(
              announcement: active.pinnedAnnouncement,
              isHost: active.isBroadcasterHost,
              onEdit: _openSetPinDialog,
            ),

            // 5. Quick Interactive Action Bar
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _openSendGiftSheet,
                    icon: const Text("🎁", style: TextStyle(fontSize: 14)),
                    label: const Text("कौतुक भेट", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFEF3C7),
                      foregroundColor: const Color(0xFF92400E),
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _openAskQuestionSheet,
                    icon: const Icon(Icons.help_outline_rounded, size: 15),
                    label: const Text("प्रश्न विचारा", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFE8F5E9),
                      foregroundColor: const Color(0xFF1B5E20),
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                if (active.isBroadcasterHost) ...[
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: _openCreatePollDialog,
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: const Icon(Icons.poll_rounded, size: 18, color: Color(0xFF1B4332)),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 14),

            // 6. Interactive Sub-Navigation Switcher
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Row(
                children: [
                  _subTabPill(0, "💬 थेट चर्चा"),
                  _subTabPill(1, "📊 मतदान (${_polls.length})"),
                  _subTabPill(2, "❓ प्रश्नोत्तरे (${_questions.length})"),
                  _subTabPill(3, "🎁 भेट पाठवा"),
                  _subTabPill(4, "📅 वेळापत्रक (${_schedules.length})"),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // 7. Active Sub-Tab Body
            if (_selectedSubTab == 0) ...[
              LiveChatBox(
                messages: _chat,
                controller: _chatController,
                rateLimited: _rateLimited,
                onSend: _sendChatMessage,
              ),
            ] else if (_selectedSubTab == 1) ...[
              if (_polls.isEmpty)
                _emptyCard(
                  icon: Icons.poll_outlined,
                  title: "सध्या कोणतेही मतदान चालू नाही",
                  subtitle: "प्रसारक थेट मतदान सुरू केल्यास येथे पर्याय दिसतील.",
                )
              else
                ..._polls.map((p) => LivePollCard(
                      poll: p,
                      isHost: active.isBroadcasterHost,
                      onVote: (optIdx) => _votePoll(p.id, optIdx),
                    )),
            ] else if (_selectedSubTab == 2) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "शेतकऱ्यांचे प्रश्न (${_questions.length})",
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                  ),
                  TextButton.icon(
                    onPressed: _openAskQuestionSheet,
                    icon: const Icon(Icons.add, size: 14, color: Color(0xFF15803D)),
                    label: const Text("नवीन प्रश्न", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF15803D))),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              if (_questions.isEmpty)
                _emptyCard(
                  icon: Icons.question_answer_outlined,
                  title: "अद्याप कोणताही प्रश्न विचारला नाही",
                  subtitle: "कृषी तज्ज्ञांना पहिला प्रश्न विचारून चर्चा सुरू करा!",
                )
              else
                ..._questions.map((q) => LiveQuestionCard(
                      question: q,
                      isHost: active.isBroadcasterHost,
                      onUpvote: () => _upvoteQuestion(q.id),
                      onMarkAnswered: () => _answerQuestion(q.id),
                    )),
            ] else if (_selectedSubTab == 3) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  children: [
                    const Text("🌱", style: TextStyle(fontSize: 36)),
                    const SizedBox(height: 8),
                    const Text(
                      "प्रसारक व कृषी शास्त्रज्ञांचा सन्मान करा",
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF112A1F)),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      "तुमच्या आवडत्या वक्त्यांना AgriCoins द्वारे व्हर्च्युअल भेट पाठवून त्यांचा उत्साह वाढवा.",
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 11.5, color: Colors.grey),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1B4332),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: _openSendGiftSheet,
                      child: const Text("आत्ताच भेट पाठवा (Send Gift)"),
                    ),
                  ],
                ),
              ),
            ] else if (_selectedSubTab == 4) ...[
              if (_schedules.isEmpty)
                _emptyCard(
                  icon: Icons.calendar_month_outlined,
                  title: "कोणतेही आगामी प्रसारण शेड्यूल केलेले नाही",
                  subtitle: "नवीन कृषी वेबिनार वेळापत्रक लवकरच जाहीर केले जाईल.",
                )
              else
                ..._schedules.map((sc) => ScheduledBroadcastCard(
                      item: sc,
                      onToggleReminder: () => _toggleScheduleReminder(sc),
                    )),
            ],
            const SizedBox(height: 18),

            // 8. All Live Channels List
            const Text(
              "उपलब्ध थेट कृषी वाहिन्या (All Channels)",
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
            ),
            const SizedBox(height: 10),
            ..._channels.map((ch) => ChannelListTile(
                  channel: ch,
                  isCurrent: active.id == ch.id,
                  onTap: () => _openChannel(ch),
                )),
          ],
        ],
      ),
    );
  }

  Widget _subTabPill(int idx, String label) {
    final isSel = _selectedSubTab == idx;
    return GestureDetector(
      onTap: () => setState(() => _selectedSubTab = idx),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFF1B4332) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSel ? const Color(0xFF1B4332) : Colors.grey.shade300,
            width: isSel ? 1.5 : 1.0,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: isSel ? FontWeight.w900 : FontWeight.w700,
            color: isSel ? Colors.white : const Color(0xFF374151),
          ),
        ),
      ),
    );
  }

  Widget _emptyCard({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Icon(icon, size: 36, color: Colors.grey.shade400),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF374151))),
          const SizedBox(height: 4),
          Text(subtitle, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
        ],
      ),
    );
  }
}
