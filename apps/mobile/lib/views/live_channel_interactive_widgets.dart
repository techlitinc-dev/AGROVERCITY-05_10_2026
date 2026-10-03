// Interactive Live Channel Widgets: Pinned Announcement, Polls, Q&A,
// Broadcast Schedule, and Virtual Appreciation Gifts.

import 'package:flutter/material.dart';

import '../components/common/glass_card.dart';
import '../models/agri_live_channel.dart';

class PinnedAnnouncementBanner extends StatelessWidget {
  final String announcement;
  final bool isHost;
  final VoidCallback? onEdit;

  const PinnedAnnouncementBanner({
    super.key,
    required this.announcement,
    this.isHost = false,
    this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    if (announcement.isEmpty && !isHost) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFEF3C7), Color(0xFFFFFBEB)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: const Color(0xFFD97706),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.push_pin_rounded, size: 14, color: Colors.white),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Text(
                      "प्रसारक सूचना (Host Pin)",
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF92400E),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  announcement.isNotEmpty
                      ? announcement
                      : "कोणतीही घोषणा पिन केलेली नाही. नवीन सूचना पिन करण्यासाठी टॅप करा.",
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF78350F),
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          if (isHost && onEdit != null)
            IconButton(
              icon: const Icon(Icons.edit_note_rounded, size: 20, color: Color(0xFFB45309)),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
              onPressed: onEdit,
              tooltip: "घोषणा बदला",
            ),
        ],
      ),
    );
  }
}

class LivePollCard extends StatelessWidget {
  final LivePoll poll;
  final ValueChanged<int>? onVote;
  final bool isHost;

  const LivePollCard({
    super.key,
    required this.poll,
    this.onVote,
    this.isHost = false,
  });

