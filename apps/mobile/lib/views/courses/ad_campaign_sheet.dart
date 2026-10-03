import 'package:flutter/material.dart';

import '../../api/ads_api.dart';
import '../../state/app_state.dart';

class AdCampaignSheet extends StatefulWidget {
  const AdCampaignSheet({
    super.key,
    required this.state,
    this.api,
  });

  final AppState state;
  final AdsApi? api;

  static Future<void> show(
    BuildContext context, {
    required AppState state,
    AdsApi? api,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AdCampaignSheet(
        state: state,
        api: api,
      ),
    );
  }

  @override
  State<AdCampaignSheet> createState() => _AdCampaignSheetState();
}

class _AdCampaignSheetState extends State<AdCampaignSheet> {
  late final AdsApi _api = widget.api ?? AdsApi();
  List<Map<String, dynamic>> _myAds = [];
  bool _loading = true;
  bool _creating = false;

  final _titleCtrl = TextEditingController();
  final _subCtrl = TextEditingController();
  final _ctaCtrl = TextEditingController(text: 'Enroll Now');
  final _urlCtrl = TextEditingController();
  final _imageUrlCtrl = TextEditingController();
  final _budgetCtrl = TextEditingController(text: '500');
  final String _placement = 'course_banner';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _subCtrl.dispose();
    _ctaCtrl.dispose();
    _urlCtrl.dispose();
    _imageUrlCtrl.dispose();
    _budgetCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final list = await _api.getMyAds();
      if (mounted) setState(() => _myAds = list);
    } catch (_) {} finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createCampaign() async {
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) {
      widget.state.showToast('Please enter an ad title');
      return;
    }
    final imageUrl = _imageUrlCtrl.text.trim();
    if (imageUrl.isEmpty) {
      widget.state.showToast('Please provide a banner image URL');
      return;
    }
    final budget = double.tryParse(_budgetCtrl.text.trim()) ?? 500;

    setState(() => _creating = true);
    try {
      await _api.createAd(
        title: title,
        subtitle: _subCtrl.text.trim(),
        ctaText: _ctaCtrl.text.trim(),
        targetUrl: _urlCtrl.text.trim().isNotEmpty
            ? _urlCtrl.text.trim()
            : 'https://agrovercity.com/courses',
        imageUrl: imageUrl,
        placement: _placement,
        budgetRupees: budget,
        durationDays: 7,
      );
      if (!mounted) return;
      widget.state.showToast('Ad campaign created and live! 🚀');
      _titleCtrl.clear();
      _subCtrl.clear();
      await _load();
    } catch (e) {
      if (mounted) widget.state.showToast('Failed to create campaign: $e');
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.9,
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
                  'Platform Advertisements',
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

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Launch Ad Box
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.campaign_rounded,
                              color: Color(0xFF1B4332), size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Launch Sponsored Promotion',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF1B4332),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _titleCtrl,
                        decoration: InputDecoration(
                          labelText: 'Ad Title *',
                          hintText: 'e.g. Masterclass by Dr. Kulkarni',
                          isDense: true,
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _subCtrl,
                        decoration: InputDecoration(
                          labelText: 'Ad Subtitle',
                          hintText: 'Special 50% AgriCoin Discount this week',
                          isDense: true,
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _ctaCtrl,
                              decoration: InputDecoration(
                                labelText: 'Button Text',
                                isDense: true,
                                border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              controller: _budgetCtrl,
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                labelText: 'Budget (₹)',
                                prefixText: '₹ ',
                                isDense: true,
                                border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _imageUrlCtrl,
                        decoration: InputDecoration(
                          labelText: 'Banner Image URL *',
                          hintText: 'https://your-cdn.com/banner.jpg',
                          isDense: true,
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                      const SizedBox(height: 14),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF1B4332),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          onPressed: _creating ? null : _createCampaign,
                          icon: _creating
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.rocket_launch_rounded,
                                  size: 16),
                          label: const Text('Launch Campaign',
                              style: TextStyle(fontWeight: FontWeight.w900)),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // My Campaigns List
                const Text(
                  'My Active Campaigns & Analytics',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 10),

                if (_loading)
                  const Center(child: CircularProgressIndicator())
                else if (_myAds.isEmpty)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: Text(
                        'No campaigns yet. Launch one above!',
                        style: TextStyle(color: Color(0xFF64748B)),
                      ),
                    ),
                  )
                else
                  for (final ad in _myAds) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment:
                                MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  ad['title'] as String? ?? 'Campaign',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 13.5,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFDCFCE7),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  ad['status'] as String? ?? 'active',
                                  style: const TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF15803D),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment:
                                MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '👁️ ${ad['impressions'] ?? 0} Views',
                                style: const TextStyle(
                                    fontSize: 11, color: Color(0xFF475569)),
                              ),
                              Text(
                                '👆 ${ad['clicks'] ?? 0} Clicks',
                                style: const TextStyle(
                                    fontSize: 11, color: Color(0xFF475569)),
                              ),
                              Text(
                                'CTR: ${((ad['ctrPercent'] as num?) ?? 0).toStringAsFixed(1)}%',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF1B4332),
                                ),
                              ),
                              Text(
                                '₹${ad['spentRupees'] ?? 0} Spent',
                                style: const TextStyle(
                                    fontSize: 11, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
