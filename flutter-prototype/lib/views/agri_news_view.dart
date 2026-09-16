// Agri News — Daily Market & Weather Updates with Audio Reader

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../models/app_models.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';
import '../components/common/motion_animations.dart';

class AgriNewsView extends StatefulWidget {
  final AppState state;
  const AgriNewsView({super.key, required this.state});

  @override
  State<AgriNewsView> createState() => _AgriNewsViewState();
}

class _AgriNewsViewState extends State<AgriNewsView> {
  String _selectedCategory = "सर्व (All)";

  final List<String> _categories = [
    "सर्व (All)",
    "बाजारभाव व धोरण (Market Policy)",
    "हवामान अलर्ट (Weather Alert)",
    "सरकारी योजना (Govt Subsidy)",
    "कृषी तंत्रज्ञान (Agri Tech)",
  ];

  void _openNewsDetail(AgriNewsItem item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.75,
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0F2FE),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    item.category,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF0369A1)),
                  ),
                ),
                AudioButton(text: "${item.vernacularTitle}. ${item.content}"),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              item.vernacularTitle,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF112A1F), height: 1.3),
            ),
            const SizedBox(height: 6),
            Text(
              "स्रोत: ${item.source} • ${item.timestamp}",
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
            ),
            const Divider(height: 20),
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF9FAFB),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      child: Text(
                        item.summary,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1F2937), height: 1.4),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      item.content,
                      style: const TextStyle(fontSize: 13.5, color: Color(0xFF374151), height: 1.6),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(ctx);
                widget.state.showToast("बातमी शेतकरी व्हॉट्सअ‍ॅप ग्रुपवर शेअर झाली!");
              },
              icon: const Icon(Icons.share_rounded, color: Colors.white, size: 16),
              label: const Text("इतर शेतकऱ्यांना शेअर करा", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                minimumSize: const Size(double.infinity, 44),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filteredNews = widget.state.agriNews.where((n) {
      if (_selectedCategory == "सर्व (All)") return true;
      return n.category.contains(_selectedCategory.split(' ').first);
    }).toList();

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Header with Audio Broadcast
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.newspaper_rounded, color: Color(0xFF0284C7), size: 22),
                      SizedBox(width: 6),
                      Text(
                        "कृषी वार्ता व बाजार अपडेट",
                        style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                      ),
                    ],
                  ),
                  Text(
                    "दैनिक कृषी बाजारभाव, हवामान आणि शासकीय निर्णय",
                    style: TextStyle(fontSize: 11.5, color: Colors.grey, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const AudioButton(text: "आजच्या ताज्या कृषी बातम्या: केंद्र सरकारकडून कांदा खरेदीचे आदेश आणि हवामान इशारा जारी करण्यात आला आहे."),
            ],
          ),
          const SizedBox(height: 14),

          // 2. Breaking News Highlight Strip
          ...widget.state.agriNews.where((n) => n.isBreaking).map((b) => StaggeredSlideFade(
            delayMs: 0,
            child: Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF991B1B), Color(0xFFDC2626), Color(0xFFEA580C)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFDC2626).withValues(alpha: 0.35),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.bolt_rounded, size: 13, color: Color(0xFFDC2626)),
                            SizedBox(width: 3),
                            Text("BREAKING NEWS ⚡", style: TextStyle(color: Color(0xFFDC2626), fontSize: 10, fontWeight: FontWeight.w900)),
                          ],
                        ),
                      ),
                      AudioButton(text: b.audioText),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    b.vernacularTitle,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.white, height: 1.3),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    b.summary,
                    style: const TextStyle(fontSize: 12, color: Color(0xFFFEF2F2), height: 1.35),
                  ),
                ],
              ),
            ),
          )),

          // 3. Category Horizontal Filter Pills
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: _categories.map((cat) {
                final isSel = _selectedCategory == cat;
                return GestureDetector(
                  onTap: () => setState(() => _selectedCategory = cat),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: isSel ? const Color(0xFF0284C7) : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isSel ? const Color(0xFF0284C7) : Colors.grey.shade300,
                      ),
                    ),
                    child: Text(
                      cat.split(' (').first,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: isSel ? FontWeight.w900 : FontWeight.w700,
                        color: isSel ? Colors.white : const Color(0xFF374151),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 14),

          // 4. News Feed List
          ...List.generate(filteredNews.length, (idx) {
            final item = filteredNews[idx];
            return StaggeredSlideFade(
              delayMs: idx * 40,
              child: GlassCard(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFDCFCE7)),
                          ),
                          child: Text(
                            item.category,
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF15803D)),
                          ),
                        ),
                        Row(
                          children: [
                            if (item.impactRating != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                margin: const EdgeInsets.only(right: 6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFEF3C7),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(item.impactRating!, style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF92400E))),
                              ),
                            Text(item.timestamp, style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600)),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item.vernacularTitle,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.summary,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF4B5563), height: 1.35),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            AudioButton(text: item.audioText),
                            const SizedBox(width: 6),
                            Text("स्रोत: ${item.source}", style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
                          ],
                        ),
                        BouncyPressable(
                          onTap: () => _openNewsDetail(item),
                          child: const Text(
                            "सविस्तर वाचा →",
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF0284C7)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
