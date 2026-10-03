// Crop insurance header (PMFBY seal + coverage stats) and the 72-hour
// emergency banner with the national helpline dialer (tel:14447).

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../components/common/audio_button.dart';
import '../../components/common/motion_animations.dart';

// 72-hour compliance notice shown above the claim form.


final _rupeeFormat =
    NumberFormat.currency(locale: 'hi_IN', symbol: '₹', decimalDigits: 0);

class InsuranceHeader extends StatelessWidget {
  final double totalAreaAcres;
  final double totalSumInsured;
  final double totalSubsidy;

  const InsuranceHeader({
    super.key,
    required this.totalAreaAcres,
    required this.totalSumInsured,
    required this.totalSubsidy,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF064E3B), Color(0xFF047857), Color(0xFF059669)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF047857).withValues(alpha: 0.35),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFFBBF24), width: 1.5),
                    ),
                    child: const Icon(Icons.shield_rounded, color: Color(0xFFFBBF24), size: 24),
                  ),
                  const SizedBox(width: 12),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "प्रधानमंत्री फसल बीमा",
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                          letterSpacing: 0.2,
                        ),
                      ),
                      Text(
                        "PMFBY & पुनर्रचित मौसम बीमा (RWBCIS)",
                        style: TextStyle(
                          color: Color(0xFFD1FAE5),
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const AudioButton(
                text: "प्रधानमंत्री फसल बीमा योजना के तहत प्राकृतिक आपदा से फसल क्षति होने पर 72 घंटे के भीतर ऐप द्वारा क्लेम सूचना दर्ज करें। खरीफ फसलों के लिए मात्र 2 प्रतिशत और रबी फसलों के लिए केवल डेढ़ प्रतिशत प्रीमियम देना होता है।",
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _stat("कुल बीमित रकबा", "${totalAreaAcres.toStringAsFixed(1)} एकड़", Icons.landscape_rounded),
                Container(height: 24, width: 1, color: Colors.white24),
                _stat("कुल सुरक्षा कवर", _rupeeFormat.format(totalSumInsured), Icons.currency_rupee_rounded),
                Container(height: 24, width: 1, color: Colors.white24),
                _stat("सरकारी सब्सिडी", _rupeeFormat.format(totalSubsidy), Icons.savings_rounded),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _stat(String title, String value, IconData icon) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: const Color(0xFFFDE68A), size: 12),
            const SizedBox(width: 4),
            Text(title, style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 10, fontWeight: FontWeight.w600)),
          ],
        ),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w900)),
      ],
    );
  }
}

class InsuranceEmergencyBanner extends StatelessWidget {
  const InsuranceEmergencyBanner({super.key});

  Future<void> _callHelpline() async {
    try {
      await launchUrl(Uri.parse('tel:14447'));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFDE68A), width: 1.2),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
              color: Color(0xFFFEF3C7),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.timer_outlined, color: Color(0xFFD97706), size: 20),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      "72 घंटे की आपातकालीन समयसीमा",
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 12.5,
                        color: Color(0xFF92400E),
                      ),
                    ),
                    SizedBox(width: 6),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        color: Color(0xFFDC2626),
                        borderRadius: BorderRadius.all(Radius.circular(6)),
                      ),
                      child: Padding(
                        padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        child: Text("जरूरी", style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 2),
                Text(
                  "नुकसान होने पर 72 घंटे में सूचना दें। राष्ट्रीय हेल्पलाइन: 14447",
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF78350F),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          BouncyPressable(
            onTap: _callHelpline,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF92400E),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.call_rounded, color: Colors.white, size: 14),
                  SizedBox(width: 4),
                  Text("14447", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11.5)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> launchPmfbyPortal() async {
  try {
    await launchUrl(
      Uri.parse('https://pmfby.gov.in'),
      mode: LaunchMode.externalApplication,
    );
  } catch (_) {}
}

class ClaimUrgentCard extends StatelessWidget {
  const ClaimUrgentCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF7F1D1D), Color(0xFF991B1B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Color(0xFFFDE68A), size: 20),
              SizedBox(width: 8),
              Text(
                "72 घंटे के भीतर दावा सूचना (PMFBY Guidelines)",
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13),
              ),
            ],
          ),
          SizedBox(height: 6),
          Text(
            "ओलावृष्टि, जलभराव, बादल फटना या बेमौसम वर्षा से फसल नुकसान होने के 72 घंटे के भीतर सूचना देना अनिवार्य है। आपके द्वारा दर्ज विवरण सीधे बीमा कंपनी व कृषि विभाग को भेजा जाएगा।",
            style: TextStyle(color: Color(0xFFFEE2E2), fontSize: 11, height: 1.35),
          ),
        ],
      ),
    );
  }
}

