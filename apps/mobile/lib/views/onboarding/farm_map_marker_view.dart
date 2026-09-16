// Step 4: Interactive Farm Geofencing & Map Marker View

import 'package:flutter/material.dart';
import '../../api/api_exception.dart';
import '../../state/app_state.dart';

class FarmMapMarkerView extends StatefulWidget {
  final AppState state;
  const FarmMapMarkerView({super.key, required this.state});

  @override
  State<FarmMapMarkerView> createState() => _FarmMapMarkerViewState();
}

class _FarmMapMarkerViewState extends State<FarmMapMarkerView> {
  double _calculatedAcres = 3.48;
  bool _showMoistureLayer = true;

  final List<Map<String, dynamic>> _pins = [
    {"title": "उत्तर-पश्चिम मेड़ (Pin 1)", "coords": "20.1742° N, 73.9851° E", "x": 60.0, "y": 50.0},
    {"title": "उत्तर-पूर्व कुआं (Pin 2)", "coords": "20.1760° N, 73.9875° E", "x": 240.0, "y": 35.0},
    {"title": "दक्षिण-पूर्व बोरवेल (Pin 3)", "coords": "20.1735° N, 73.9890° E", "x": 260.0, "y": 170.0},
    {"title": "दक्षिण-पश्चिम सड़क (Pin 4)", "coords": "20.1718° N, 73.9862° E", "x": 50.0, "y": 155.0},
  ];

  void _addPin() {
    setState(() {
      _calculatedAcres = 3.48;
    });
    widget.state.showToast("GPS द्वारा खेत के 4 कोने (मेड़) चिन्हित किए गए!");
  }

  bool _confirming = false;

  Future<void> _handleConfirm() async {
    if (_confirming) return;
    setState(() => _confirming = true);
    try {
      await widget.state.confirmFarmMap(
        [
          {"lat": 20.1742, "lng": 73.9851},
          {"lat": 20.1760, "lng": 73.9875},
          {"lat": 20.1735, "lng": 73.9890},
          {"lat": 20.1718, "lng": 73.9862},
        ],
        _calculatedAcres,
      );
    } on ApiException catch (e) {
      widget.state.showToast(e.message.isEmpty ? e.code : e.message);
    } finally {
      if (mounted) setState(() => _confirming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F8F5),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Step
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1B4332),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      "चरण 3 / 3 (Step 3 of 3)",
                      style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: _addPin,
                    icon: const Icon(Icons.my_location_rounded, size: 16, color: Color(0xFF1B4332)),
                    label: const Text("GPS द्वारा खोजें", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF1B4332))),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              const Text(
                "खेत का डिजिटल सीमांकन (Farm Geofencing)",
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF112A1F)),
              ),
              const Text(
                "सैटेलाइट मैप पर अपने खेत के कोनों (मेड़) को पिन करें",
                style: TextStyle(fontSize: 12.5, color: Colors.black54),
              ),
              const SizedBox(height: 14),

              // Interactive Satellite Map Canvas Simulator
              Expanded(
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: const Color(0xFF1F2937),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0xFF52B788), width: 2.0),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 18, offset: const Offset(0, 6)),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(22),
                    child: Stack(
                      children: [
                        // Map Background Grid (Satellite Simulation)
                        Positioned.fill(
                          child: Container(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Color(0xFF264653), Color(0xFF2A9D8F), Color(0xFF1B4332)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                            child: CustomPaint(
                              painter: _FieldPolygonPainter(
                                pins: _pins,
                                showMoisture: _showMoistureLayer,
                              ),
                            ),
                          ),
                        ),

                        // Interactive Pins
                        ..._pins.map((pin) {
                          return Positioned(
                            left: pin['x'] as double,
                            top: pin['y'] as double,
                            child: Column(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.black87,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    pin['title'].toString().split(' ')[0],
                                    style: const TextStyle(color: Color(0xFFE9C46A), fontSize: 9.5, fontWeight: FontWeight.w700),
                                  ),
                                ),
                                const Icon(Icons.location_on_rounded, color: Color(0xFFEF4444), size: 28),
                              ],
                            ),
                          );
                        }),

                        // Map Layer Controls Overlay
                        Positioned(
                          top: 12,
                          right: 12,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.9),
                              borderRadius: BorderRadius.circular(14),
                              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 6)],
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.water_drop_rounded, size: 14, color: Color(0xFF0284C7)),
                                const SizedBox(width: 4),
                                const Text("नमी लेयर", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                                Switch(
                                  value: _showMoistureLayer,
                                  onChanged: (v) => setState(() => _showMoistureLayer = v),
                                  activeThumbColor: const Color(0xFF0284C7),
                                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                              ],
                            ),
                          ),
                        ),

                        // Map Footer Stats Card
                        Positioned(
                          bottom: 12,
                          left: 12,
                          right: 12,
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.94),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFF52B788)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text("सटीक रकबा (Calculated):", style: TextStyle(fontSize: 10.5, color: Colors.grey)),
                                    Text(
                                      "$_calculatedAcres एकड़ (1.41 Ha)",
                                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF1B4332)),
                                    ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFD8F3DC),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text("मृदा: मध्यम काली", style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: Color(0xFF166534))),
                                      Text("खसरा नं: 142/2-A", style: TextStyle(fontSize: 10, color: Color(0xFF14532D))),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Confirm CTA -> Dashboard
              ElevatedButton(
                onPressed: _confirming ? null : _handleConfirm,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1B4332),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 54),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 4,
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.dashboard_rounded, size: 18),
                    SizedBox(width: 8),
                    Text(
                      "खेत की पुष्टि करें व डैशबोर्ड खोलें →",
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
}

class _FieldPolygonPainter extends CustomPainter {
  final List<Map<String, dynamic>> pins;
  final bool showMoisture;

  _FieldPolygonPainter({required this.pins, required this.showMoisture});

  @override
  void paint(Canvas canvas, Size size) {
    if (pins.length < 4) return;

    final path = Path();
    path.moveTo((pins[0]['x'] as double) + 14, (pins[0]['y'] as double) + 24);
    path.lineTo((pins[1]['x'] as double) + 14, (pins[1]['y'] as double) + 24);
    path.lineTo((pins[2]['x'] as double) + 14, (pins[2]['y'] as double) + 24);
    path.lineTo((pins[3]['x'] as double) + 14, (pins[3]['y'] as double) + 24);
    path.close();

    // Fill Field
    final fillPaint = Paint()
      ..color = showMoisture ? const Color(0xFF52B788).withValues(alpha: 0.35) : const Color(0xFFE9C46A).withValues(alpha: 0.3)
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, fillPaint);

    // Border
    final borderPaint = Paint()
      ..color = const Color(0xFFE9C46A)
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke;
    canvas.drawPath(path, borderPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
