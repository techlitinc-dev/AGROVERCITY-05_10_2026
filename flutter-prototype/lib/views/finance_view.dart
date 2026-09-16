// Module N: Embedded Finance Stack Flutter View

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../components/common/glass_card.dart';
import '../components/common/audio_button.dart';

class FinanceView extends StatefulWidget {
  final AppState state;
  const FinanceView({super.key, required this.state});

  @override
  State<FinanceView> createState() => _FinanceViewState();
}

class _FinanceViewState extends State<FinanceView> {
  double _loanAmt = 25000;
  double _tenureMonths = 6;

  @override
  Widget build(BuildContext context) {
    final emi = ((_loanAmt + (_loanAmt * 0.07 * (_tenureMonths / 12))) / _tenureMonths).toInt();

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("एंबेडेड फाइनेंस व साख स्कोर", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  Text("क्रेडिट स्कोर • ₹50k तात्कालिक ऋण • डिजिटल KCC", style: TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              ),
              const AudioButton(text: "आपका किसान साख स्कोर 785 उत्कृष्ट श्रेणी में है। 50 हजार तक का तात्कालिक ऋण 7 प्रतिशत ब्याज पर उपलब्ध है।"),
            ],
          ),
          const SizedBox(height: 14),

          // Credit Score Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1B4332), Color(0xFF0D1F17)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                const Text("भारतीय रिज़र्व बैंक (RBI) डिजिटल लेंडिंग अनुरूप", style: TextStyle(fontSize: 10.5, color: Color(0xFFE9C46A), fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text("${widget.state.profile.kisanCreditScore}", style: const TextStyle(fontSize: 48, fontWeight: FontWeight.w900, color: Color(0xFFE9C46A))),
                Text(widget.state.profile.creditTier, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF52B788))),
                const SizedBox(height: 4),
                const Text("उच्चतम साख सीमा: ₹3,50,000 (समय पर भुगतान व 3.5 एकड़ आधार)", style: TextStyle(fontSize: 11, color: Colors.white70)),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Instant Loan Calculator
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("⚡ तात्कालिक इनपुट ऋण (Instant ₹50,000 Loan)", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                const Text("ब्याज दर: 7% प्रति वर्ष (रियायती)", style: TextStyle(fontSize: 11.5, color: Color(0xFF16A34A), fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),

                Text("ऋण राशि: ₹${_loanAmt.toInt()}", style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                Slider(min: 5000, max: 50000, divisions: 18, value: _loanAmt, onChanged: (v) => setState(() => _loanAmt = v), activeColor: const Color(0xFF1B4332)),

                Text("अवधि: ${_tenureMonths.toInt()} माह", style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                Slider(min: 3, max: 12, value: _tenureMonths, onChanged: (v) => setState(() => _tenureMonths = v), activeColor: const Color(0xFF1B4332)),

                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0xFFD8F3DC), borderRadius: BorderRadius.circular(12)),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text("मासिक किश्त (EMI):", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF1B4332))),
                      Text("₹$emi / माह", style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF1B4332))),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: () => widget.state.showToast("तात्कालिक ऋण स्वीकृत! ₹${_loanAmt.toInt()} आपके SBI खाते में 15 मिनट में जमा होगा।"),
                  icon: const Icon(Icons.bolt_rounded, size: 16),
                  label: Text("खाते में ₹${_loanAmt.toInt()} अभी प्राप्त करें", style: const TextStyle(fontWeight: FontWeight.w800)),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1B4332), foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 42)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Digital KCC Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1E382B), Color(0xFF2D6A4F), Color(0xFFD4A373)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("KISAN CREDIT CARD", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
                    Text("SBI Agri", style: TextStyle(color: Colors.white70, fontSize: 11)),
                  ],
                ),
                const SizedBox(height: 16),
                const Text("4892 •••• •••• 8842", style: TextStyle(color: Colors.white, fontSize: 16, fontFamily: 'monospace', letterSpacing: 2)),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(widget.state.profile.name.toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
                    const Text("सीमा: ₹1,80,000", style: TextStyle(color: Color(0xFFE9C46A), fontWeight: FontWeight.w800, fontSize: 12)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
