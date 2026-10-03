// Live Channels player box with HLS video surface (split from
// live_channels_view.dart for the line cap; verbatim styling).

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../models/agri_live_channel.dart';


class LivePlayerBox extends StatelessWidget {
  final AgriLiveChannel channel;
  final bool isPlaying;
  final VideoPlayerController? controller;
  final bool streamError;
  final VoidCallback onTogglePlay;
  final VoidCallback onRetry;
  final VoidCallback onVolume;
  final VoidCallback onFullscreen;

  const LivePlayerBox({
    super.key,
    required this.channel,
    required this.isPlaying,
    required this.controller,
    required this.streamError,
    required this.onTogglePlay,
    required this.onRetry,
    required this.onVolume,
    required this.onFullscreen,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 210,
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE11D48), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFE11D48).withValues(alpha: 0.25),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: SizedBox.expand(child: _buildVideoSurface()),
          ),

          // Live & Viewer Badge Top Left
          Positioned(
            top: 12,
            left: 14,
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDC2626),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.fiber_manual_record_rounded, color: Colors.white, size: 10),
                      SizedBox(width: 4),
                      Text("LIVE", style: TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w900)),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.visibility_rounded, color: Colors.white, size: 12),
                      const SizedBox(width: 4),
                      Text(
                        "${channel.liveViewersCount} प्रेक्षक",
                        style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Bottom Controls Strip
          Positioned(
            bottom: 10,
            left: 14,
            right: 14,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    GestureDetector(
                      onTap: onTogglePlay,
                      child: Icon(
                        isPlaying ? Icons.pause_circle_filled_rounded : Icons.play_circle_filled_rounded,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text("1080p Full HD", style: TextStyle(color: Color(0xFF86EFAC), fontSize: 10.5, fontWeight: FontWeight.w800)),
                  ],
                ),
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.volume_up_rounded, color: Colors.white, size: 20),
                      onPressed: onVolume,
                    ),
                    IconButton(
                      icon: const Icon(Icons.fullscreen_rounded, color: Colors.white, size: 22),
                      onPressed: onFullscreen,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVideoSurface() {
    final c = controller;
    if (streamError) {
      return Container(
        color: Colors.black,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.cloud_off_rounded, size: 40, color: Color(0xFFE9C46A)),
              const SizedBox(height: 6),
              const Text(
                "स्ट्रीम उपलब्ध नहीं",
                style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w900),
              ),
              TextButton(
                onPressed: onRetry,
                child: const Text("पुनः प्रयास करें", style: TextStyle(color: Color(0xFF86EFAC), fontWeight: FontWeight.w800)),
              ),
            ],
          ),
        ),
      );
    }
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
    if (c != null) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFE9C46A)),
      );
    }
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.black, Colors.grey.shade900, const Color(0xFF1F2937)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isPlaying ? Icons.sensors_rounded : Icons.play_circle_outline_rounded,
              size: 52,
              color: const Color(0xFFE9C46A),
            ),
            const SizedBox(height: 6),
            Text(
              channel.channelName,
              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w900),
            ),
            Text(
              channel.vernacularProgram,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFFD8F3DC), fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}

