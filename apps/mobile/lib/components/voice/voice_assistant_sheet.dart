// Voice Assistant Modal Sheet (Cupertino Frosted Style)
//
// No STT plugin is bundled, so the mic is honest about its limits: tapping it
// explains that voice input isn't available and to type or tap a prompt
// instead. Every answer comes from POST /chatbot/messages.

import 'dart:ui';
import 'package:flutter/material.dart';
import '../../api/chatbot_api.dart';
import '../../state/app_state.dart';

class VoiceAssistantSheet extends StatefulWidget {
  final AppState state;
  final ChatbotApi? chatbotApi;

  const VoiceAssistantSheet({super.key, required this.state, this.chatbotApi});

  @override
  State<VoiceAssistantSheet> createState() => _VoiceAssistantSheetState();
}

class _VoiceAssistantSheetState extends State<VoiceAssistantSheet> {
  late final ChatbotApi _api = widget.chatbotApi ?? ChatbotApi();
  final _textCtrl = TextEditingController();

  String? _query;
  String? _reply;
  bool _loading = false;
  bool _failed = false;

  static const List<String> _quickPromptKeys = [
    'voice.quickPrompt1',
    'voice.quickPrompt2',
    'voice.quickPrompt3',
    'voice.quickPrompt4',
    'voice.quickPrompt5',
  ];

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit(String text) async {
    final query = text.trim();
    if (query.isEmpty || _loading) return;
    setState(() {
      _query = query;
      _reply = null;
      _loading = true;
      _failed = false;
    });
    try {
      final res = await _api.sendMessage(
        text: query,
        language: widget.state.language,
        context: {
          'district': widget.state.profile.district,
          'village': widget.state.profile.village,
          'activeCrops': widget.state.profile.activeCrops,
        },
      );
      if (!mounted) return;
      final text = res['text'] as String? ?? '';
      setState(() {
        _loading = false;
        _failed = text.isEmpty;
        _reply = text;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failed = true;
        _reply = null;
      });
    }
  }

  void _micTapped() {
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(
      SnackBar(
        content: Text(widget.state.tr('voice.typeInstead')),
        duration: const Duration(seconds: 3),
        backgroundColor: const Color(0xFF43A047),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 25, sigmaY: 25),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFF112A1F).withValues(alpha: 0.95),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
            border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
          ),
          child: SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Top Bar
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.auto_awesome_rounded, color: Color(0xFFE9C46A), size: 18),
                        const SizedBox(width: 8),
                        Text(
                          widget.state.tr('voice.assistantTitle'),
                          style: const TextStyle(
                            color: Color(0xFFE9C46A),
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Colors.white),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Mic — decorative trigger that explains the STT limitation.
                GestureDetector(
                  onTap: _micTapped,
                  child: Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        colors: [Color(0xFFE9C46A), Color(0xFFBC6C25)],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFE9C46A).withValues(alpha: 0.4),
                          blurRadius: 20,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: const Icon(Icons.mic_rounded, color: Color(0xFF112A1F), size: 28),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  widget.state.tr('voice.typeOrTap'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFD8F3DC), fontSize: 12.5, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 14),

                // Transcript Box
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.state.tr('voice.youSaid'),
                          style: const TextStyle(fontSize: 10.5, color: Color(0xFFE9C46A), fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text(
                        _query == null ? widget.state.tr('voice.typeOrTap') : '"$_query"',
                        style: const TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // AI Reply Box
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF52B788).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF52B788), width: 1.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.state.tr('voice.aiReply'),
                          style: const TextStyle(fontSize: 11, color: Color(0xFF86EFAC), fontWeight: FontWeight.w800)),
                      const SizedBox(height: 6),
                      if (_loading)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 6),
                          child: Center(
                            child: SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF86EFAC)),
                            ),
                          ),
                        )
                      else if (_failed)
                        Text(
                          widget.state.tr('chatbot.offlineNotice'),
                          style: const TextStyle(color: Color(0xFFFFCDD2), fontSize: 13, height: 1.4),
                        )
                      else
                        Text(
                          _reply ?? widget.state.tr('voice.typeOrTap'),
                          style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.4),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Text input
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _textCtrl,
                        onSubmitted: _submit,
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                        decoration: InputDecoration(
                          hintText: widget.state.tr('voice.askQuestionHint'),
                          hintStyle: const TextStyle(color: Colors.white54, fontSize: 12.5),
                          filled: true,
                          fillColor: Colors.white.withValues(alpha: 0.08),
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
                      icon: const Icon(Icons.send_rounded, color: Color(0xFFE9C46A)),
                      onPressed: () => _submit(_textCtrl.text),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Quick Prompts
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(widget.state.tr('voice.orTapOne'),
                      style: const TextStyle(fontSize: 11.5, color: Color(0xFFE9C46A), fontWeight: FontWeight.w700)),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: List<Widget>.generate(_quickPromptKeys.length, (i) {
                    return InkWell(
                      onTap: () => _submit(widget.state.tr(_quickPromptKeys[i])),
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
                        ),
                        child: Text("💬 ${widget.state.tr(_quickPromptKeys[i])}",
                            style: const TextStyle(color: Colors.white70, fontSize: 11.5)),
                      ),
                    );
                  }),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
