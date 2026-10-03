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
    // No STT plugin is bundled — never fake a transcript; explain honestly.
    setState(() => _isListening = !_isListening);
    if (_isListening) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(widget.state.tr('voice.typeInstead')),
          duration: const Duration(seconds: 3),
          backgroundColor: const Color(0xFF43A047),
        ),
      );
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted && _isListening) setState(() => _isListening = false);
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
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "Kisan Mitra (किसान मित्र)",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF263238),
                        ),
                      ),
                      Text(
                        widget.state.tr('voice.kisanMitraSubtitle'),
                        style: const TextStyle(fontSize: 11.5, color: Color(0xFF90A4AE)),
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
                Expanded(
                  child: Text(
                    widget.state.tr('voice.expertBanner'),
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF5D4037)),
                  ),
                ),
                TextButton(
                  onPressed: _showExpertHandoff,
                  child: Text(widget.state.tr('voice.expertCall'), style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFFF57F17))),
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
                      hintText: widget.state.tr('voice.askQuestionHint'),
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
                  widget.state.tr('voice.marketInfo'),
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: Colors.orange.shade900),
                ),
              ],
            ),
            const Divider(),
            Text(widget.state.tr('voice.nearYou').replaceAll('{radiusKm}', '${data['radiusKm']}'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            Text(
              widget.state.tr('voice.saturationSummary')
                  .replaceAll('{sowingCount}', '${data['sowingCount']}')
                  .replaceAll('{crop}', '${data['crop']}')
                  .replaceAll('{arrivalIncrease}', '${data['arrivalIncrease']}'),
              style: const TextStyle(fontSize: 12, height: 1.4),
            ),
            const SizedBox(height: 8),

            Text(widget.state.tr('voice.estimatedPrice'), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700)),
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
                Text(widget.state.tr('voice.priceMayFall').replaceAll('{predictedPrice}', '${data['predictedPrice']}'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Colors.red)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: Colors.red.shade100, borderRadius: BorderRadius.circular(4)),
                  child: Text(widget.state.tr('voice.highRisk'), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.red)),
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
                  Text(widget.state.tr('voice.suggestion'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32))),
                  Text(
                    widget.state.tr('voice.alternativeSummary')
                        .replaceAll('{alternativeCrop}', '${data['alternativeCrop']}')
                        .replaceAll('{altPrice}', '${data['altPrice']}'),
                    style: const TextStyle(fontSize: 11.5, height: 1.4, color: Color(0xFF1B5E20)),
                  ),
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
        title: Row(
          children: [
            Icon(Icons.person_pin_rounded, color: Color(0xFF43A047), size: 24),
            SizedBox(width: 8),
            Text(widget.state.tr('voice.seniorScientistHandoff'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          ],
        ),
        content: Text(
          widget.state.tr('voice.handoffMessage'),
          style: const TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              widget.state.showToast(widget.state.tr('voice.expertRequestSent'));
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF43A047)),
            child: Text(widget.state.tr('voice.confirmCall'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}
