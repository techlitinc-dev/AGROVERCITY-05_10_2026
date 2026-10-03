// Agri News widgets — breaking banner, news card, detail sheet (split from
// agri_news_view.dart for the line cap; styling/strings verbatim port).

import 'package:flutter/material.dart';

import '../components/common/audio_button.dart';
import '../components/common/glass_card.dart';
import '../models/agri_news_item.dart';
import '../state/app_state.dart';

class NewsBreakingBanner extends StatelessWidget {
  final AgriNewsItem item;
  final AppState state;
  const NewsBreakingBanner({super.key, required this.item, required this.state});

  @override
  Widget build(BuildContext context) {
    return Container(
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
                child: Row(
                  children: [
                    const Icon(Icons.bolt_rounded, size: 13, color: Color(0xFFDC2626)),
                    const SizedBox(width: 3),
                    Text(state.tr('content.breakingNews'), style: const TextStyle(color: Color(0xFFDC2626), fontSize: 10, fontWeight: FontWeight.w900)),
                  ],
                ),
              ),
              AudioButton(text: item.audioText),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            item.vernacularTitle,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.white, height: 1.3),
          ),
          const SizedBox(height: 4),
          Text(
            item.summary,
            style: const TextStyle(fontSize: 12, color: Color(0xFFFEF2F2), height: 1.35),
          ),
        ],
      ),
    );
  }
}

class NewsCard extends StatelessWidget {
  final AgriNewsItem item;
  final AppState state;
  final VoidCallback onReadMore;

  const NewsCard({super.key, required this.item, required this.state, required this.onReadMore});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
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
                  Text("${state.tr('content.sourceLabel')}: ${item.source}", style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
                ],
              ),
              GestureDetector(
                onTap: onReadMore,
                child: Text(
                  state.tr('content.readMore'),
                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF0284C7)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class NewsDetailSheet extends StatelessWidget {
  final AgriNewsItem item;
  final AppState state;
  final VoidCallback onShare;

  const NewsDetailSheet({super.key, required this.item, required this.state, required this.onShare});

  @override
  Widget build(BuildContext context) {
    return Container(
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
            onPressed: onShare,
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
    );
  }
}
