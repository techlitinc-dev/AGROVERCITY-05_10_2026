// Gyan Hub cards — video guide / blog (split from gyan_hub_view.dart for
// the line cap; verbatim styling).

import 'package:flutter/material.dart';

import '../components/common/audio_button.dart';
import '../components/common/glass_card.dart';
import '../data/translations.dart';
import '../models/gyan_models.dart';
import '../state/app_state.dart';

class VideoGuideCard extends StatelessWidget {
  final VideoGuide video;
  final VoidCallback onPlay;
  final AppState? state;

  const VideoGuideCard({super.key, required this.video, required this.onPlay, this.state});

  String _tr(String key) => AppTranslations.get(key, state?.language ?? 'mr');

  @override
  Widget build(BuildContext context) {
    final vid = video;
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: onPlay,
            child: Container(
              height: 140,
              width: double.infinity,
              decoration: BoxDecoration(
                color: const Color(0xFF112A1F),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  const Icon(Icons.play_circle_fill_rounded, size: 48, color: Color(0xFFE9C46A)),
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(6)),
                      child: Text(vid.category, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                    ),
                  ),
                  Positioned(
                    bottom: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(4)),
                      child: Text(vid.duration, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),

          Text(vid.vernacularTitle, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
          const SizedBox(height: 2),
          Text("${vid.instructor} • ${vid.views}", style: const TextStyle(fontSize: 11.5, color: Colors.grey)),
          const SizedBox(height: 6),
          Text(vid.summary, style: const TextStyle(fontSize: 12, color: Colors.black87, height: 1.3)),
          const SizedBox(height: 10),

          ElevatedButton.icon(
            onPressed: onPlay,
            icon: const Icon(Icons.play_arrow_rounded, size: 16),
            label: Text(_tr('gyanHub.watchVideo'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 38)),
          ),
        ],
      ),
    );
  }
}

class BlogCard extends StatelessWidget {
  final BlogArticle blog;
  final VoidCallback onToggleBookmark;
  final VoidCallback onLike;
  final AppState? state;

  const BlogCard({
    super.key,
    required this.blog,
    required this.onToggleBookmark,
    required this.onLike,
    this.state,
  });

  String _tr(String key) => AppTranslations.get(key, state?.language ?? 'mr');

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      margin: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFD8F3DC), borderRadius: BorderRadius.circular(8)),
                child: Text(blog.category, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF166534))),
              ),
              Row(
                children: [
                  Text(blog.readTimeMinutes, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                  IconButton(
                    icon: Icon(
                      blog.isBookmarked ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
                      color: blog.isBookmarked ? const Color(0xFFE9C46A) : Colors.grey,
                      size: 20,
                    ),
                    onPressed: onToggleBookmark,
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 6),

          Text(blog.vernacularTitle, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
          const SizedBox(height: 2),
          Text(
            _tr('gyanHub.authorLine')
                .replaceAll('{name}', blog.author)
                .replaceAll('{role}', blog.authorRole)
                .replaceAll('{date}', blog.publishedDate),
            style: const TextStyle(fontSize: 11, color: Colors.grey),
          ),
          const SizedBox(height: 8),
          Text(blog.content, style: const TextStyle(fontSize: 12.5, color: Colors.black87, height: 1.4)),
          const SizedBox(height: 10),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              AudioButton(text: "${blog.vernacularTitle}। ${blog.content}"),
              GestureDetector(
                onTap: onLike,
                child: Row(
                  children: [
                    const Icon(Icons.thumb_up_alt_rounded, size: 14, color: Color(0xFF1B4332)),
                    const SizedBox(width: 4),
                    Text("${blog.likesCount} ${_tr('gyanHub.likes')}", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF1B4332))),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
