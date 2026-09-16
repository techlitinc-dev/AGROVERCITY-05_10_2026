// Farmer Live Channels — Live Streaming & Agri Broadcasts

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';
import '../components/common/motion_animations.dart';

class LiveChannelsView extends StatefulWidget {
  final AppState state;
  const LiveChannelsView({super.key, required this.state});

  @override
  State<LiveChannelsView> createState() => _LiveChannelsViewState();
}

class _LiveChannelsViewState extends State<LiveChannelsView> {
  late AgriLiveChannel _activeChannel;
  bool _isPlaying = true;
  final TextEditingController _chatController = TextEditingController();
  final List<Map<String, String>> _liveChat = [
    {"user": "Ramesh (Niphad)", "msg": "पिंपळगावला टोमॅटोचा टॉप भाव काय निघाला?"},
    {"user": "Suresh Patil", "msg": "नाशिक बाजारात आज आवक भरपूर आहे."},
    {"user": "Kisan Mitra Bot", "msg": "थेट लिलाव दर: टोमॅटो ₹480/क्रेट, कांदा ₹2200/क्विंटल."},
  ];

  @override
  void initState() {
    super.initState();
    _activeChannel = widget.state.liveChannels.first;
  }

  void _sendChatMessage() {
    if (_chatController.text.trim().isEmpty) return;
    setState(() {
      _liveChat.add({
        "user": "${widget.state.profile.name} (तुम्ही)",
        "msg": _chatController.text.trim(),
      });
    });
    _chatController.clear();
    widget.state.showToast("लाईव्ह चॅट मेसेज पाठवला!");
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Header Bar
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.live_tv_rounded, color: Color(0xFFE11D48), size: 22),
                      SizedBox(width: 6),
                      Text(
                        "शेतकरी लाईव्ह चॅनेल्स",
                        style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                      ),
                    ],
                  ),
                  Text(
                    "थेट कृषी प्रक्षेपण, मंडी लिलाव व शास्त्रज्ञ संवाद",
                    style: TextStyle(fontSize: 11.5, color: Colors.grey, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const AudioButton(text: "शेतकरी लाईव्ह चॅनेल्स मध्ये आपले स्वागत आहे. येथे डीडी किसान, कृषी विज्ञान केंद्र आणि थेट मंडी लिलाव प्रक्षेपण सुरू आहे."),
            ],
          ),
          const SizedBox(height: 14),

          // 2. Main Live Video Player Simulation Box
          StaggeredSlideFade(
            delayMs: 0,
            child: Container(
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
                  // Video Screen Visual Simulator
                  Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
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
                            _isPlaying ? Icons.sensors_rounded : Icons.play_circle_outline_rounded,
                            size: 52,
                            color: const Color(0xFFE9C46A),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _activeChannel.channelName,
                            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w900),
                          ),
                          Text(
                            _activeChannel.vernacularProgram,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Color(0xFFD8F3DC), fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
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
                                "${_activeChannel.liveViewersCount} प्रेक्षक",
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
                              onTap: () => setState(() => _isPlaying = !_isPlaying),
                              child: Icon(
                                _isPlaying ? Icons.pause_circle_filled_rounded : Icons.play_circle_filled_rounded,
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
                              onPressed: () => widget.state.showToast("आवाज चालू आहे"),
                            ),
                            IconButton(
                              icon: const Icon(Icons.fullscreen_rounded, color: Colors.white, size: 22),
                              onPressed: () => widget.state.showToast("फुल स्क्रीन मोड सुरू"),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          // 3. Channel Info Details
          GlassCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _activeChannel.vernacularName,
                      style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE8F5E9),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _activeChannel.category,
                        style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  "वक्ते / अधिकारी: ${_activeChannel.currentSpeaker}",
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF1B5E20)),
                ),
                Text(
                  "प्रसारक: ${_activeChannel.broadcaster} • ${_activeChannel.scheduleTime}",
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 4. Live Chat Simulation Box
          GlassCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.chat_bubble_rounded, size: 16, color: Color(0xFF2E7D32)),
                    SizedBox(width: 6),
                    Text(
                      "थेट शेतकरी चर्चा (Live Chat)",
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                    ),
                  ],
                ),
                const Divider(height: 16),
                Container(
                  constraints: const BoxConstraints(maxHeight: 120),
                  child: ListView.builder(
                    shrinkWrap: true,
                    physics: const BouncingScrollPhysics(),
                    itemCount: _liveChat.length,
                    itemBuilder: (ctx, idx) {
                      final msg = _liveChat[idx];
                      final isUser = msg["user"]!.contains("तुम्ही");
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: RichText(
                          text: TextSpan(
                            style: const TextStyle(fontSize: 11.5, color: Color(0xFF374151)),
                            children: [
                              TextSpan(
                                text: "${msg["user"]}: ",
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  color: isUser ? const Color(0xFF2E7D32) : const Color(0xFF1E3A8A),
                                ),
                              ),
                              TextSpan(text: msg["msg"]),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _chatController,
                        style: const TextStyle(fontSize: 12),
                        decoration: InputDecoration(
                          hintText: "लाईव्ह प्रश्न किंवा प्रतिक्रिया लिहा...",
                          hintStyle: TextStyle(fontSize: 11.5, color: Colors.grey.shade400),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: _sendChatMessage,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1B4332),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      ),
                      child: const Icon(Icons.send_rounded, color: Colors.white, size: 16),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 5. All Live Channels List
          const Text(
            "उपलब्ध थेट कृषी वाहिन्या (All Channels)",
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
          ),
          const SizedBox(height: 10),

          ...widget.state.liveChannels.map((ch) {
            final isCurrent = _activeChannel.id == ch.id;
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              decoration: BoxDecoration(
                color: isCurrent ? const Color(0xFFE8F5E9) : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isCurrent ? const Color(0xFF2E7D32) : Colors.grey.shade200,
                  width: isCurrent ? 1.8 : 1.0,
                ),
              ),
              child: ListTile(
                onTap: () => setState(() => _activeChannel = ch),
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: isCurrent ? const Color(0xFF1B4332) : const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    ch.isLiveNow ? Icons.live_tv_rounded : Icons.schedule_rounded,
                    color: isCurrent ? const Color(0xFFE9C46A) : const Color(0xFF374151),
                    size: 22,
                  ),
                ),
                title: Text(
                  ch.vernacularName,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: isCurrent ? const Color(0xFF1B4332) : Colors.black87,
                  ),
                ),
                subtitle: Text(
                  "${ch.broadcaster} • ${ch.scheduleTime}",
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                ),
                trailing: ch.isLiveNow
                    ? Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDC2626),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text("LIVE", style: TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w900)),
                      )
                    : const Icon(Icons.play_circle_outline_rounded, size: 20, color: Colors.grey),
              ),
            );
          }),
        ],
      ),
    );
  }
}
