// Gyan Hub video player modal + ask-scientist dialog (split from
// gyan_hub_view.dart for the line cap; verbatim styling).

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../models/gyan_models.dart';
import '../state/app_state.dart';

class VideoPlayerModal extends StatefulWidget {
  final VideoGuide video;
  final AppState state;
  final bool enableVideo;

  const VideoPlayerModal({
    super.key,
    required this.video,
    required this.state,
    this.enableVideo = true,
  });

  @override
  State<VideoPlayerModal> createState() => _VideoPlayerModalState();
}

class _VideoPlayerModalState extends State<VideoPlayerModal> {
  VideoPlayerController? _controller;

  @override
  void initState() {
    super.initState();
    if (widget.enableVideo && widget.video.videoUrl.isNotEmpty) {
      final controller = VideoPlayerController.networkUrl(
          Uri.parse(widget.video.videoUrl));
      controller.initialize().then((_) async {
        if (!mounted) {
          await controller.dispose();
          return;
        }
        await controller.play();
        setState(() => _controller = controller);
      }).catchError((_) {
        unawaited(controller.dispose());
      });
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final vid = widget.video;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Color(0xFF112A1F),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFE9C46A), borderRadius: BorderRadius.circular(8)),
                child: Text(vid.category, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF112A1F))),
              ),
              IconButton(icon: const Icon(Icons.close_rounded, color: Colors.white), onPressed: () => Navigator.pop(context)),
            ],
          ),
          const SizedBox(height: 8),

          // Video Player Box
          Container(
            height: 180,
            width: double.infinity,
            decoration: BoxDecoration(
              color: Colors.black,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF52B788)),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: _buildPlayerSurface(),
            ),
          ),
          const SizedBox(height: 14),

          Text(vid.vernacularTitle, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
          Text(
            widget.state.tr('gyanHub.trainerLine')
                .replaceAll('{name}', vid.instructor)
                .replaceAll('{views}', vid.views),
            style: const TextStyle(color: Color(0xFFD8F3DC), fontSize: 12),
          ),
          const SizedBox(height: 10),
          Text(vid.summary, style: const TextStyle(color: Colors.white70, fontSize: 12.5, height: 1.4)),
          const SizedBox(height: 12),
          Text(widget.state.tr('gyanHub.keyTakeaways'), style: const TextStyle(color: Color(0xFFE9C46A), fontSize: 12.5, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          ...vid.keyPoints.map((kp) => Text("• $kp", style: const TextStyle(color: Colors.white, fontSize: 12, height: 1.4))),
        ],
      ),
    );
  }

  Widget _buildPlayerSurface() {
    final c = _controller;
    if (c != null && c.value.isInitialized) {
      return FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: c.value.size.width,
          height: c.value.size.height,
          child: VideoPlayer(c),
        ),
      );
    }
    return Stack(
      alignment: Alignment.center,
      children: [
        const Icon(Icons.play_circle_fill_rounded, size: 56, color: Color(0xFFE9C46A)),
        Positioned(
          bottom: 10,
          left: 14,
          right: 14,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("03:42 / ${widget.video.duration}", style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
              const Row(
                children: [
                  Icon(Icons.hd_rounded, color: Color(0xFF86EFAC), size: 18),
                  SizedBox(width: 6),
                  Icon(Icons.fullscreen_rounded, color: Colors.white, size: 20),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class AskQuestionDialog extends StatelessWidget {
  final ExpertTalk talk;
  final AppState state;
  final TextEditingController controller;
  final VoidCallback onSubmit;

  const AskQuestionDialog({
    super.key,
    required this.talk,
    required this.state,
    required this.controller,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(state.tr('gyanHub.askScientistTitle').replaceAll('{name}', talk.expertName), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: controller,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: state.tr('gyanHub.questionHint'),
              border: const OutlineInputBorder(),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(state.tr('cancel'))),
        ElevatedButton(
          onPressed: onSubmit,
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332)),
          child: Text(state.tr('gyanHub.send'), style: const TextStyle(color: Colors.white)),
        ),
      ],
    );
  }
}
