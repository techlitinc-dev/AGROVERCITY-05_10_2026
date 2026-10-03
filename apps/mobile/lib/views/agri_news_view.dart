// Agri News — Daily Market & Weather Updates with Audio Reader
// (API-wired port: GET /v1/news with category filter + infinite scroll).

import 'package:flutter/material.dart';

import '../api/content_api.dart';
import '../components/common/audio_button.dart';
import '../components/common/motion_animations.dart';
import '../models/agri_news_item.dart';
import '../state/app_state.dart';
import 'agri_news_widgets.dart';

class AgriNewsView extends StatefulWidget {
  final AppState state;
  final ContentApi? contentApi;

  const AgriNewsView({super.key, required this.state, this.contentApi});

  @override
  State<AgriNewsView> createState() => _AgriNewsViewState();
}

class _AgriNewsViewState extends State<AgriNewsView> {
  late final ContentApi _api = widget.contentApi ?? ContentApi();

  List<(String, String?)> get _categories => [
        (widget.state.tr('content.catAll'), null),
        (widget.state.tr('content.catMarketPolicy'), "market-policy"),
        (widget.state.tr('content.catWeatherAlert'), "weather-alert"),
        (widget.state.tr('content.catGovtSubsidy'), "govt-subsidy"),
        (widget.state.tr('content.catAgriTech'), "agri-tech"),
      ];

  final ScrollController _scrollController = ScrollController();
  late (String, String?) _selectedCategory = _categories.first;
  List<AgriNewsItem> _items = const [];
  int _page = 1;
  int _total = 0;
  bool _loading = true;
  bool _loadingMore = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_maybeLoadMore);
    _load();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _page = 1;
    });
    try {
      final page = await _api.listNews(category: _selectedCategory.$2);
      if (!mounted) return;
      setState(() {
        _items = page.items;
        _total = page.total;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _items = const [];
        _total = 0;
        _loading = false;
      });
    }
  }

  void _maybeLoadMore() {
    if (_loading || _loadingMore || _items.length >= _total) return;
    if (_scrollController.position.pixels <
        _scrollController.position.maxScrollExtent - 200) {
      return;
    }
    _loadMore();
  }

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    try {
      final page =
          await _api.listNews(category: _selectedCategory.$2, page: _page + 1);
      if (!mounted) return;
      setState(() {
        _page = page.page;
        _total = page.total;
        _items = [..._items, ...page.items];
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingMore = false);
    }
  }

  void _openNewsDetail(AgriNewsItem item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => NewsDetailSheet(
        item: item,
        state: widget.state,
        onShare: () {
          Navigator.pop(ctx);
          widget.state.showToast(widget.state.tr('content.newsSharedToast'));
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final breaking = _items.where((n) => n.isBreaking);

    return SingleChildScrollView(
      controller: _scrollController,
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Header with Audio Broadcast
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.newspaper_rounded, color: Color(0xFF0284C7), size: 22),
                      const SizedBox(width: 6),
                      Text(
                        widget.state.tr('content.newsTitle'),
                        style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                      ),
                    ],
                  ),
                  Text(
                    widget.state.tr('content.newsSubtitle'),
                    style: const TextStyle(fontSize: 11.5, color: Colors.grey, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              AudioButton(text: widget.state.tr('content.newsAudioBrief')),
            ],
          ),
          const SizedBox(height: 14),

          // 2. Breaking News Highlight Strip
          ...breaking.map((b) => StaggeredSlideFade(
                delayMs: 0,
                child: NewsBreakingBanner(item: b, state: widget.state),
              )),

          // 3. Category Horizontal Filter Pills
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: _categories.map((cat) {
                final isSel = _selectedCategory.$2 == cat.$2;
                return GestureDetector(
                  onTap: () {
                    setState(() => _selectedCategory = cat);
                    _load();
                  },
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: isSel ? const Color(0xFF0284C7) : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isSel ? const Color(0xFF0284C7) : Colors.grey.shade300,
                      ),
                    ),
                    child: Text(
                      cat.$1,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: isSel ? FontWeight.w900 : FontWeight.w700,
                        color: isSel ? Colors.white : const Color(0xFF374151),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 14),

          // 4. News Feed List
          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: CircularProgressIndicator(color: Color(0xFF0284C7)),
              ),
            )
          else ...[
            ...List.generate(_items.length, (idx) {
              final item = _items[idx];
              return StaggeredSlideFade(
                delayMs: idx * 40,
                child: NewsCard(
                  item: item,
                  state: widget.state,
                  onReadMore: () => _openNewsDetail(item),
                ),
              );
            }),
            if (_loadingMore)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: CircularProgressIndicator(color: Color(0xFF0284C7)),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
