// Daily Farm Diary (शेती नोंदवही) — analytics dashboard: summary cards,
// monthly/category/daily charts, crop breakdown & paginated entries timeline.

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_exception.dart';
import '../api/diary_api.dart';
import '../state/app_state.dart';
import '../models/diary_analytics.dart';
import '../models/farm_diary_entry.dart';
import '../components/common/audio_button.dart';
import '../components/common/glass_card.dart';
import '../components/common/motion_animations.dart';
import '../components/diary/diary_activity_chart.dart';
import '../components/diary/diary_category_chart.dart';
import '../components/diary/diary_monthly_chart.dart';
import '../components/mandi/mandi_price_card.dart' show fmtInr;
import 'farm_diary_widgets.dart';

class FarmDiaryView extends StatefulWidget {
  final AppState state;
  final DiaryApi? diaryApi;
  const FarmDiaryView({super.key, required this.state, this.diaryApi});

  @override
  State<FarmDiaryView> createState() => _FarmDiaryViewState();
}

class _FarmDiaryViewState extends State<FarmDiaryView> {
  static const int _pageSize = 20;

  late final DiaryApi _api = widget.diaryApi ?? DiaryApi();

  DiaryAnalytics? _analytics;
  bool _analyticsLoading = true;
  List<FarmDiaryEntry> _entries = [];
  int _total = 0;
  int _page = 0;
  bool _loading = true;
  bool _loadingMore = false;
  bool _error = false;