  @override
  Widget build(BuildContext context) {
    final total = poll.totalVotes;

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: poll.isActive ? const Color(0xFFE8F5E9) : const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  poll.isActive ? "🔴 थेट मतदान (Active)" : "मतदान पूर्ण (Closed)",
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: poll.isActive ? const Color(0xFF2E7D32) : Colors.grey.shade700,
                  ),
                ),
              ),
              Text(
                "एकूण मते: $total",
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade600),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            poll.question,
            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
          ),
          const SizedBox(height: 12),
          ...poll.options.asMap().entries.map((entry) {
            final idx = entry.key;
            final opt = entry.value;
            final optVotes = poll.votes[idx.toString()] ?? 0;
            final percent = total > 0 ? (optVotes / total * 100).round() : 0;
            final isUserVoted = poll.userVotedOption == idx;
            final canVote = poll.isActive && poll.userVotedOption == null && onVote != null;

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: InkWell(
                onTap: canVote ? () => onVote!(idx) : null,
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isUserVoted ? const Color(0xFF2E7D32) : Colors.grey.shade300,
                      width: isUserVoted ? 1.8 : 1.0,
                    ),
                    color: isUserVoted ? const Color(0xFFF0FDF4) : Colors.white,
                  ),
                  child: Stack(
                    children: [
                      // Progress fill
                      FractionallySizedBox(
                        widthFactor: percent / 100.0 > 0 ? percent / 100.0 : 0.001,
                        child: Container(
                          height: 38,
                          decoration: BoxDecoration(
                            color: isUserVoted
                                ? const Color(0xFF86EFAC).withValues(alpha: 0.4)
                                : const Color(0xFFE5E7EB).withValues(alpha: 0.6),
                            borderRadius: BorderRadius.circular(9),
                          ),
                        ),
                      ),
                      // Text & %
                      Container(
                        height: 38,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Row(
                                children: [
                                  if (isUserVoted)
                                    const Padding(
                                      padding: EdgeInsets.only(right: 6),
                                      child: Icon(Icons.check_circle_rounded, size: 15, color: Color(0xFF15803D)),
                                    ),
                                  Expanded(
                                    child: Text(
                                      opt,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: isUserVoted ? FontWeight.w900 : FontWeight.w700,
                                        color: isUserVoted ? const Color(0xFF14532D) : const Color(0xFF1F2937),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              "$percent% ($optVotes)",
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: isUserVoted ? const Color(0xFF15803D) : Colors.grey.shade700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class LiveQuestionCard extends StatelessWidget {
  final LiveQuestion question;
  final VoidCallback? onUpvote;
  final VoidCallback? onMarkAnswered;
  final bool isHost;

  const LiveQuestionCard({
    super.key,
    required this.question,
    this.onUpvote,
    this.onMarkAnswered,
    this.isHost = false,
  });

  @override
  Widget build(BuildContext context) {
    final q = question;

    return GlassCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 14,
                backgroundColor: const Color(0xFF1B4332),
                child: Text(
                  q.userName.isNotEmpty ? q.userName[0].toUpperCase() : 'श',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFFE9C46A)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      q.userName,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF112A1F)),
                    ),
                    Text(
                      q.createdAt.isNotEmpty ? q.createdAt.split('T').first : 'आत्ताच विचारले',
                      style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
                    ),
                  ],
                ),
              ),
              if (q.isAnswered)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFF81C784)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle_rounded, size: 12, color: Color(0xFF2E7D32)),
                      SizedBox(width: 3),
                      Text("थेट उत्तर दिले", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Color(0xFF1B5E20))),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            q.questionText,
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF1F2937), height: 1.3),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              InkWell(
                onTap: onUpvote,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: q.userHasUpvoted ? const Color(0xFFEFF6FF) : const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: q.userHasUpvoted ? const Color(0xFF3B82F6) : Colors.transparent,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.thumb_up_alt_rounded,
                        size: 13,
                        color: q.userHasUpvoted ? const Color(0xFF2563EB) : Colors.grey.shade600,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        "${q.upvotesCount} समर्थन",
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: q.userHasUpvoted ? const Color(0xFF2563EB) : Colors.grey.shade700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (isHost && !q.isAnswered && onMarkAnswered != null)
                TextButton.icon(
                  onPressed: onMarkAnswered,
                  icon: const Icon(Icons.check_rounded, size: 14, color: Color(0xFF15803D)),
                  label: const Text(
                    "उत्तर दिले म्हणून नोंदवा",
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF15803D)),
                  ),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class ScheduledBroadcastCard extends StatelessWidget {
  final ScheduledBroadcast item;
  final VoidCallback? onToggleReminder;

  const ScheduledBroadcastCard({
    super.key,
    required this.item,
    this.onToggleReminder,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    item.channelName,
                    style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF1E40AF)),
                  ),
                ),
                const Spacer(),
                const Icon(Icons.calendar_today_rounded, size: 12, color: Colors.grey),
                const SizedBox(width: 4),
                Text(
                  item.scheduledStart,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF4B5563)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              item.programTitle,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
            ),
            const SizedBox(height: 4),
            Text(
              "विषय: ${item.topic}",
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            Text(
              "मार्गदर्शक: ${item.speakerName} (${item.speakerRole})",
              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF1B5E20)),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "🔔 ${item.reminderCount} शेतकऱ्यांनी स्मरणपत्र सेट केले",
                  style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
                ),
                ElevatedButton.icon(
                  onPressed: onToggleReminder,
                  icon: Icon(
                    item.hasReminder ? Icons.notifications_active_rounded : Icons.notifications_outlined,
                    size: 14,
                    color: item.hasReminder ? Colors.white : const Color(0xFF1B4332),
                  ),
                  label: Text(
                    item.hasReminder ? "स्मरणपत्र चालू" : "स्मरणपत्र द्या",
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: item.hasReminder ? Colors.white : const Color(0xFF1B4332),
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: item.hasReminder ? const Color(0xFF1B4332) : const Color(0xFFF3F4F6),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class SendGiftSheet extends StatefulWidget {
  final AgriLiveChannel channel;
  final Future<void> Function(String giftType, int coins, String note) onSend;

  const SendGiftSheet({
    super.key,
    required this.channel,
    required this.onSend,
  });

  @override
  State<SendGiftSheet> createState() => _SendGiftSheetState();
}

class _SendGiftSheetState extends State<SendGiftSheet> {
  String _selectedGift = 'green_sprout';
  int _coins = 5;
  final TextEditingController _noteController = TextEditingController();
  bool _submitting = false;

  final List<Map<String, dynamic>> _gifts = const [
    {
      'type': 'green_sprout',
      'label': 'हिरवे रोप (Green Sprout)',
      'coins': 5,
      'emoji': '🌱',
      'desc': 'कृषी प्रयत्नांना प्रोत्साहन द्या',
    },
    {
      'type': 'golden_wheat',
      'label': 'सुवर्ण गव्हाची ओंबी (Golden Wheat)',
      'coins': 25,
      'emoji': '🌾',
      'desc': 'उत्कृष्ट सल्ल्याबद्दल कौतुक',
    },
    {
      'type': 'tractor_salute',
      'label': 'ट्रॅक्टर सलामी (Tractor Salute)',
      'coins': 50,
      'emoji': '🚜',
      'desc': 'मार्गदर्शकाबद्दल सर्वोच्च आदर',
    },
  ];

  Future<void> _handleSend() async {
    setState(() => _submitting = true);
    try {
      await widget.onSend(_selectedGift, _coins, _noteController.text.trim());
      if (mounted) Navigator.pop(context);
    } catch (_) {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Text("🎁", style: TextStyle(fontSize: 18)),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "प्रसारक भेट व कौतुक",
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                        ),
                        Text(
                          widget.channel.currentSpeaker,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF1B5E20)),
                        ),
                      ],
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 14),
            const Text(
              "AgriCoin भेट निवडा:",
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF374151)),
            ),
            const SizedBox(height: 10),
            ..._gifts.map((g) {
              final isSel = _selectedGift == g['type'];
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: InkWell(
                  onTap: () => setState(() {
                    _selectedGift = g['type'] as String;
                    _coins = g['coins'] as int;
                  }),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isSel ? const Color(0xFFF0FDF4) : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSel ? const Color(0xFF15803D) : Colors.grey.shade200,
                        width: isSel ? 1.8 : 1.0,
                      ),
                    ),
                    child: Row(
                      children: [
                        Text(g['emoji'] as String, style: const TextStyle(fontSize: 24)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                g['label'] as String,
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                              ),
                              Text(
                                g['desc'] as String,
                                style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            "🪙 ${g['coins']} नाणी",
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF92400E)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
            const SizedBox(height: 10),
            TextField(
              controller: _noteController,
              decoration: InputDecoration(
                hintText: "प्रोत्साहनपर संदेश लिहा (पर्यायी)...",
                hintStyle: TextStyle(fontSize: 12, color: Colors.grey.shade400),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _submitting ? null : _handleSend,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B4332),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : Text(
                        "भेट पाठवा (🪙 $_coins AgriCoins)",
                        style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Colors.white),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AskQuestionSheet extends StatefulWidget {
  final Future<void> Function(String text) onSubmit;

  const AskQuestionSheet({super.key, required this.onSubmit});

  @override
  State<AskQuestionSheet> createState() => _AskQuestionSheetState();
}

class _AskQuestionSheetState extends State<AskQuestionSheet> {
  final TextEditingController _controller = TextEditingController();
  bool _submitting = false;

  Future<void> _handleSubmit() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await widget.onSubmit(text);
      if (mounted) Navigator.pop(context);
    } catch (_) {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.live_help_rounded, color: Color(0xFF1B4332), size: 22),
                  SizedBox(width: 8),
                  Text(
                    "प्रसारकाला प्रश्न विचारा (Live Q&A)",
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            "तुमचा प्रश्न इतर शेतकरी अपव्होट करू शकतात आणि वक्ते थेट उत्तर देतील.",
            style: TextStyle(fontSize: 11.5, color: Colors.grey),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _controller,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: "उदा. सोयाबीन काढणीनंतर रब्बीसाठी कोणती जात योग्य ठरेल?",
              hintStyle: TextStyle(fontSize: 12, color: Colors.grey.shade400),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _submitting ? null : _handleSubmit,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B4332),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text("प्रश्न विचारा (Submit Question)", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }
}
