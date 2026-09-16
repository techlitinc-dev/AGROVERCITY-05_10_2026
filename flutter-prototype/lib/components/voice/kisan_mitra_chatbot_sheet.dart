// CRD Change 8 & 9: Dedicated Kisan Mitra Chatbot Interface

import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../common/glass_card.dart';

class KisanMitraChatbotSheet extends StatefulWidget {
  final AppState state;
  const KisanMitraChatbotSheet({super.key, required this.state});

  @override
  State<KisanMitraChatbotSheet> createState() => _KisanMitraChatbotSheetState();
}

class _KisanMitraChatbotSheetState extends State<KisanMitraChatbotSheet> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isListening = false;

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _sendMessage([String? text]) {
    final msg = text ?? _textController.text.trim();
    if (msg.isNotEmpty) {
      widget.state.sendChatbotMessage(msg);
      _textController.clear();
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 300), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _toggleVoiceListening() {
    setState(() => _isListening = !_isListening);
    if (_isListening) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("🎙️ Bhashini AI: Sun raha hoon... Boliyen \"Tamatar ka bhav\" ya \"Tamatar ugana hai\""),
          duration: Duration(seconds: 3),
          backgroundColor: Color(0xFF43A047),
        ),
      );
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted && _isListening) {
          setState(() => _isListening = false);
          _sendMessage("Is saal tamatar ugane ka soch raha hoon");
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Color(0xFFF5F7FA),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          // Drag Handle
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 4),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    gradient: const RadialGradient(
                      colors: [Color(0xFF81C784), Color(0xFF2E7D32), Color(0xFF1B5E20)],
                    ),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.8),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF43A047).withValues(alpha: 0.35),
                        blurRadius: 10,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.smart_toy_rounded,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Kisan Mitra (किसान मित्र)",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF263238),
                        ),
                      ),
                      Text(
                        "24x7 AI Krishi Salahkar • Voice & Text",
                        style: TextStyle(fontSize: 11.5, color: Color(0xFF90A4AE)),
                      ),
                    ],
                  ),
                ),
                // Language pill
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    widget.state.language.toUpperCase(),
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32)),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Color(0xFF263238)),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          // Messages List
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: widget.state.chatbotMessages.length,
              itemBuilder: (context, index) {
                final msg = widget.state.chatbotMessages[index];
                final isUser = msg.sender == 'user';

                return Column(
                  crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                  children: [
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
                      decoration: BoxDecoration(
                        color: isUser ? const Color(0xFF43A047) : Colors.white,
                        borderRadius: BorderRadius.only(
                          topLeft: const Radius.circular(16),
                          topRight: const Radius.circular(16),
                          bottomLeft: Radius.circular(isUser ? 16 : 4),
                          bottomRight: Radius.circular(isUser ? 4 : 16),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Text(
                        msg.text,
                        style: TextStyle(
                          fontSize: 14,
                          color: isUser ? Colors.white : const Color(0xFF263238),
                          height: 1.4,
                        ),
                      ),
                    ),

                    // CRD Change 9: Rich Market Saturation Advisory Card
                    if (msg.richCardType == 'saturation' && msg.richCardData != null)
                      _buildSaturationCard(msg.richCardData!),

                    // Quick Reply Buttons
                    if (msg.quickReplies != null && msg.quickReplies!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          children: msg.quickReplies!.map((reply) {
                            return ActionChip(
                              backgroundColor: const Color(0xFFE8F5E9),
                              side: BorderSide.none,
                              label: Text(
                                reply,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF2E7D32),
                                ),
                              ),
                              onPressed: () {
                                if (reply.contains('Expert')) {
                                  _showExpertHandoff();
                                } else {
                                  _sendMessage(reply);
                                }
                              },
                            );
                          }).toList(),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),

          // Expert Handoff Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: const Color(0xFFFFF8E1),
            child: Row(
              children: [
                const Icon(Icons.support_agent_rounded, color: Color(0xFFF57F17), size: 20),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    "Sawal samajh nahi aaya? Vishvasniya Krishi Scientist se baat karein.",
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF5D4037)),
                  ),
                ),
                TextButton(
                  onPressed: _showExpertHandoff,
                  child: const Text("Expert Call →", style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFFF57F17))),
                ),
              ],
            ),
          ),

          // Input Bar
          Container(
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: Row(
              children: [
                GestureDetector(
                  onTap: _toggleVoiceListening,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _isListening ? Colors.red : const Color(0xFFE8F5E9),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _isListening ? Icons.mic_rounded : Icons.mic_none_rounded,
                      color: _isListening ? Colors.white : const Color(0xFF2E7D32),
                      size: 22,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _textController,
                    onSubmitted: (_) => _sendMessage(),
                    decoration: InputDecoration(
                      hintText: "Sawal poochein (e.g. Tamatar bhav)...",
                      hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF90A4AE)),
                      filled: true,
                      fillColor: const Color(0xFFF5F7FA),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.send_rounded, color: Color(0xFF43A047)),
                  onPressed: () => _sendMessage(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // CRD Change 9: Saturation Advisory Card Widget
  Widget _buildSaturationCard(Map<String, dynamic> data) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: GlassCard(
        backgroundColor: const Color(0xFFFFFDE7),
        border: Border.all(color: const Color(0xFFFBC02D), width: 1.5),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: Color(0xFFF57F17), size: 20),
                const SizedBox(width: 6),
                Text(
                  "MARKET JAANKARI (Market Saturation Alert)",
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: Colors.orange.shade900),
                ),
              ],
            ),
            const Divider(),
            Text("📍 Aapke ${data['radiusKm']}km ke aas-paas:", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            Text("• ${data['sowingCount']} kisanon ne ${data['crop']} lagaya hai\n• Pichle hafte mandi mein ${data['arrivalIncrease']} zyada aavak aayi", style: const TextStyle(fontSize: 12, height: 1.4)),
            const SizedBox(height: 8),

            const Text("Anumanit Bhav (3 mahine baad):", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            // Risk Meter Bar
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: 0.85,
                minHeight: 12,
                backgroundColor: Colors.grey.shade300,
                color: Colors.red,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("${data['predictedPrice']} (Gir sakta hai)", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Colors.red)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: Colors.red.shade100, borderRadius: BorderRadius.circular(4)),
                  child: const Text("HIGH RISK 🔴", style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.red)),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Alternative Suggestion Box
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F5E9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFA5D6A7)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("💡 Sujhav (Recommended Alternative):", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32))),
                  Text("• ${data['alternativeCrop']} ki demand zyada hai\n• Anumanit bhav: ${data['altPrice']}", style: const TextStyle(fontSize: 11.5, height: 1.4, color: Color(0xFF1B5E20))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showExpertHandoff() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.person_pin_rounded, color: Color(0xFF43A047), size: 24),
            SizedBox(width: 8),
            Text("Senior Scientist Handoff", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          ],
        ),
        content: const Text(
          "Dr. A.K. Sharma (Plant Pathologist) ko aapki chat history aur khet data (Nashik 3.5 acre) bheja ja raha hai.\n\nWhatsApp / Voice Call dwara 5 minute mein sampark hoga.",
          style: TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              widget.state.showToast("Expert Request Sent! Call connecting in 2 mins.");
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF43A047)),
            child: const Text("Call Confirm Karein", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}