  // Period filter: 0 = all time, 1 = this month, 2 = last 3 months, 3 = this year.
  int _period = 0;
  String? _from;
  String? _to;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    await Future.wait([_loadAnalytics(), _loadEntriesPage(1)]);
  }

  Future<void> _loadAnalytics() async {
    setState(() => _analyticsLoading = true);
    try {
      final analytics = await _api.getAnalytics(from: _from, to: _to);
      if (!mounted) return;
      setState(() {
        _analytics = analytics;
        _analyticsLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      // Keep whatever analytics we already have on screen.
      setState(() => _analyticsLoading = false);
      _snack(widget.state.tr('farmDiary.analyticsFailed'));
    }
  }

  Future<void> _loadEntriesPage(int page) async {
    if (_entries.isEmpty) {
      setState(() {
        _loading = true;
        _error = false;
      });
    }
    try {
      final result = await _api.listEntriesPage(
        from: _from,
        to: _to,
        page: page,
        pageSize: _pageSize,
      );
      if (!mounted) return;
      setState(() {
        if (page == 1) {
          _entries = result.entries;
        } else {
          _entries = [..._entries, ...result.entries];
        }
        _total = result.total;
        _page = result.page;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (page == 1) _error = true;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _entries.length >= _total) return;
    setState(() => _loadingMore = true);
    try {
      final result = await _api.listEntriesPage(
        from: _from,
        to: _to,
        page: _page + 1,
        pageSize: _pageSize,
      );
      if (!mounted) return;
      setState(() {
        _entries = [..._entries, ...result.entries];
        _total = result.total;
        _page = result.page;
        _loadingMore = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  void _setPeriod(int period) {
    if (period == _period) return;
    final now = DateTime.now();
    String fmt(DateTime d) => DateFormat('yyyy-MM-dd').format(d);
    String? from;
    String? to;
    switch (period) {
      case 1:
        from = fmt(DateTime(now.year, now.month, 1));
        to = fmt(now);
      case 2:
        from = fmt(DateTime(now.year, now.month - 2, 1));
        to = fmt(now);
      case 3:
        from = fmt(DateTime(now.year, 1, 1));
        to = fmt(now);
      default:
        from = null;
        to = null;
    }
    setState(() {
      _period = period;
      _from = from;
      _to = to;
    });
    _refresh();
  }

  Future<void> _openEntryDialog({FarmDiaryEntry? existing}) async {
    final result = await showDiaryEntryDialog(
      context,
      widget.state,
      existing: existing,
      diaryApi: _api,
    );
    if (result == null || !mounted) return;
    final coins = result.$2;
    if (coins > 0) {
      _snack(widget.state
          .tr('farmDiary.coinsEarned')
          .replaceAll('{coins}', '$coins'));
    }
    await _refresh();
  }

  Future<void> _deleteEntry(FarmDiaryEntry entry) async {
    final confirmed = await showDiaryDeleteConfirm(context, widget.state);
    if (!confirmed || !mounted) return;
    try {
      await _api.deleteEntry(entry.id);
      _snack(widget.state.tr('farmDiary.entryDeleted'));
      await _refresh();
    } on ApiException catch (e) {
      _snack(e.message.isNotEmpty ? e.message : e.code);
    }
  }

  Future<void> _openReport() async {
    try {
      final url = await _api.getReportUrl(from: _from, to: _to);
      if (url.isEmpty) throw const ApiException(code: 'REPORT_UNAVAILABLE');
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {
      _snack(widget.state.tr('farmDiary.reportUnavailable'));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 60),
          child: CircularProgressIndicator(color: Color(0xFF43A047)),
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
              Text(
                widget.state.tr('farmDiary.loadFailed'),
                style: const TextStyle(
                    fontSize: 13,
                    color: Colors.grey,
                    fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              ElevatedButton(
                onPressed: _refresh,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B4332),
                  foregroundColor: Colors.white,
                ),
                child: Text(widget.state.tr('retry')),
              ),
            ],
          ),
        ),
      );
    }

    final totals = _analytics?.totals ?? const DiaryTotals();
    final byMonth = _analytics?.byMonth ?? const <MonthSummary>[];
    final byCategory = _analytics?.byCategory ?? const <CategorySummary>[];
    final byCrop = _analytics?.byCrop ?? const <CropSummary>[];
    final byDay = _analytics?.byDay ?? const <DaySummary>[];

    return RefreshIndicator(
      color: const Color(0xFF1B4332),
      onRefresh: _refresh,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Header with PDF report action
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.menu_book_rounded,
                              color: Color(0xFF4338CA), size: 22),
                          const SizedBox(width: 6),
                          Text(
                            widget.state.tr('farmDiary.title'),
                            style: const TextStyle(
                                fontSize: 19,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF112A1F)),
                          ),
                        ],
                      ),
                      Text(
                        widget.state.tr('farmDiary.subtitle'),
                        style: const TextStyle(
                            fontSize: 11.5,
                            color: Colors.grey,
                            fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                AudioButton(text: widget.state.tr('farmDiary.audioWelcome')),
                const SizedBox(width: 6),
                BouncyPressable(
                  onTap: _openReport,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF4338CA),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.download_rounded,
                            color: Colors.white, size: 14),
                        const SizedBox(width: 4),
                        Text(widget.state.tr('farmDiary.pdfReport'),
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // 2. Period filter chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _periodChip(0, widget.state.tr('farmDiary.periodAll')),
                  const SizedBox(width: 6),
                  _periodChip(
                      1, widget.state.tr('farmDiary.periodThisMonth')),
                  const SizedBox(width: 6),
                  _periodChip(
                      2, widget.state.tr('farmDiary.periodLast3Months')),
                  const SizedBox(width: 6),
                  _periodChip(3, widget.state.tr('farmDiary.periodThisYear')),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // 3. Summary cards (income / expense / net)
            Row(
              children: [
                Expanded(
                  child: _summaryCard(
                    label: widget.state.tr('farmDiary.totalIncome'),
                    value: totals.income,
                    color: const Color(0xFF2D6A4F),
                    icon: Icons.south_west_rounded,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _summaryCard(
                    label: widget.state.tr('farmDiary.totalExpense'),
                    value: totals.expense,
                    color: const Color(0xFFE76F51),
                    icon: Icons.north_east_rounded,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _summaryCard(
                    label: widget.state.tr('farmDiary.netProfit'),
                    value: totals.net,
                    color: totals.net < 0
                        ? const Color(0xFFDC2626)
                        : const Color(0xFF2D6A4F),
                    icon: Icons.account_balance_wallet_outlined,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // 4. Add new entry
            ElevatedButton.icon(
              onPressed: () => _openEntryDialog(),
              icon: const Icon(Icons.add_circle_rounded,
                  color: Colors.white, size: 20),
              label: Text(widget.state.tr('farmDiary.addEntry'),
                  style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w900,
                      color: Colors.white)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1B4332),
                minimumSize: const Size(double.infinity, 46),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                elevation: 2,
              ),
            ),
            const SizedBox(height: 14),

            // 5. Monthly chart
            _chartCard(
              title: widget.state.tr('farmDiary.monthlyChartTitle'),
              child: DiaryMonthlyChart(data: byMonth, state: widget.state),
            ),
            const SizedBox(height: 12),

            // 6. Expense by category donut
            _chartCard(
              title: widget.state.tr('farmDiary.categoryChartTitle'),
              child: DiaryCategoryChart(data: byCategory, state: widget.state),
            ),
            const SizedBox(height: 12),

            // 7. Crop breakdown (horizontal)
            if (byCrop.isNotEmpty) ...[
              _sectionTitle(widget.state.tr('farmDiary.cropBreakdownTitle')),
              const SizedBox(height: 8),
              SizedBox(
                height: 92,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: byCrop.length,
                  separatorBuilder: (context, index) => const SizedBox(width: 8),
                  itemBuilder: (context, i) {
                    final crop = byCrop[i];
                    final isProfit = crop.net >= 0;
                    return GlassCard(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      borderRadius: 16,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            crop.cropName,
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF112A1F)),
                          ),
                          Text(
                            '${widget.state.tr('farmDiary.netProfit')}: ${isProfit ? '+' : '-'}₹${fmtInr(crop.net.abs())}',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w900,
                              color: isProfit
                                  ? const Color(0xFF2D6A4F)
                                  : const Color(0xFFDC2626),
                            ),
                          ),
                          Text(
                            '${widget.state.tr('farmDiary.income')} ₹${fmtInr(crop.income)} • ${widget.state.tr('farmDiary.expense')} ₹${fmtInr(crop.expense)}',
                            style: TextStyle(
                                fontSize: 9.5,
                                color: Colors.grey.shade600,
                                fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
            ],

            // 8. Daily activity line chart
            _chartCard(
              title: widget.state.tr('farmDiary.dailyChartTitle'),
              child: DiaryActivityChart(data: byDay, state: widget.state),
            ),
            const SizedBox(height: 14),

            // 9. Entries timeline (paginated)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _sectionTitle(widget.state.tr('farmDiary.entriesTitle')),
                Text(
                  '${_entries.length}/$_total',
                  style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey.shade600,
                      fontWeight: FontWeight.w700),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_entries.isEmpty)
              Container(
                padding: const EdgeInsets.all(30),
                alignment: Alignment.center,
                child: Text(widget.state.tr('farmDiary.noEntries'),
                    style: const TextStyle(color: Colors.grey)),
              )
            else ...[
              ..._entries.map(
                (e) => DiaryEntryCard(
                  entry: e,
                  state: widget.state,
                  onEdit: () => _openEntryDialog(existing: e),
                  onDelete: () => _deleteEntry(e),
                ),
              ),
              if (_entries.length < _total)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Center(
                    child: TextButton.icon(
                      onPressed: _loadingMore ? null : _loadMore,
                      icon: _loadingMore
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.expand_more_rounded, size: 18),
                      label: Text(widget.state.tr('farmDiary.loadMore'),
                          style:
                              const TextStyle(fontWeight: FontWeight.w800)),
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _periodChip(int period, String label) {
    final isSel = _period == period;
    return GestureDetector(
      onTap: () => _setPeriod(period),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFF4338CA) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: isSel ? const Color(0xFF4338CA) : Colors.grey.shade300),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSel ? FontWeight.w900 : FontWeight.w700,
            color: isSel ? Colors.white : const Color(0xFF374151),
          ),
        ),
      ),
    );
  }

  Widget _summaryCard({
    required String label,
    required double value,
    required Color color,
    required IconData icon,
  }) {
    return StaggeredSlideFade(
      child: GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        borderRadius: 16,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 13, color: color),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 10, color: Colors.grey.shade700, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                '₹${fmtInr(value)}',
                style: TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w900, color: color),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
          fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
    );
  }

  Widget _chartCard({required String title, required Widget child}) {
    return GlassCard(
      padding: const EdgeInsets.all(14),
      borderRadius: 18,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1B4332))),
          const SizedBox(height: 10),
          if (_analyticsLoading)
            Container(
              height: 190,
              decoration: BoxDecoration(
                color: Colors.grey.shade200,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            )
          else
            child,
        ],
      ),
    );
  }
}
