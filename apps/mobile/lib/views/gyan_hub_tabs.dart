// Per-tab list content for the Gyan Hub view (split from gyan_hub_view.dart
// for the line cap). Callbacks are supplied by the view, which owns all
// API logic.

import 'package:flutter/material.dart';

import '../models/gyan_models.dart';
import '../state/app_state.dart';
import 'gyan_hub_media_widgets.dart';
import 'gyan_hub_widgets.dart';

class GyanHubTabContent extends StatelessWidget {
  final int selectedTab;
  final AppState? state;
  final List<PaidWorkshop> workshops;
  final List<ExpertTalk> talks;
  final List<VideoGuide> videos;
  final List<BlogArticle> blogs;
  final Set<String> registeredTalks;
  final void Function(PaidWorkshop) onOpenWorkshop;
  final void Function(ExpertTalk) onRegisterTalk;
  final void Function(ExpertTalk) onAskQuestion;
  final void Function(VideoGuide) onPlayVideo;
  final void Function(BlogArticle) onToggleBookmark;
  final void Function(BlogArticle) onLikeBlog;

  const GyanHubTabContent({
    super.key,
    required this.selectedTab,
    this.state,
    required this.workshops,
    required this.talks,
    required this.videos,
    required this.blogs,
    required this.registeredTalks,
    required this.onOpenWorkshop,
    required this.onRegisterTalk,
    required this.onAskQuestion,
    required this.onPlayVideo,
    required this.onToggleBookmark,
    required this.onLikeBlog,
  });

  @override
  Widget build(BuildContext context) {
    return switch (selectedTab) {
      0 => Column(
          children: workshops
              .map((ws) => WorkshopCard(
                    workshop: ws,
                    state: state,
                    onOpenDetail: () => onOpenWorkshop(ws),
                  ))
              .toList(),
        ),
      1 => Column(
          children: talks
              .map((talk) => ExpertTalkCard(
                    talk: talk,
                    state: state,
                    registered: registeredTalks.contains(talk.id),
                    onRegister: () => onRegisterTalk(talk),
                    onAsk: () => onAskQuestion(talk),
                  ))
              .toList(),
        ),
      2 => Column(
          children: videos
              .map((vid) => VideoGuideCard(
                    video: vid,
                    state: state,
                    onPlay: () => onPlayVideo(vid),
                  ))
              .toList(),
        ),
      _ => Column(
          children: blogs
              .map((blog) => BlogCard(
                    blog: blog,
                    state: state,
                    onToggleBookmark: () => onToggleBookmark(blog),
                    onLike: () => onLikeBlog(blog),
                  ))
              .toList(),
        ),
    };
  }
}
