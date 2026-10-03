// Step 4: Interactive Farm Geofencing & Map Marker View
//
// Two modes:
//  * Real map — web builds with a GOOGLE_MAPS_API_KEY (--dart-define). Tap
//    the map to drop boundary pins; area and boundary length are computed
//    live and confirmed to the backend with real coordinates. Confirm stays
//    disabled until at least 3 pins form a real boundary.
//  * Fallback — no key or non-web platform: live mapping is unavailable, so
//    confirm is blocked with an honest explanation. No fabricated boundary
//    ever leaves this screen.

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../api/api_exception.dart';
import '../../core/geofence_math.dart';
import '../../core/google_maps_key.dart';
import '../../core/google_maps_loader.dart';
import '../../state/app_state.dart';
import 'onboarding_progress.dart';

class FarmMapMarkerView extends StatefulWidget {
  final AppState state;
  const FarmMapMarkerView({super.key, required this.state});

  @override
  State<FarmMapMarkerView> createState() => _FarmMapMarkerViewState();
}

class _FarmMapMarkerViewState extends State<FarmMapMarkerView> {
  bool _showMoistureLayer = true;

  // Real-map state.
  final List<GeoPoint> _pins = [];
  bool _useRealMap = false;
  bool _mapReady = false;
  bool _locating = false;
  GoogleMapController? _mapController;
  // Neutral viewport centre until GPS fixes the real location.
  GeoPoint _center = const GeoPoint(20.5937, 78.9629);

  bool _confirming = false;

  double get _areaAcres => _pins.length >= 3 ? polygonAreaAcres(_pins) : 0;

  @override
  void initState() {
    super.initState();
    _useRealMap = kIsWeb && hasGoogleMapsApiKey;
    if (_useRealMap) _initRealMap();
  }

  Future<void> _initRealMap() async {
    final loaded = await ensureGoogleMapsLoaded(kGoogleMapsApiKey);
    if (!mounted) return;
    if (loaded) {
      setState(() => _mapReady = true);
      _locateFarm();
    } else {
      setState(() => _useRealMap = false);
      widget.state.showToast(widget.state.tr('mapLoadError'));
    }
  }

