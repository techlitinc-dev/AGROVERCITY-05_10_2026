// My Library — courses & podcasts the farmer has purchased or claimed.

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/courses_api.dart';
import '../../state/app_state.dart';
import 'course_widgets.dart';

class MyLibraryView extends StatefulWidget {
  const MyLibraryView({super.key, required this.state, this.api});

  final AppState state;
  final CoursesApi? api;

  @override
  State<MyLibraryView> createState() => _MyLibraryViewState();
}

class _MyLibraryViewState extends State<MyLibraryView> {
  late final CoursesApi _api = widget.api ?? CoursesApi();
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    try {
      final items = await _api.myLibrary();
      if (mounted) setState(() => _items = items);
    } catch (_) {
      // Keep previous data when offline.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open(Map<String, dynamic> course) async {
    final url = course['mediaUrl'] as String?;
    if (url == null || url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F8F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF112A1F)),
        title: Text(widget.state.tr('myLibraryK'),
            style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w900,
                color: Color(0xFF112A1F))),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _refresh,
              child: _items.isEmpty
                  ? ListView(
                      children: [
                        const SizedBox(height: 140),
                        Center(
                          child: Text(widget.state.tr('libraryEmpty'),
                              style:
                                  const TextStyle(color: Color(0xFF64748B))),
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(14),
                      itemCount: _items.length,
                      itemBuilder: (context, i) => _tile(_items[i]),
                    ),
            ),
    );
  }

  Widget _tile(Map<String, dynamic> course) {
    final kind = course['kind'] as String? ?? 'videoPodcast';
    final hasMedia = (course['mediaUrl'] as String?)?.isNotEmpty == true;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: const Color(0xFF7C3AED).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(courseKindIcon(kind), color: const Color(0xFF7C3AED)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(course['title'] as String? ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 13.5)),
                const SizedBox(height: 3),
                Text(
                  courseKindLabel(widget.state, kind),
                  style:
                      const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
          FilledButton.tonalIcon(
            onPressed: hasMedia ? () => _open(course) : null,
            icon: const Icon(Icons.play_arrow_rounded, size: 18),
            label: Text(widget.state.tr('openMedia')),
          ),
        ],
      ),
    );
  }
}
