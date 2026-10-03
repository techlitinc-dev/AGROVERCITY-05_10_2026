// Krishi Ratna (कृषि रत्न) — gamification, wallet & rewards store (API-wired).

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart' hide Badge;
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../api/api_exception.dart';
import '../api/gamification_api.dart';
import '../components/common/audio_button.dart';
import '../components/common/glass_card.dart';
import '../components/common/motion_animations.dart';
import '../models/gamification.dart';
import '../state/app_state.dart';

const _weekdayLabels = ['सोम', 'मंगळ', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'];

const _reasonLabels = {
  'diary_entry': 'डायरी एंट्री',
  'referral': 'रेफरल',
  'referral_milestone': 'रेफरल मैलस्टोन',
  'redeem': 'रिडीम',
  'expert_talk': 'तज्ज्ञ बोलणी',
  'course_enroll': 'कोर्स',
  'workshop_enroll': 'कार्यशाळा',
  'equipment_booking': 'यंत्र बुकिंग',
};

String _reasonLabel(String reason) => _reasonLabels[reason] ?? 'इतर';

class KrishiRatnaView extends StatefulWidget {
  final AppState state;
  final GamificationApi? api;

  const KrishiRatnaView({super.key, required this.state, this.api});

  @override
  State<KrishiRatnaView> createState() => _KrishiRatnaViewState();
}

class _KrishiRatnaViewState extends State<KrishiRatnaView> {
  static const int _historyPageSize = 20;
  static const int _chartPageSize = 100;

  late final GamificationApi _api = widget.api ?? GamificationApi();

  GamificationStatus? _status;
  List<LedgerEntry> _ledger = [];
  int _ledgerPage = 0;
  int _ledgerTotal = 0;
  bool _loadingMore = false;
  List<LedgerEntry> _chartEntries = [];
  List<Reward> _rewards = [];
  CoinsLeaderboard? _leaderboard;
  String _period = 'all';
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = false;
      });
    }
    try {
      final results = await Future.wait<dynamic>([
        _api.status(),
        _api.ledger(page: 1, pageSize: _historyPageSize),
        _api.ledger(page: 1, pageSize: _chartPageSize),
        _api.rewards(),
        _api.leaderboard(period: _period),
      ]);
      if (!mounted) return;
      setState(() {
        _status = results[0] as GamificationStatus;
        final page = results[1] as LedgerPage;
        _ledger = page.data;
        _ledgerPage = page.page;
        _ledgerTotal = page.total;
        _chartEntries = (results[2] as LedgerPage).data;
        _rewards = results[3] as List<Reward>;
        _leaderboard = results[4] as CoinsLeaderboard;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = true;
      });
    }
  }

  Future<void> _loadMoreLedger() async {
    if (_loadingMore) return;
    setState(() => _loadingMore = true);
    try {
      final next = await _api.ledger(
        page: _ledgerPage + 1,
        pageSize: _historyPageSize,
      );
      if (!mounted) return;
      setState(() {
        final seen = _ledger.map((e) => e.id).toSet();
        _ledger = [
          ..._ledger,
          ...next.data.where((e) => !seen.contains(e.id)),
        ];
        _ledgerPage = next.page;
        _ledgerTotal = next.total;
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
      _snack('इतिहास आणता आला नाही');
    }
  }

  Future<void> _selectPeriod(String period) async {
    setState(() => _period = period);
    try {
      final lb = await _api.leaderboard(period: period);
      if (!mounted || _period != period) return;
      setState(() => _leaderboard = lb);
    } catch (_) {
      _snack('लीडरबोर्ड आणता आला नाही');
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  // --- Redeem --------------------------------------------------------------

  Future<void> _redeem(Reward reward) async {
    final balance = _status?.agriCoins ?? 0;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
        ),
        title: Text(
          '${reward.icon} ${reward.title}',
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w900,
            color: Color(0xFF112A1F),
          ),
        ),
        content: Text(
          '${reward.coinsCost} 🪙 नाणी रिडीम करायची?\nसध्याची शिल्लक: $balance 🪙',
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('रद्द करा'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1B4332),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text(
              'होय, रिडीम करा',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      final result = await _api.redeem(
        rewardType: reward.type,
        coins: reward.coinsCost,
      );
      if (!mounted) return;
      await _showRedeemSuccess(result);
      _loadAll(silent: true);
    } on ApiException catch (e) {
      if (e.code == 'INSUFFICIENT_COINS') {
        _snack('पुरेशी नाणी नाहीत');
      } else {
        _snack(e.message.isNotEmpty ? e.message : 'रिडीम करता आले नाही');
      }
    } catch (_) {
      _snack('रिडीम करता आले नाही, पुन्हा प्रयत्न करा');
    }
  }

  Future<void> _showRedeemSuccess(RedeemResult result) {
    return showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
        ),
        title: const Row(
          children: [
            Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A)),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'रिडीम यशस्वी! 🎉',
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
          children: [
            const Text(
              'तुमचा व्हाउचर कोड:',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE9C46A), width: 1.2),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Text(
                      result.voucherCode,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.2,
                        color: Color(0xFF92400E),
                      ),
                    ),
                  ),
                  BouncyPressable(
                    onTap: () async {
                      try {
                        await Clipboard.setData(
                          ClipboardData(text: result.voucherCode),
                        );
                        if (ctx.mounted) Navigator.pop(ctx);
                        _snack('📋 व्हाउचर कोड कॉपी झाला');
                      } catch (_) {
                        _snack('कोड कॉपी करता आला नाही');
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.copy_rounded,
                        size: 16,
                        color: Color(0xFF92400E),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'नवीन शिल्लक: ${result.balance} 🪙',
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w900,
                color: Color(0xFF15803D),
              ),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1B4332),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text(
              'ठीक आहे',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }

  // --- Weekly chart --------------------------------------------------------

  List<double> _weeklySums() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final sums = List<double>.filled(7, 0);
    for (final e in _chartEntries) {
      if (e.amount <= 0) continue;
      final dt = DateTime.tryParse(e.at);
      if (dt == null) continue;
      final day = DateTime(dt.year, dt.month, dt.day);
      final diff = today.difference(day).inDays;
      if (diff >= 0 && diff < 7) sums[6 - diff] += e.amount;
    }
    return sums;
  }

  List<String> _weekLabels() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return List.generate(
      7,
      (i) => _weekdayLabels[
          today.subtract(Duration(days: 6 - i)).weekday - 1],
    );
  }

  // --- Build ---------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    if (_loading) return _buildSkeleton();

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
                onPressed: _loadAll,
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

    final status = _status;
    if (status == null) return const SizedBox.shrink();

    return RefreshIndicator(
      color: const Color(0xFF1B4332),
      onRefresh: _loadAll,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(status),
            const SizedBox(height: 14),
            StaggeredSlideFade(delayMs: 0, child: _buildBalanceHero(status)),
            const SizedBox(height: 12),
            StaggeredSlideFade(
              delayMs: 60,
              child: _buildStreakCard(status.dailyStreak),
            ),
            const SizedBox(height: 12),
            StaggeredSlideFade(delayMs: 120, child: _buildStatsRow(status)),
            const SizedBox(height: 16),
            StaggeredSlideFade(delayMs: 180, child: _buildWeeklyChart()),
            const SizedBox(height: 16),
            StaggeredSlideFade(delayMs: 240, child: _buildBadges(status)),
            const SizedBox(height: 16),
            StaggeredSlideFade(delayMs: 300, child: _buildRewardsStore(status)),
            const SizedBox(height: 16),
            StaggeredSlideFade(delayMs: 360, child: _buildLedgerHistory()),
            const SizedBox(height: 16),
            StaggeredSlideFade(delayMs: 420, child: _buildLeaderboard()),
          ],
        ),
      ),
    );
  }

  Widget _buildSkeleton() {
    Widget box(double height) => Container(
          height: height,
          margin: const EdgeInsets.only(bottom: 14),
          decoration: BoxDecoration(
            color: Colors.grey.shade200,
            borderRadius: BorderRadius.circular(20),
          ),
        );
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(children: [box(150), box(80), box(110), box(200), box(220)]),
    );
  }

  Widget _buildHeader(GamificationStatus status) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'कृषि रत्न व पुरस्कार वॉलेट',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            Text(
              'स्तर • स्ट्रीक • बॅज्ज • बक्षिसे',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
        AudioButton(
          text:
              'कृषि रत्न वॉलेटमध्ये तुमचे ${status.agriCoins} अग्रीसिक्के आहेत. यांच्यावर खत वाउचर, माती परीक्षण व तज्ज्ञ कॉल रिडीम करा.',
          state: widget.state,
        ),
      ],
    );
  }

  Widget _buildBalanceHero(GamificationStatus status) {
    final level = status.level;
    final nextTier = level.nextTier;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1B4332), Color(0xFF2D6A4F)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1B4332).withValues(alpha: 0.35),
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
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFE9C46A),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  'स्तर: ${level.title}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF112A1F),
                  ),
                ),
              ),
              const Text(
                'अग्रीसिक्के',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFFD8F3DC),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${status.agriCoins}',
                style: const TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFFE9C46A),
                ),
              ),
              const SizedBox(width: 6),
              const Padding(
                padding: EdgeInsets.only(bottom: 6),
                child: Text('🪙', style: TextStyle(fontSize: 22)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: (level.progressPct / 100).clamp(0.0, 1.0),
              minHeight: 8,
              backgroundColor: Colors.white.withValues(alpha: 0.2),
              valueColor: const AlwaysStoppedAnimation(Color(0xFFE9C46A)),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            nextTier != null
                ? 'आणखी ${level.coinsToNextTier} नाणी पुढील स्तरासाठी ($nextTier)'
                : 'तुम्ही कमाल स्तरावर आहात! 🏆',
            style: const TextStyle(
              fontSize: 11.5,
              color: Color(0xFFD8F3DC),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStreakCard(StreakInfo streak) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: const BoxDecoration(
              color: Color(0xFFFFEDD5),
              shape: BoxShape.circle,
            ),
            child: const Text('🔥', style: TextStyle(fontSize: 24)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'स्ट्रीक',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Colors.grey.shade600,
                  ),
                ),
                Text(
                  '${streak.current} दिवस',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFFEA580C),
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: 1,
            height: 36,
            color: Colors.grey.shade300,
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'सर्वाधिक',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Colors.grey.shade600,
                ),
              ),
              Text(
                '${streak.longest} दिवस',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF112A1F),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow(GamificationStatus status) {
    Widget stat(String label, String value, Color color) => Expanded(
          child: GlassCard(
            margin: const EdgeInsets.symmetric(horizontal: 3),
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
            borderRadius: 16,
            child: Column(
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w700,
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ),
        );
    final s = status.stats;
    return Row(
      children: [
        stat('एकूण कमाई', '${s.coinsEarnedTotal}', const Color(0xFF15803D)),
        stat('डायरी एंट्री', '${s.diaryEntries}', const Color(0xFF112A1F)),
        stat('रेफरल्स', '${s.referrals}', const Color(0xFF4338CA)),
        stat('रिडीम', '${s.redeems}', const Color(0xFF92400E)),
      ],
    );
  }

  Widget _buildWeeklyChart() {
    final sums = _weeklySums();
    final labels = _weekLabels();
    final hasData = sums.any((v) => v > 0);
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '📊 गेल्या ७ दिवसांची कमाई',
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w900,
              color: Color(0xFF112A1F),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 200,
            child: !hasData
                ? Center(
                    child: Text(
                      'या आठवड्यात अजून नाणी मिळाली नाहीत',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: Colors.grey.shade600,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  )
                : BarChart(
                    BarChartData(
                      barGroups: [
                        for (var i = 0; i < 7; i++)
                          BarChartGroupData(
                            x: i,
                            barRods: [
                              BarChartRodData(
                                toY: sums[i],
                                width: 16,
                                color: sums[i] > 0
                                    ? const Color(0xFF2D6A4F)
                                    : Colors.grey.shade300,
                                borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(6),
                                ),
                              ),
                            ],
                          ),
                      ],
                      borderData: FlBorderData(show: false),
                      gridData: const FlGridData(show: false),
                      barTouchData: BarTouchData(enabled: false),
                      titlesData: FlTitlesData(
                        leftTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        topTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        rightTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            getTitlesWidget: (value, meta) {
                              final i = value.toInt();
                              if (i < 0 || i >= labels.length) {
                                return const SizedBox.shrink();
                              }
                              return Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  labels[i],
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildBadges(GamificationStatus status) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '🎖️ बॅज्ज',
          style: TextStyle(
            fontSize: 14.5,
            fontWeight: FontWeight.w900,
            color: Color(0xFF112A1F),
          ),
        ),
        const SizedBox(height: 10),
        GridView.count(
          key: const ValueKey('krishiBadgeGrid'),
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 0.92,
          children: status.badges.map(_badgeCard).toList(),
        ),
      ],
    );
  }

  Widget _badgeCard(Badge badge) {
    final earnedAt = DateTime.tryParse(badge.earnedAt ?? '');
    final content = Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: badge.earned
              ? const [Color(0xFFE8F5E9), Color(0xFFC8E6C9)]
              : [Colors.grey.shade100, Colors.grey.shade200],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: badge.earned ? const Color(0xFF81C784) : Colors.grey.shade300,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(badge.icon, style: const TextStyle(fontSize: 26)),
          const SizedBox(height: 6),
          Text(
            badge.title,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w900,
              color: badge.earned
                  ? const Color(0xFF112A1F)
                  : Colors.grey.shade700,
            ),
          ),
          const SizedBox(height: 2),
          Expanded(
            child: Text(
              badge.description,
              style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (badge.earned && earnedAt != null)
            Text(
              DateFormat('dd MMM yy').format(earnedAt),
              style: TextStyle(fontSize: 9.5, color: Colors.grey.shade600),
            )
          else if (!badge.earned)
            Text(
              '${badge.progress}/${badge.target}',
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w900,
                color: Colors.grey.shade600,
              ),
            ),
        ],
      ),
    );
    return badge.earned ? content : Opacity(opacity: 0.4, child: content);
  }

  Widget _buildRewardsStore(GamificationStatus status) {
    final balance = status.agriCoins;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '🎁 बक्षिसे स्टोर',
          style: TextStyle(
            fontSize: 14.5,
            fontWeight: FontWeight.w900,
            color: Color(0xFF112A1F),
          ),
        ),
        const SizedBox(height: 10),
        if (_rewards.isEmpty)
          Text(
            'सध्या बक्षिसे उपलब्ध नाहीत',
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
          )
        else
          ..._rewards.map((reward) {
            final canRedeem = reward.available && balance >= reward.coinsCost;
            return GlassCard(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Text(
                      reward.icon,
                      style: const TextStyle(fontSize: 22),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          reward.title,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF112A1F),
                          ),
                        ),
                        if (reward.description.isNotEmpty)
                          Text(
                            reward.description,
                            style: TextStyle(
                              fontSize: 10.5,
                              color: Colors.grey.shade600,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: canRedeem ? () => _redeem(reward) : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFE9C46A),
                      foregroundColor: const Color(0xFF112A1F),
                      disabledBackgroundColor: Colors.grey.shade300,
                      disabledForegroundColor: Colors.grey.shade500,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                    ),
                    child: Text(
                      '${reward.coinsCost} 🪙 रिडीम करा',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildLedgerHistory() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '💰 नाणी इतिहास',
          style: TextStyle(
            fontSize: 14.5,
            fontWeight: FontWeight.w900,
            color: Color(0xFF112A1F),
          ),
        ),
        const SizedBox(height: 10),
        if (_ledger.isEmpty)
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Center(
              child: Text(
                'अजून एकही नाणी व्यवहार नाही',
                style: TextStyle(
                  fontSize: 11.5,
                  color: Colors.grey.shade600,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          )
        else
          ..._ledger.map((entry) {
            final dt = DateTime.tryParse(entry.at);
            final positive = entry.amount >= 0;
            return GlassCard(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              borderRadius: 16,
              child: Row(
                children: [
                  SizedBox(
                    width: 58,
                    child: Text(
                      positive ? '+${entry.amount}' : '${entry.amount}',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        color: positive
                            ? const Color(0xFF15803D)
                            : const Color(0xFFDC2626),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _reasonLabel(entry.reason),
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF112A1F),
                          ),
                        ),
                        if (dt != null)
                          Text(
                            DateFormat('dd MMM, hh:mm a').format(dt),
                            style: TextStyle(
                              fontSize: 10,
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
                      color: const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'शिल्लक ${entry.balanceAfter}',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: Colors.grey.shade700,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        if (_ledger.length < _ledgerTotal) ...[
          const SizedBox(height: 6),
          Center(
            child: TextButton.icon(
              onPressed: _loadingMore ? null : _loadMoreLedger,
              icon: _loadingMore
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.expand_more_rounded),
              label: Text(_loadingMore ? 'आणत आहोत...' : 'आणखी दाखवा'),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildLeaderboard() {
    const medals = ['🥇', '🥈', '🥉'];
    final board = _leaderboard;
    final top = (board?.data ?? []).take(10).toList();
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '🏆 नाणी लीडरबोर्ड (शीर्ष 10)',
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w900,
              color: Color(0xFF112A1F),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              ChoiceChip(
                label: const Text('एकूण'),
                selected: _period == 'all',
                selectedColor: const Color(0xFFE9C46A),
                labelStyle: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w900,
                  color: _period == 'all'
                      ? const Color(0xFF112A1F)
                      : Colors.grey.shade700,
                ),
                onSelected: (_) => _selectPeriod('all'),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('या महिन्यात'),
                selected: _period == 'month',
                selectedColor: const Color(0xFFE9C46A),
                labelStyle: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w900,
                  color: _period == 'month'
                      ? const Color(0xFF112A1F)
                      : Colors.grey.shade700,
                ),
                onSelected: (_) => _selectPeriod('month'),
              ),
            ],
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
              return Container(
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
                      ? Border.all(
                          color: const Color(0xFFE9C46A),
                          width: 1.4,
                        )
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
                            entry.isMe ? '${entry.name} (तुम्ही)' : entry.name,
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
                        '${entry.coinsEarned} 🪙',
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
            }),
          if (board?.myRank != null) ...[
            const SizedBox(height: 6),
            Center(
              child: Text(
                'तुमचा क्रमांक: #${board!.myRank!.rank}',
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
