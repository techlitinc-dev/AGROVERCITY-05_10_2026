// Live Channels info card / chat box / channel tile (split from
// live_channels_view.dart for the line cap; verbatim styling).

import 'package:flutter/material.dart';

import '../components/common/glass_card.dart';
import '../models/agri_live_channel.dart';

class ChannelInfoCard extends StatelessWidget {
  final AgriLiveChannel channel;
  const ChannelInfoCard({super.key, required this.channel});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                channel.vernacularName,
                style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  channel.category,
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            "वक्ते / अधिकारी: ${channel.currentSpeaker}",
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF1B5E20)),
          ),
          Text(
            "प्रसारक: ${channel.broadcaster} • ${channel.scheduleTime}",
            style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
          ),
        ],
      ),
    );
  }
}

class LiveChatBox extends StatelessWidget {
  final List<ChatMessage> messages;
  final TextEditingController controller;
  final bool rateLimited;
  final VoidCallback onSend;

  const LiveChatBox({
    super.key,
    required this.messages,
    required this.controller,
    required this.rateLimited,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
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
              itemCount: messages.length,
              itemBuilder: (ctx, idx) {
                final msg = messages[idx];
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: RichText(
                    text: TextSpan(
                      style: const TextStyle(fontSize: 11.5, color: Color(0xFF374151)),
                      children: [
                        TextSpan(
                          text: "${msg.userName}: ",
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF1E3A8A),
                          ),
                        ),
                        TextSpan(text: msg.text),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          if (rateLimited)
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text(
                "थोड़ा धीरे भेजें",
                style: TextStyle(fontSize: 10.5, color: Color(0xFFDC2626), fontWeight: FontWeight.w700),
              ),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
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
                onPressed: onSend,
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
    );
  }
}

class ChannelListTile extends StatelessWidget {
  final AgriLiveChannel channel;
  final bool isCurrent;
  final VoidCallback onTap;

  const ChannelListTile({
    super.key,
    required this.channel,
    required this.isCurrent,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final ch = channel;
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
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        clipBehavior: Clip.antiAlias,
        child: ListTile(
        onTap: onTap,
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
      ),
    );
  }
}