  Future<void> _locateFarm() async {
    if (_locating) return;
    setState(() => _locating = true);
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return; // Keep the default centre.
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
      if (!mounted) return;
      setState(() => _center = GeoPoint(pos.latitude, pos.longitude));
      await _mapController?.animateCamera(
        CameraUpdate.newLatLng(LatLng(pos.latitude, pos.longitude)),
      );
    } catch (_) {
      // Location unavailable — the user can still drop pins manually.
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  void _addPin(LatLng pos) {
    setState(() => _pins.add(GeoPoint(pos.latitude, pos.longitude)));
  }

  void _removePin(int index) {
    setState(() => _pins.removeAt(index));
  }

  void _undoPin() {
    if (_pins.isNotEmpty) setState(() => _pins.removeLast());
  }

  void _clearPins() => setState(() => _pins.clear());

  List<Map<String, double>> get _pinsJson =>
      _pins.map((p) => p.toJson()).toList();

  Future<void> _handleConfirm() async {
    // Only a user-marked boundary may be confirmed — never a synthetic one.
    if (_pins.length < 3) {
      widget.state.showToast(widget.state.tr('minPinsToast'));
      return;
    }
    await _confirmToBackend(_pinsJson, _areaAcres);
  }

  Future<void> _confirmToBackend(
      List<Map<String, double>> points, double acres) async {
    if (_confirming) return;
    setState(() => _confirming = true);
    try {
      await widget.state.confirmFarmMap(points, acres);
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
          child: _useRealMap ? _buildRealMapView() : _buildFallbackView(),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Real Google Maps geofencing
  // ---------------------------------------------------------------------------
  Widget _buildRealMapView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        OnboardingFlowProgress(state: widget.state, currentStep: 4),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                widget.state.tr('farmGeofencingTitle'),
                style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF112A1F)),
              ),
            ),
            OutlinedButton.icon(
              onPressed: _locating ? null : _locateFarm,
              icon: _locating
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location_rounded,
                      size: 16, color: Color(0xFF1B4332)),
              label: Text(widget.state.tr('findByGps'),
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1B4332))),
            ),
          ],
        ),
        Text(
          widget.state.tr('geofenceRealHint'),
          style: const TextStyle(fontSize: 12.5, color: Colors.black54),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: _mapReady
                ? GoogleMap(
                    initialCameraPosition: CameraPosition(
                      target: LatLng(_center.lat, _center.lng),
                      zoom: 17,
                    ),
                    onMapCreated: (c) => _mapController = c,
                    onTap: _addPin,
                    markers: {
                      for (var i = 0; i < _pins.length; i++)
                        Marker(
                          markerId: MarkerId('pin_$i'),
                          position:
                              LatLng(_pins[i].lat, _pins[i].lng),
                          icon: BitmapDescriptor.defaultMarkerWithHue(
                            BitmapDescriptor.hueGreen,
                          ),
                          onTap: () => _removePin(i),
                          infoWindow: InfoWindow(
                            title:
                                '${widget.state.tr('pinsLabel')} ${i + 1}',
                          ),
                        ),
                    },
                    polygons: {
                      if (_pins.length >= 3)
                        Polygon(
                          polygonId: const PolygonId('farm_boundary'),
                          points: [
                            for (final p in _pins)
                              LatLng(p.lat, p.lng),
                          ],
                          fillColor:
                              const Color(0xFF43A047).withValues(alpha: 0.18),
                          strokeColor: const Color(0xFF2E7D32),
                          strokeWidth: 2,
                        ),
                    },
                    mapToolbarEnabled: false,
                    myLocationButtonEnabled: false,
                    zoomControlsEnabled: false,
                  )
                : const Center(child: CircularProgressIndicator()),
          ),
        ),
        const SizedBox(height: 10),
        _buildMapStatsCard(),
        const SizedBox(height: 10),
        Row(
          children: [
            TextButton.icon(
              onPressed: _pins.isEmpty ? null : _undoPin,
              icon: const Icon(Icons.undo_rounded, size: 16),
              label: Text(widget.state.tr('undoPin')),
            ),
            TextButton.icon(
              onPressed: _pins.isEmpty ? null : _clearPins,
              icon: const Icon(Icons.delete_outline_rounded, size: 16),
              label: Text(widget.state.tr('clearPins')),
            ),
          ],
        ),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _confirming || _pins.length < 3
                ? null
                : _handleConfirm,
            icon: _confirming
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.check_rounded),
            label: Text(widget.state.tr('confirmFarmAndOpen')),
          ),
        ),
      ],
    );
  }

  Widget _buildMapStatsCard() {
    final area = _areaAcres;
    final perimeter = _pins.length >= 2 ? polygonPerimeterM(_pins) : 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFDCE5DC)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _stat(
              widget.state.tr('calculatedAcresLabel'),
              _pins.length < 3
                  ? '—'
                  : '${area.toStringAsFixed(2)} ${widget.state.tr('acresUnit')}'),
          _stat(widget.state.tr('boundaryLabel'),
              _pins.length < 2 ? '—' : '${perimeter.round()} m'),
          _stat(widget.state.tr('pinsLabel'), '${_pins.length}'),
        ],
      ),
    );
  }

  Widget _stat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 10.5, color: Colors.black54)),
        Text(value,
            style: const TextStyle(
                fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF1B4332))),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Fallback (no API key / non-web): no live map, so no boundary can be marked
  // and confirm stays blocked — nothing synthetic is sent to the backend.
  // ---------------------------------------------------------------------------
  Widget _buildFallbackView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Overall journey progress (Step 4 of 4: Farm Map)
        OnboardingFlowProgress(state: widget.state, currentStep: 4),
        const SizedBox(height: 8),

        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            OutlinedButton.icon(
              onPressed: () =>
                  widget.state.showToast(widget.state.tr('map.fallbackUnavailable')),
              icon: const Icon(Icons.my_location_rounded,
                  size: 16, color: Color(0xFF1B4332)),
              label: Text(widget.state.tr('findByGps'),
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1B4332))),
            ),
          ],
        ),
        const SizedBox(height: 10),

        Text(
          widget.state.tr('farmGeofencingTitle'),
          style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: Color(0xFF112A1F)),
        ),
        Text(
          widget.state.tr('farmGeofencingSub'),
          style: const TextStyle(fontSize: 12.5, color: Colors.black54),
        ),
        const SizedBox(height: 14),
        Expanded(
          child: Container(
            width: double.infinity,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF1B4332), Color(0xFF2D6A4F), Color(0xFF40916C)],
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF1B4332).withValues(alpha: 0.3),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: Stack(
                children: [
                  // Grid lines for map-like feel
                  CustomPaint(
                    size: Size.infinite,
                    painter: _GridPainter(),
                  ),
                  if (_showMoistureLayer)
                    Positioned(
                      left: 30,
                      top: 40,
                      child: Container(
                        width: 150,
                        height: 100,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            colors: [
                              const Color(0xFF74C69D).withValues(alpha: 0.5),
                              const Color(0xFF74C69D).withValues(alpha: 0.0),
                            ],
                          ),
                        ),
                      ),
                    ),
                  // Honest blocked state — no sample pins or polygon.
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.map_rounded,
                              color: Colors.white54, size: 44),
                          const SizedBox(height: 10),
                          Text(
                            widget.state.tr('map.fallbackUnavailable'),
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 12,
                                height: 1.5),
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
        const SizedBox(height: 14),
        // Area readout — nothing computed until a real boundary exists.
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              widget.state.tr('calculatedAcresLabel'),
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF112A1F)),
            ),
            const Text(
              '—',
              style: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF2E7D32)),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Switch(
                  value: _showMoistureLayer,
                  activeThumbColor: const Color(0xFF2E7D32),
                  onChanged: (v) => setState(() => _showMoistureLayer = v),
                ),
                Text(widget.state.tr('moistureLayer'),
                    style: const TextStyle(
                        fontSize: 12.5, fontWeight: FontWeight.w700)),
              ],
            ),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: null,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2E7D32),
              foregroundColor: Colors.white,
              disabledBackgroundColor: Colors.grey.shade400,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
            ),
            icon: const Icon(Icons.check_circle_outline),
            label: Text(widget.state.tr('confirmFarmAndOpen'),
                style:
                    const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
          ),
        ),
      ],
    );
  }
}

class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.06)
      ..strokeWidth = 1;
    for (double x = 0; x < size.width; x += 28) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += 28) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
