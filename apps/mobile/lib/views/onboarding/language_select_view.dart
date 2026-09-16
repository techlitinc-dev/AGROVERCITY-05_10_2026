// Step 2: Vernacular Language Selection View (CRD Change 4)

import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../data/demo_data.dart';
import '../../components/common/motion_animations.dart';


class LanguageSelectView extends StatefulWidget {
  final AppState state;
  const LanguageSelectView({super.key, required this.state});

  @override
  State<LanguageSelectView> createState() => _LanguageSelectViewState();
}

class _LanguageSelectViewState extends State<LanguageSelectView> {
  String _selectedLang = 'mr';

  void _previewAudio(String text) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text("🔊 Audio Preview: \"$text\""),
        duration: const Duration(seconds: 2),
        backgroundColor: const Color(0xFF2E7D32),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Progress Header
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2E7D32),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      "Step 1 of 3 • Language",
                      style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.volume_up_rounded, color: Color(0xFF2E7D32)),
                    onPressed: () => _previewAudio("Kripya aapni bhasha chunein."),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Title
              const Text(
                "अपनी भाषा चुनें",
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF263238),
                ),
              ),
              const Text(
                "Select Your Preferred Language (Grouped by Region)",
                style: TextStyle(fontSize: 13, color: Color(0xFF90A4AE)),
              ),
              const SizedBox(height: 14),

              // Top Section: GPS Suggested Region Languages
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFA5D6A7)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.my_location_rounded, color: Color(0xFF2E7D32), size: 18),
                        SizedBox(width: 6),
                        Text(
                          "Aapke Area ki Bhasha (Suggested by GPS):",
                          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF1B5E20)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "Detected Location: Nashik, Maharashtra (West India)",
                      style: TextStyle(fontSize: 11.5, color: Colors.green.shade800),
                    ),
                    const SizedBox(height: 10),

                    Row(
                      children: [
                        Expanded(
                          child: _buildLangCard(
                            code: 'mr',
                            name: 'मराठी',
                            english: 'Marathi',
                            audioText: 'नमस्कार! AGROVERCITY मध्ये आपले स्वागत आहे।',
                            badge: '⚡ Top Recommendation',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildLangCard(
                            code: 'hi',
                            name: 'हिन्दी',
                            english: 'Hindi',
                            audioText: 'नमस्ते! AGROVERCITY में आपका स्वागत है।',
                            badge: 'Secondary Suggestion',
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              const Text(
                "Aur Bhashaen (Other Regional Languages):",
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF263238)),
              ),
              const SizedBox(height: 8),

              // All Other Languages Grid
              Expanded(
                child: ListView.builder(
                  physics: const BouncingScrollPhysics(),
                  itemCount: regionalLanguageMapping.length,
                  itemBuilder: (context, idx) {
                    final reg = regionalLanguageMapping[idx];
                    final String regTitle = reg['region'] as String;
                    final String states = reg['states'] as String;
                    final langs = reg['priorityLanguages'] as List<Map<String, String>>;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFECEFF1)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(regTitle, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32))),
                          Text(states, style: const TextStyle(fontSize: 11, color: Color(0xFF90A4AE))),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: langs.map((l) {
                              final isSel = _selectedLang == l['code'];
                              return ChoiceChip(
                                avatar: const Icon(Icons.volume_up_rounded, size: 14, color: Color(0xFF2E7D32)),
                                label: Text("${l['name']} (${l['english']})"),
                                selected: isSel,
                                selectedColor: const Color(0xFFE8F5E9),
                                onSelected: (_) {
                                  setState(() => _selectedLang = l['code']!);
                                  _previewAudio(l['audio']!);
                                },
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),

              // Continue Button
              ElevatedButton(
                onPressed: () => widget.state.selectLanguageAndProceed(_selectedLang),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF43A047),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 50),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      "भाषा चुनें और आगे बढ़ें (Continue) →",
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLangCard({
    required String code,
    required String name,
    required String english,
    required String audioText,
    required String badge,
  }) {
    final isSel = _selectedLang == code;
    return BouncyPressable(
      onTap: () {
        setState(() => _selectedLang = code);
        _previewAudio(audioText);
      },
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFF43A047) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isSel ? const Color(0xFF43A047) : const Color(0xFFA5D6A7)),
          boxShadow: isSel
              ? [
                  BoxShadow(
                    color: const Color(0xFF43A047).withValues(alpha: 0.35),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  name,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: isSel ? Colors.white : const Color(0xFF263238),
                  ),
                ),
                Icon(
                  Icons.volume_up_rounded,
                  size: 16,
                  color: isSel ? Colors.white : const Color(0xFF2E7D32),
                ),
              ],
            ),
            Text(
              english,
              style: TextStyle(
                fontSize: 11,
                color: isSel ? const Color(0xFFE8F5E9) : const Color(0xFF90A4AE),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              badge,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                color: isSel ? const Color(0xFFFFF176) : const Color(0xFF2E7D32),
              ),
            ),
          ],
        ),
      ),
    );
  }
}


