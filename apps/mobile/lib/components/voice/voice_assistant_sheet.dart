// Voice Assistant Modal Sheet (Cupertino Frosted Style)

import 'dart:ui';
import 'package:flutter/material.dart';
import '../../state/app_state.dart';

class VoiceAssistantSheet extends StatefulWidget {
  final AppState state;

  const VoiceAssistantSheet({super.key, required this.state});

  @override
  State<VoiceAssistantSheet> createState() => _VoiceAssistantSheetState();
}

class _VoiceAssistantSheetState extends State<VoiceAssistantSheet> with SingleTickerProviderStateMixin {
  bool _isListening = true;
  String _transcript = "टमाटर का ताजा मंडी भाव और मौसम बताओ";
  String _reply = "पिंपलगांव मंडी में आज टमाटर का मॉडल भाव ₹1,950 प्रति क्विंटल है (+8.4% उछाल)। दोपहर बाद बारिश की संभावना है, अतः सुबह 9 बजे से पहले स्प्रे पूरा करें।";
  late AnimationController _waveController;

  final List<String> _quickPrompts = [
    "टमाटर का ताजा मंडी भाव बताओ",
    "आज का मौसम और स्प्रे सलाह",
    "पीएम-किसान 18वीं किस्त स्टेटस",
    "टमाटर में झुलसा रोग की दवा क्या है?",
    "ट्रैक्टर किराया कितना है?",
  ];

  @override
  void initState() {
    super.initState();
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _waveController.dispose();
    super.dispose();
  }

  void _handlePromptClick(String prompt) {
    setState(() {
      _transcript = prompt;
      if (prompt.contains("मंडी")) {
        _reply = "पिंपलगांव मंडी में टमाटर भाव ₹1,950/q तथा नासिक APMC में ₹2,150/q है।";
      } else if (prompt.contains("मौसम")) {
        _reply = "आज नासिक में 27°C आंशिक बादल हैं। 65% दोपहर बारिश का अनुमान है।";
      } else if (prompt.contains("झुलसा") || prompt.contains("रोग")) {
        _reply = "अगेती झुलसा के लिए मैन्कोजेब 75% WP 2.5g प्रति लीटर पानी में स्प्रे करें।";
      } else if (prompt.contains("ट्रैक्टर")) {
        _reply = "1.8 किमी दूरी पर सुभाष शिंदे जी का महिंद्रा 575 DI ट्रैक्टर ₹600/घंटे में उपलब्ध है।";
      } else {
        _reply = "आपकी प्रोफाइल के अनुसार पीएम-किसान, पीएमएफबीवाई और सॉइल हेल्थ कार्ड सक्रिय हैं।";
      }
    });
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Top Bar
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.auto_awesome_rounded, color: Color(0xFFE9C46A), size: 18),
                      SizedBox(width: 8),
                      Text(
                        "AGROVERCITY वॉइस असिस्टेंट (Bhashini AI)",
                        style: TextStyle(
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
              const SizedBox(height: 20),

              // Central Pulsing Mic
              GestureDetector(
                onTap: () => setState(() => _isListening = !_isListening),
                child: AnimatedBuilder(
                  animation: _waveController,
                  builder: (context, child) {
                    final scale = _isListening ? (1.0 + _waveController.value * 0.12) : 1.0;
                    return Transform.scale(
                      scale: scale,
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: const LinearGradient(
                            colors: [Color(0xFFE9C46A), Color(0xFFBC6C25)],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFE9C46A).withValues(alpha: 0.6),
                              blurRadius: 25,
                              spreadRadius: 4,
                            ),
                          ],
                        ),
                        child: const Icon(Icons.mic_rounded, color: Color(0xFF112A1F), size: 36),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 14),

              Text(
                _isListening ? "🟢 सुन रहा हूँ... बोलिए (Listening)" : "बोलने के लिए माइक दबाएं",
                style: const TextStyle(color: Color(0xFFD8F3DC), fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 16),

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
                    const Text("आपने कहा (You said):", style: TextStyle(fontSize: 10.5, color: Color(0xFFE9C46A), fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text("\"$_transcript\"", style: const TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w600)),
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
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text("AGROVERCITY उत्तर (AI Reply):", style: TextStyle(fontSize: 11, color: Color(0xFF86EFAC), fontWeight: FontWeight.w800)),
                        Icon(Icons.volume_up_rounded, color: Color(0xFF86EFAC), size: 16),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(_reply, style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.4)),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Quick Prompts
              Align(
                alignment: Alignment.centerLeft,
                child: const Text("या इनमें से किसी पर टैप करें:", style: TextStyle(fontSize: 11.5, color: Color(0xFFE9C46A), fontWeight: FontWeight.w700)),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _quickPrompts.map((p) {
                  return InkWell(
                    onTap: () => _handlePromptClick(p),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
                      ),
                      child: Text("💬 $p", style: const TextStyle(color: Colors.white70, fontSize: 11.5)),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
