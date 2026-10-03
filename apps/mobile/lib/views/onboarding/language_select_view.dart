// Step 2: Vernacular Language Selection View (CRD Change 4)

import 'package:flutter/material.dart';
import '../../state/app_state.dart';
import '../../data/regional_languages.dart';
import '../../components/common/motion_animations.dart';
import 'onboarding_progress.dart';


class LanguageSelectView extends StatefulWidget {
  final AppState state;
  const LanguageSelectView({super.key, required this.state});

  @override
  State<LanguageSelectView> createState() => _LanguageSelectViewState();
}

class _LanguageSelectViewState extends State<LanguageSelectView> {
  late String _selectedLang = widget.state.language;

  void _previewAudio(String text) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '🔊 ${widget.state.tr('onboarding.audioPreview')}: "$text"',
        ),
        duration: const Duration(seconds: 2),
        backgroundColor: const Color(0xFF2E7D32),
      ),
    );
  }

  @override
  void didUpdateWidget(LanguageSelectView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.state.language != _selectedLang) {
      _selectedLang = widget.state.language;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.state,
      builder: (context, _) {
        _selectedLang = widget.state.language;
        return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Overall journey progress (Step 1 of 4: Language)
              OnboardingFlowProgress(state: widget.state, currentStep: 1),
              const SizedBox(height: 8),

              // Audio preview action
              Row(
                children: [
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.volume_up_rounded, color: Color(0xFF2E7D32)),
                    onPressed: () => _previewAudio(
                        widget.state.tr('selectLanguagePrompt')),
                  ),
                ],
              ),
              const SizedBox(height: 4),

              // Title
              Text(
                widget.state.tr('selectLanguagePrompt'),
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF263238),
                ),
              ),
              Text(
                widget.state.tr('languagesGrouped'),
                style: const TextStyle(fontSize: 13, color: Color(0xFF90A4AE)),
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
                    Row(
                      children: [
                        const Icon(Icons.my_location_rounded, color: Color(0xFF2E7D32), size: 18),
                        const SizedBox(width: 6),
                        Text(
                          widget.state.tr('gpsDetected'),
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF1B5E20)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    Row(
                      children: [
                        Expanded(
                          child: _buildLangCard(
                            code: 'en',
                            name: 'English',
                            english: 'Default',
                            audioText: 'Welcome to AGROVERCITY. Your land, your business.',
                            badge: widget.state.tr('onboarding.badgeDefault'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _buildLangCard(
                            code: 'mr',
                            name: 'मराठी',
                            english: 'Marathi',
                            audioText: 'नमस्कार! AGROVERCITY मध्ये आपले स्वागत आहे।',
                            badge: widget.state.tr('onboarding.badgeMaharashtra'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _buildLangCard(
                            code: 'hi',
                            name: 'हिन्दी',
                            english: 'Hindi',
                            audioText: 'नमस्ते! AGROVERCITY में आपका स्वागत है।',
                            badge: widget.state.tr('onboarding.badgeNational'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              Text(
                widget.state.tr('otherRegions'),
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF263238)),
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
                                  widget.state.setLanguage(l['code']!);
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
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      widget.state.tr('continueBtn'),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
      },
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
        widget.state.setLanguage(code);
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


