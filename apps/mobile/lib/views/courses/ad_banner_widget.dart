import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/ads_api.dart';

class AdBannerWidget extends StatefulWidget {
  const AdBannerWidget({
    super.key,
    this.placement = 'course_banner',
    this.api,
  });

  final String placement;
  final AdsApi? api;

  @override
  State<AdBannerWidget> createState() => _AdBannerWidgetState();
}

class _AdBannerWidgetState extends State<AdBannerWidget> {
  late final AdsApi _api = widget.api ?? AdsApi();
  List<Map<String, dynamic>> _ads = [];
  int _currentIndex = 0;
  Timer? _timer;
  final Set<String> _impressed = {};

  @override
  void initState() {
    super.initState();
    _loadAds();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _loadAds() async {
    try {
      final ads = await _api.getActiveAds(placement: widget.placement);
      if (!mounted) return;
      setState(() {
        _ads = ads;
        _currentIndex = 0;
      });
      if (_ads.isNotEmpty) {
        _recordCurrentImpression();
        if (_ads.length > 1) {
          _timer = Timer.periodic(const Duration(seconds: 6), (_) {
            if (!mounted) return;
            setState(() {
              _currentIndex = (_currentIndex + 1) % _ads.length;
            });
            _recordCurrentImpression();
          });
        }
      }
    } catch (_) {}
  }

  void _recordCurrentImpression() {
    if (_ads.isEmpty || _currentIndex >= _ads.length) return;
    final ad = _ads[_currentIndex];
    final id = ad['id'] as String?;
    if (id != null && !_impressed.contains(id)) {
      _impressed.add(id);
      _api.recordImpression(id);
    }
  }

  Future<void> _handleAdClick(Map<String, dynamic> ad) async {
    final id = ad['id'] as String?;
    if (id != null) {
      _api.recordClick(id);
    }
    final url = ad['targetUrl'] as String?;
    if (url != null && url.isNotEmpty) {
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_ads.isEmpty) return const SizedBox.shrink();
    final ad = _ads[_currentIndex];
    final imageUrl = ad['imageUrl'] as String? ?? '';
    final title = ad['title'] as String? ?? 'Sponsored';
    final subtitle = ad['subtitle'] as String? ?? '';
    final ctaText = ad['ctaText'] as String? ?? 'Learn More';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () => _handleAdClick(ad),
          child: Stack(
            children: [
              Container(
                height: 120,
                width: double.infinity,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1B4332), Color(0xFF2D6A4F)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  image: imageUrl.isNotEmpty
                      ? DecorationImage(
                          image: NetworkImage(imageUrl),
                          fit: BoxFit.cover,
                          colorFilter: ColorFilter.mode(
                            Colors.black.withValues(alpha: 0.35),
                            BlendMode.darken,
                          ),
                        )
                      : null,
                ),
              ),
              Positioned.fill(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE9C46A),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'SPONSORED',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF112A1F),
                              ),
                            ),
                          ),
                          if (_ads.length > 1)
                            Text(
                              '${_currentIndex + 1}/${_ads.length}',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Colors.white70,
                              ),
                            ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          if (subtitle.isNotEmpty)
                            Text(
                              subtitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 11,
                              ),
                            ),
                        ],
                      ),
                      Align(
                        alignment: Alignment.bottomRight,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            ctaText,
                            style: const TextStyle(
                              color: Color(0xFF1B4332),
                              fontWeight: FontWeight.w900,
                              fontSize: 10.5,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
