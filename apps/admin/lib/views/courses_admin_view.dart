// Module 27 — Instructor courses & podcasts moderation:
// review queue (publish/reject), featuring and sales report.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/admin_api.dart';
import '../api/api_exception.dart';

const _kindLabels = {
  'courseMaterial': 'कोर्स सामग्री',
  'audioPodcast': 'ऑडियो पॉडकास्ट',
  'videoPodcast': 'वीडियो पॉडकास्ट',
};

const _statusLabels = {
  'pendingReview': 'समीक्षा लंबित',
  'published': 'प्रकाशित',
  'rejected': 'अस्वीकृत',
  'all': 'सभी',
};

class CoursesAdminView extends StatefulWidget {
  const CoursesAdminView({super.key});

  @override
  State<CoursesAdminView> createState() => _CoursesAdminViewState();
}

class _CoursesAdminViewState extends State<CoursesAdminView> {
  List<Map<String, dynamic>>? _items;
  Map<String, dynamic>? _report;
  String? _error;
  String _status = 'pendingReview';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<AdminApi>();
    try {
      final res = await api.courseQueue(status: _status);
      final report = await api.coursesReport();
      if (!mounted) return;
      setState(() {
        _items = (res['data'] as List? ?? [])
            .map((e) => (e as Map).cast<String, dynamic>())
            .toList();
        _report = report;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.code);
    }
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _publish(Map<String, dynamic> item) async {
    try {
      await context
          .read<AdminApi>()
          .reviewCourse(item['id'] as String, 'publish');
      _toast('कोर्स प्रकाशित ✓');
      _load();
    } on ApiException catch (e) {
      _toast('विफल (${e.code})');
    }
  }

  Future<void> _reject(Map<String, dynamic> item) async {
    final api = context.read<AdminApi>();
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('कोर्स अस्वीकृत करें'),
        content: TextField(
          controller: controller,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'कारण (आवश्यक)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('रद्द करें'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('अस्वीकृत करें'),
          ),
        ],
      ),
    );
    if (reason == null || reason.isEmpty) return;
    try {
      await api.reviewCourse(item['id'] as String, 'reject', reason: reason);
      _toast('कोर्स अस्वीकृत');
      _load();
    } on ApiException catch (e) {
      _toast('विफल (${e.code})');
    }
  }

  Future<void> _toggleFeature(Map<String, dynamic> item) async {
    final next = item['isFeatured'] != true;
    try {
      await context.read<AdminApi>().featureCourse(item['id'] as String, next);
      _toast(next ? 'फीचर्ड ✓' : 'फीचर्ड हटाया');
      _load();
    } on ApiException catch (e) {
      _toast('विफल (${e.code})');
    }
  }

  Future<void> _openLink(String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final report = _report;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Wrap(
            spacing: 16,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text('प्रशिक्षक कोर्स',
                  style: Theme.of(context).textTheme.titleLarge),
              if (report != null) ...[
                _chip('कुल कोर्स', '${report['totalCourses'] ?? 0}'),
                _chip('लंबित', '${report['byStatus']?['pendingReview'] ?? 0}'),
                _chip('बिक्री', '${report['totalSales'] ?? 0}'),
                _chip('GMV', '₹${report['grossMerchandiseValueRupees'] ?? 0}'),
                _chip('कमीशन', '₹${report['platformCommissionRupees'] ?? 0}'),
              ],
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Wrap(
            spacing: 8,
            children: [
              for (final s in _statusLabels.keys)
                ChoiceChip(
                  label: Text(_statusLabels[s]!),
                  selected: _status == s,
                  onSelected: (_) {
                    setState(() => _status = s);
                    _load();
                  },
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Expanded(child: _body()),
      ],
    );
  }

  Widget _chip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.deepPurple.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.deepPurple.withValues(alpha: 0.3)),
      ),
      child: Text('$label: $value',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }

  Widget _body() {
    if (_error != null) {
      return Center(child: Text('त्रुटि: $_error'));
    }
    final items = _items;
    if (items == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (items.isEmpty) {
      return const Center(child: Text('इस स्थिति में कोई कोर्स नहीं'));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (context, i) => _card(items[i]),
    );
  }

  Widget _card(Map<String, dynamic> item) {
    final status = item['status'] as String? ?? 'pendingReview';
    final kind = item['kind'] as String? ?? '';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(item['title'] as String? ?? '',
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 15)),
                ),
                _statusBadge(status),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${_kindLabels[kind] ?? kind} • ${item['category'] ?? ''} • ${item['language'] ?? ''} • ${item['instructorName'] ?? ''}',
              style: const TextStyle(fontSize: 12, color: Colors.black54),
            ),
            const SizedBox(height: 4),
            Text(
              'मूल्य: ₹${item['priceRupees'] ?? 0} • बिक्री: ${item['salesCount'] ?? 0} • कमाई: ₹${item['instructorEarningsRupees'] ?? 0}',
              style: const TextStyle(fontSize: 12),
            ),
            if (status == 'rejected' &&
                (item['rejectedReason'] as String?)?.isNotEmpty == true)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('कारण: ${item['rejectedReason']}',
                    style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12)),
              ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                if ((item['mediaUrl'] as String?)?.isNotEmpty == true)
                  OutlinedButton.icon(
                    onPressed: () => _openLink(item['mediaUrl'] as String?),
                    icon: const Icon(Icons.play_arrow, size: 16),
                    label: const Text('मीडिया'),
                  ),
                if ((item['thumbnailUrl'] as String?)?.isNotEmpty == true)
                  OutlinedButton.icon(
                    onPressed: () => _openLink(item['thumbnailUrl'] as String?),
                    icon: const Icon(Icons.image, size: 16),
                    label: const Text('थंबनेल'),
                  ),
                if (status == 'pendingReview') ...[
                  FilledButton.icon(
                    onPressed: () => _publish(item),
                    icon: const Icon(Icons.check, size: 16),
                    label: const Text('प्रकाशित करें'),
                  ),
                  FilledButton.tonalIcon(
                    onPressed: () => _reject(item),
                    icon: const Icon(Icons.close, size: 16),
                    label: const Text('अस्वीकृत'),
                  ),
                ],
                if (status == 'published')
                  FilledButton.tonalIcon(
                    onPressed: () => _toggleFeature(item),
                    icon: Icon(
                        item['isFeatured'] == true
                            ? Icons.star
                            : Icons.star_border,
                        size: 16),
                    label: Text(item['isFeatured'] == true
                        ? 'फीचर्ड हटाएं'
                        : 'फीचर्ड करें'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusBadge(String status) {
    final color = switch (status) {
      'published' => Colors.green,
      'rejected' => Colors.red,
      _ => Colors.orange,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(_statusLabels[status] ?? status,
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w800)),
    );
  }
}
