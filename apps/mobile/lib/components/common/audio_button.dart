import 'package:flutter/material.dart';

class AudioButton extends StatefulWidget {
  final String text;
  final String label;

  const AudioButton({
    super.key,
    required this.text,
    this.label = "सुनिए",
  });

  @override
  State<AudioButton> createState() => _AudioButtonState();
}

class _AudioButtonState extends State<AudioButton> with SingleTickerProviderStateMixin {
  bool _isPlaying = false;
  late AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _handlePlay() {
    setState(() => _isPlaying = true);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text("🔊 वाचन हो रहा है: \"${widget.text}\""),
        duration: const Duration(seconds: 2),
        backgroundColor: const Color(0xFF1B4332),
      ),
    );
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) setState(() => _isPlaying = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handlePlay,
      child: AnimatedBuilder(
        animation: _animController,
        builder: (context, child) {
          final scale = _isPlaying ? (1.0 + _animController.value * 0.08) : 1.0;
          return Transform.scale(
            scale: scale,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: _isPlaying ? const Color(0xFFE9C46A) : const Color(0xFFD8F3DC),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: _isPlaying ? const Color(0xFFBC6C25) : const Color(0xFF52B788),
                  width: 1.2,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _isPlaying ? Icons.volume_up_rounded : Icons.volume_down_rounded,
                    size: 14,
                    color: _isPlaying ? const Color(0xFF112A1F) : const Color(0xFF1B4332),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    widget.label,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: _isPlaying ? const Color(0xFF112A1F) : const Color(0xFF1B4332),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
