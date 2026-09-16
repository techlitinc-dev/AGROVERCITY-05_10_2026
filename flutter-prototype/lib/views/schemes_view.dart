// Module M: Government Scheme Intelligence Flutter View (CRD Change 6) & Motion Animations

import 'package:flutter/material.dart';
import '../state/app_state.dart';
import '../models/app_models.dart';
import '../data/demo_data.dart';
import '../components/common/glass_card.dart';
import '../components/common/motion_animations.dart';

class SchemesView extends StatefulWidget {
  final AppState state;
  const SchemesView({super.key, required this.state});

  @override
  State<SchemesView> createState() => _SchemesViewState();
}

class _SchemesViewState extends State<SchemesView> {
  void _showDocumentVault() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.lock_rounded, color: Color(0xFF2E7D32), size: 20),
                SizedBox(width: 8),
                Text("सुरक्षित किसान दस्तावेज़ वॉल्ट (AES-256 Encrypted)", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              ],
            ),
            const SizedBox(height: 14),
            _docItem("आधार कार्ड (Aadhaar)", "XXXX-XXXX-8842", true),
            _docItem("भूलेख 7/12 खतौनी", "Survey No. 142/2-A", true),
            _docItem("बैंक पासबुक (SBI)", "A/C **8842 (DBT Active)", true),
            _docItem("मृदा स्वास्थ्य कार्ड", "SHC-2026-NPK-99", true),
          ],
        ),
      ),
    );
  }

  Widget _docItem(String title, String num, bool verified) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              Text(num, style: const TextStyle(fontSize: 11, color: Colors.grey)),
            ],
          ),
          const Row(
            children: [
              Icon(Icons.verified_rounded, color: Color(0xFF16A34A), size: 16),
              SizedBox(width: 4),
              Text("Encrypted", style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF16A34A))),
            ],
          ),
        ],
      ),
    );
  }

  void _openOfficialPortalModal(GovtScheme scheme) {
    final portalUrl = schemePortalUrls[scheme.id] ?? 'https://pmkisan.gov.in';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.75,
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Security Banner (CRD Change 6)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F5E9),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFA5D6A7)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.security_rounded, color: Color(0xFF2E7D32), size: 22),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      "🛡️ SECURITY BANNER: Aap sarkari portal par ja rahe hain. AGROVERCITY aapka data surakshit rakhta hai.",
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF1B5E20)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(scheme.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            Text("Redirecting to: $portalUrl", style: const TextStyle(fontSize: 11.5, color: Color(0xFF0284C7))),
            const SizedBox(height: 14),

            // In-App Browser Simulation Frame
            Expanded(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.public_rounded, size: 48, color: Color(0xFF43A047)),
                    const SizedBox(height: 12),
                    Text(
                      "Official Portal: ${scheme.name}",
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      "Farmer Login & Aadhaar OTP Integration Active",
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                    const SizedBox(height: 14),
                    BouncyPressable(
                      onTap: () {
                        Navigator.pop(ctx);
                        widget.state.showToast("Official Portal Session Connected via Secure Bridge!");
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF43A047),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.open_in_browser_rounded, size: 16, color: Colors.white),
                            SizedBox(width: 6),
                            Text("Open in External Browser", style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Fallback Note
            const Text(
              "Fallback Note: \"Sarkari website thodi der mein uplabdh hogi. Kripya baad mein koshish karein.\"",
              style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 140),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          StaggeredSlideFade(
            delayMs: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Government Schemes", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF263238))),
                    Text("Hybrid Access: AGROVERCITY vs Official Portal", style: TextStyle(fontSize: 11.5, color: Color(0xFF90A4AE))),
                  ],
                ),
                BouncyPressable(
                  onTap: _showDocumentVault,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFF43A047)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.lock_outline_rounded, size: 14, color: Color(0xFF43A047)),
                        SizedBox(width: 4),
                        Text("Vault", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF43A047))),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          ...List.generate(widget.state.appliedSchemes.length, (index) {
            final s = widget.state.appliedSchemes[index];
            return StaggeredSlideFade(
              delayMs: 100 + (index * 70),
              child: _buildSchemeCard(s),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildSchemeCard(GovtScheme s) {
    return GlassCard(
      backgroundColor: Colors.white,
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(s.category, style: const TextStyle(fontSize: 11, color: Color(0xFF43A047), fontWeight: FontWeight.w800)),
                  Text(s.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF263238))),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(8)),
                child: Text(s.benefitAmount, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32))),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(s.description, style: const TextStyle(fontSize: 12, color: Colors.black87)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: const Color(0xFFF5F7FA), borderRadius: BorderRadius.circular(8)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("Status: ${s.status}", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF263238))),
                Text("Deadline: ${s.nextDeadline}", style: const TextStyle(fontSize: 10.5, color: Colors.grey)),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // CRD Change 6: Dual Options (Apply via Kisan Setu vs Apply on Official Portal)
          Row(
            children: [
              Expanded(
                child: BouncyPressable(
                  onTap: () => widget.state.applyForScheme(s.id),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 9),
                    decoration: BoxDecoration(
                      color: const Color(0xFF43A047),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.check_rounded, size: 14, color: Colors.white),
                        SizedBox(width: 4),
                        Text("Apply via App", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Colors.white)),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: BouncyPressable(
                  onTap: () => _openOfficialPortalModal(s),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFF2E7D32)),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.open_in_new_rounded, size: 14, color: Color(0xFF2E7D32)),
                        SizedBox(width: 4),
                        Text("Official Portal →", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF2E7D32))),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}


