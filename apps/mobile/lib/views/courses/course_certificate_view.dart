import 'package:flutter/material.dart';

import '../../state/app_state.dart';

class CourseCertificateView extends StatelessWidget {
  const CourseCertificateView({
    super.key,
    required this.state,
    required this.certificate,
  });

  final AppState state;
  final Map<String, dynamic> certificate;

  @override
  Widget build(BuildContext context) {
    final studentName = certificate['studentName'] as String? ?? 'Student';
    final courseTitle = certificate['courseTitle'] as String? ?? 'Course';
    final instructorName =
        certificate['instructorName'] as String? ?? 'Lead Instructor';
    final certId = certificate['certificateId'] as String? ??
        certificate['id'] as String? ??
        'CERT-AGV';
    final issuedAt = certificate['issuedAt'] as String? ?? '2026';

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text(
          'Certificate of Completion',
          style: TextStyle(
              color: Colors.white, fontSize: 16, fontWeight: FontWeight.w900),
        ),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFDF5),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFD4AF37), width: 4),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFD4AF37).withValues(alpha: 0.25),
                      blurRadius: 24,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    // Seal & Header
                    Container(
                      width: 60,
                      height: 60,
                      decoration: const BoxDecoration(
                        color: Color(0xFFD4AF37),
                        shape: BoxShape.circle,
                      ),
                      child: const Center(
                        child: Icon(Icons.verified_rounded,
                            color: Colors.white, size: 36),
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'AGROVERCITY GYANSETU',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2,
                        color: Color(0xFF854D0E),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'CERTIFICATE OF COMPLETION',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'This is proudly presented to',
                      style: TextStyle(
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      studentName,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'for successfully completing all curriculum requirements for',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      courseTitle,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1B4332),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Divider(color: Colors.amber.shade300, thickness: 1),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              instructorName,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF1E293B),
                              ),
                            ),
                            const Text(
                              'Verified Instructor',
                              style: TextStyle(
                                  fontSize: 10, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              issuedAt.length > 10
                                  ? issuedAt.substring(0, 10)
                                  : issuedAt,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF1E293B),
                              ),
                            ),
                            const Text(
                              'Date Issued',
                              style: TextStyle(
                                  fontSize: 10, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'ID: $certId',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          fontFamily: 'monospace',
                          color: Color(0xFF475569),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD4AF37),
                  foregroundColor: const Color(0xFF0F172A),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () {
                  state.showToast('Certificate saved to Downloads!');
                },
                icon: const Icon(Icons.download_rounded),
                label: const Text(
                  'Download Certificate',
                  style: TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
