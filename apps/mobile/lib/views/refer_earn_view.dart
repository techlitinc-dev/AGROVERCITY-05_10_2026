// Refer & Earn (रेफर करा व नाणी कमवा) — fully API-backed via ReferralApi.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_exception.dart';
import '../api/referral_api.dart';
import '../components/common/audio_button.dart';
import '../components/common/glass_card.dart';
import '../components/common/motion_animations.dart';
import '../models/referral.dart';
import '../state/app_state.dart';

class ReferEarnView extends StatefulWidget {
  final AppState state;
  final ReferralApi? api;

  const ReferEarnView({super.key, required this.state, this.api});

  @override
  State<ReferEarnView> createState() => _ReferEarnViewState();
}

class _ReferEarnViewState extends State<ReferEarnView> {
  late final ReferralApi _api = widget.api ?? ReferralApi();

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();

  ReferralSummary? _summary;
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final summary = await _api.get();
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _summary = null;
        _loading = false;
        _error = true;
      });
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  // --- Share helpers -------------------------------------------------------

  Future<void> _shareWhatsApp() async {
    await _launchShare('whatsapp://send?text=');
  }

  Future<void> _shareSms() async {
    await _launchShare('sms:?body=');
  }

  Future<void> _launchShare(String schemePrefix) async {
    final summary = _summary;
    final text = Uri.encodeComponent(
      '${summary?.shareMessage ?? ''} ${summary?.shareLink ?? ''}'.trim(),
    );
    try {
      final uri = Uri.parse('$schemePrefix$text');
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        _snack('शेअर करता आले नाही');
      }
    } catch (_) {
      _snack('शेअर करता आले नाही');
    }
    // Every share also offers logging the invite so coins get awarded.
    _openInviteDialog();
  }

  Future<void> _copyLink() async {
    final link = _summary?.shareLink ?? '';
    if (link.isEmpty) return;
    try {
      await Clipboard.setData(ClipboardData(text: link));
      _snack('🔗 लिंक कॉपी झाली');
    } catch (_) {
      _snack('लिंक कॉपी करता आली नाही');
    }
    _openInviteDialog();
  }

  Future<void> _copyCode() async {
    final code = _summary?.referralCode ?? '';
    if (code.isEmpty) return;
    try {
      await Clipboard.setData(ClipboardData(text: code));
      _snack('📋 कोड कॉपी झाला: $code');
    } catch (_) {
      _snack('कोड कॉपी करता आला नाही');
    }
  }

  // --- Invite dialog -------------------------------------------------------

  String _normalizePhone(String raw) {
    final trimmed = raw.trim();
    final digits = trimmed.replaceAll(RegExp(r'\D'), '');
    if (digits.length == 10) return '+91$digits';
    if (digits.length == 12 && digits.startsWith('91')) return '+$digits';
    if (trimmed.startsWith('+')) return '+$digits';
    return trimmed;
  }

  bool _isValidPhone(String phone) =>
      RegExp(r'^\+91\d{10}$').hasMatch(phone);

  void _openInviteDialog() {
    _nameController.clear();
    _phoneController.clear();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFFFEF3C7),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.person_add_alt_1_rounded,
                color: Color(0xFFD97706),
                size: 22,
              ),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'मित्राचे नाव व मोबाइल जोडा',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF112A1F),
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'मित्राचे नाव',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _nameController,
              decoration: InputDecoration(
                hintText: 'उदा. राम शिंदे',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'मोबाइल क्रमांक',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                prefixText: '+91 ',
                hintText: '98221 00000',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('रद्द करा'),
          ),
          ElevatedButton(
            onPressed: () => _submitInvite(ctx),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1B4332),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text(
              'आमंत्रण पाठवा (+100 नाणी)',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submitInvite(BuildContext ctx) async {
    final name = _nameController.text.trim();
    final phone = _normalizePhone(_phoneController.text);
    if (name.isEmpty) {
      _snack('कृपया मित्राचे नाव टाका');
      return;
    }
    if (!_isValidPhone(phone)) {
      _snack('वैध १० अंकी मोबाइल क्रमांक टाका');
      return;
    }
    Navigator.pop(ctx);
    try {
      final result = await _api.invite(name: name, phone: phone);
      if (!mounted) return;
      _mergeInvite(result);
      _snack('+${result.agriCoinsEarned} शेती नाणी मिळाली! 🎉');
    } on ApiException catch (e) {
      if (e.code == 'ALREADY_INVITED') {
        _snack('ही संख्या आधीच आमंत्रित आहे');
      } else if (e.fieldErrors['phone'] != null) {
        _snack('${e.fieldErrors['phone']}');
      } else {
        _snack(e.message.isNotEmpty ? e.message : 'आमंत्रण पाठवता आले नाही');
      }
    } catch (_) {
      _snack('आमंत्रण पाठवता आले नाही, पुन्हा प्रयत्न करा');
    }
  }

  // Merges the partial invite payload into the cached summary so the list,
  // stats and milestones update immediately without a full reload.
  void _mergeInvite(InviteResult result) {
    final s = _summary;
    if (s == null) return;
    setState(() {
      _summary = ReferralSummary(
        referralCode:
            result.referralCode.isNotEmpty ? result.referralCode : s.referralCode,
        shareLink: result.shareLink.isNotEmpty ? result.shareLink : s.shareLink,
        shareMessage: result.shareMessage.isNotEmpty
            ? result.shareMessage
            : s.shareMessage,
        stats: result.stats ?? s.stats,
        milestones:
            result.milestones.isNotEmpty ? result.milestones : s.milestones,
        referred: [
          if (result.invite != null) result.invite!,
          ...s.referred,
        ],
        leaderboard: s.leaderboard,
        myRank: s.myRank,
      );
    });
  }

  // --- Build ---------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 60),
          child: CircularProgressIndicator(color: Color(0xFFCA8A04)),
        ),
      );
    }

    if (_error) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 60),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'माहिती आणता आली नाही',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 10),
              ElevatedButton(
                onPressed: _load,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B4332),
                  foregroundColor: Colors.white,
                ),
                child: const Text('पुन्हा प्रयत्न करा'),
              ),
            ],
          ),
        ),
      );
    }

    final summary = _summary;
    if (summary == null) return const SizedBox.shrink();

    return RefreshIndicator(
      color: const Color(0xFFCA8A04),
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            const SizedBox(height: 14),
            StaggeredSlideFade(delayMs: 0, child: _buildHero(summary)),
            const SizedBox(height: 16),
            StaggeredSlideFade(delayMs: 80, child: _buildMilestones(summary)),
            const SizedBox(height: 16),
            StaggeredSlideFade(
              delayMs: 160,
              child: _buildReferredList(summary),
            ),
            const SizedBox(height: 16),
            StaggeredSlideFade(
              delayMs: 240,
              child: _buildLeaderboard(summary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.card_giftcard_rounded,
                  color: Color(0xFFCA8A04),
                  size: 22,
                ),
                SizedBox(width: 6),
                Text(
                  'रेफर करा व नाणी कमवा',
                  style: TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF112A1F),
                  ),
                ),
              ],
            ),
            Text(
              'शेतकरी मित्रांना जोडून मोफत खत व सवलत मिळवा',
              style: TextStyle(
                fontSize: 11.5,
                color: Colors.grey,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        AudioButton(
          text:
              'शेतकरी मित्र जोडा आणि कमवा योजनेत आपले स्वागत आहे. प्रत्येक मित्राला जोडल्यावर शंभर कृषी नाणी मिळतात.',
          state: widget.state,
        ),
      ],
    );
  }

  Widget _buildHero(ReferralSummary summary) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF713F12), Color(0xFF854D0E), Color(0xFFCA8A04)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFCA8A04).withValues(alpha: 0.35),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'तुमचा वैयक्तिक रेफरल कोड',
                style: TextStyle(
                  fontSize: 12,
                  color: Color(0xFFFEF3C7),
                  fontWeight: FontWeight.w700,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'एकूण नाणी: ${summary.stats.totalEarnedCoins} 🪙',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: const Color(0xFFFEF08A),
                width: 1.2,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  summary.referralCode,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: 2.0,
                  ),
                ),
                BouncyPressable(
                  onTap: _copyCode,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.copy_rounded,
                      size: 16,
                      color: Color(0xFF713F12),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _heroStatBox('आमंत्रित', '${summary.stats.invited}'),
              const SizedBox(width: 8),
              _heroStatBox('सामील', '${summary.stats.joined}'),
              const SizedBox(width: 8),
              _heroStatBox('कमाई', '${summary.stats.totalEarnedCoins} 🪙'),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _shareWhatsApp,
                  icon: const Icon(
                    Icons.share_rounded,
                    size: 15,
                    color: Colors.white,
                  ),
                  label: const Text(
                    'WhatsApp शेअर',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 11.5,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _copyLink,
                  icon: const Icon(
                    Icons.link_rounded,
                    size: 15,
                    color: Color(0xFF713F12),
                  ),
                  label: const Text(
                    'Link कॉपी करा',
                    style: TextStyle(
                      color: Color(0xFF713F12),
                      fontWeight: FontWeight.w900,
                      fontSize: 11.5,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFEF08A),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _shareSms,
                  icon: const Icon(
                    Icons.sms_rounded,
                    size: 15,
                    color: Colors.white,
                  ),
                  label: const Text(
                    'SMS पाठवा',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 11.5,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4338CA),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroStatBox(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                color: Colors.white.withValues(alpha: 0.85),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMilestones(ReferralSummary summary) {
    final joined = summary.stats.joined;
    final next = summary.milestones
        .where((m) => !m.achieved)
        .fold<ReferralMilestone?>(null, (a, m) => a ?? m);

    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '🏆 रेफरल बक्षीस टप्पे (Milestones)',
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w900,
              color: Color(0xFF112A1F),
            ),
          ),
          const SizedBox(height: 10),
          ...summary.milestones.map((m) {
            final progress = m.count <= 0
                ? 1.0
                : (joined / m.count).clamp(0.0, 1.0);
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                children: [
                  Icon(
                    m.achieved
                        ? Icons.check_circle_rounded
                        : Icons.lock_outline_rounded,
                    size: 18,
                    color: m.achieved
                        ? const Color(0xFFE9C46A)
                        : Colors.grey.shade500,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '${m.count} शेतकरी',
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w800,
                                color: m.achieved
                                    ? const Color(0xFF112A1F)
                                    : Colors.grey.shade600,
                              ),
                            ),
                            Text(
                              '+${m.rewardCoins} नाणी',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: m.achieved
                                    ? const Color(0xFF15803D)
                                    : Colors.grey.shade500,
                              ),
                            ),
                          ],
                        ),
                        if (!m.achieved)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: progress,
                                minHeight: 4,
                                backgroundColor: Colors.grey.shade300,
                                valueColor: const AlwaysStoppedAnimation(
                                  Color(0xFFCA8A04),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
          if (next != null) ...[
            const SizedBox(height: 6),
            Text(
              'प्रगती: $joined/${next.count}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: Color(0xFF92400E),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildReferredList(ReferralSummary summary) {
    final referred = summary.referred;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'माझे रेफरल्स (${referred.length})',
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w900,
                color: Color(0xFF112A1F),
              ),
            ),
            Text(
              '+${summary.stats.totalEarnedCoins} नाणी',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w900,
                color: Color(0xFF15803D),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (referred.isEmpty)
          GlassCard(
            padding: const EdgeInsets.all(18),
            child: Column(
              children: [
                Text(
                  '🌾',
                  style: TextStyle(fontSize: 30, color: Colors.grey.shade400),
                ),
                const SizedBox(height: 6),
                const Text(
                  'अजून एकही मित्र जोडलेला नाही',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF112A1F),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'WhatsApp द्वारे आमंत्रण पाठवा आणि +100 नाणी कमवा',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade600,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          )
        else
          ...referred.map((ref) {
            final dateRaw = ref.joinedAt ?? ref.invitedAt;
            final date = DateTime.tryParse(dateRaw);
            final joined = ref.isJoined;
            return GlassCard(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: joined
                        ? const Color(0xFFE8F5E9)
                        : const Color(0xFFF3F4F6),
                    radius: 18,
                    child: Text(
                      ref.name.isEmpty ? '?' : ref.name.substring(0, 1),
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        color: joined
                            ? const Color(0xFF1B5E20)
                            : Colors.grey.shade600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ref.name,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF112A1F),
                          ),
                        ),
                        Text(
                          [
                            ref.phone,
                            if (date != null)
                              DateFormat('dd MMM').format(date),
                          ].join(' • '),
                          style: TextStyle(
                            fontSize: 10.5,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: joined
                          ? const Color(0xFFDCFCE7)
                          : const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      joined ? 'सामील' : 'आमंत्रित',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w900,
                        color: joined
                            ? const Color(0xFF15803D)
                            : Colors.grey.shade600,
                      ),
                    ),
                  ),
                  if (joined) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '+${ref.rewardCoins} 🪙',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF92400E),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildLeaderboard(ReferralSummary summary) {
    const medals = ['🥇', '🥈', '🥉'];
    final top = summary.leaderboard.take(10).toList();
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '🏆 लीडरबोर्ड (शीर्ष 10)',
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w900,
              color: Color(0xFF112A1F),
            ),
          ),
          const SizedBox(height: 10),
          if (top.isEmpty)
            Text(
              'अजून लीडरबोर्ड रिकामा आहे',
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
            )
          else
            ...top.map((entry) {
              final isTop3 = entry.rank >= 1 && entry.rank <= 3;
              final row = Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: entry.isMe
                      ? const Color(0xFFE9C46A).withValues(alpha: 0.12)
                      : const Color(0xFFF9FAFB),
                  borderRadius: BorderRadius.circular(12),
                  border: entry.isMe
                      ? Border.all(color: const Color(0xFFE9C46A), width: 1.4)
                      : null,
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 28,
                      child: Text(
                        isTop3 ? medals[entry.rank - 1] : '#${entry.rank}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            entry.isMe
                                ? '${entry.name} (तुम्ही)'
                                : entry.name,
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF112A1F),
                            ),
                          ),
                          if (entry.village.isNotEmpty)
                            Text(
                              entry.village,
                              style: TextStyle(
                                fontSize: 10.5,
                                color: Colors.grey.shade600,
                              ),
                            ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1B4332),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${entry.referralCount} रेफरल',
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              );
              return row;
            }),
          if (summary.myRank != null) ...[
            const SizedBox(height: 6),
            Center(
              child: Text(
                'तुमचा क्रमांक: #${summary.myRank!.rank}',
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF92400E),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
