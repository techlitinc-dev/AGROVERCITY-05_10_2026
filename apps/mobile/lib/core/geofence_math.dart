// Geodesic helpers for digital farm geofencing.
//
// Boundary areas are computed with a local equirectangular projection
// (accurate to well under 1% for fields of a few hundred metres) and the
// shoelace formula — good enough for farm acreage without pulling in a
// full GIS dependency.

import 'dart:math' as math;

/// A single geofence vertex.
class GeoPoint {
  const GeoPoint(this.lat, this.lng);

  final double lat;
  final double lng;

  factory GeoPoint.fromJson(Map<String, double> json) =>
      GeoPoint(json['lat'] ?? 0, json['lng'] ?? 0);

  Map<String, double> toJson() => {'lat': lat, 'lng': lng};
}

/// Approximate metres per degree of latitude.
const double _mPerDegLat = 111320.0;

/// Signed planar area of a polygon in m² using the shoelace formula after an
/// equirectangular projection around the polygon centroid.
double polygonAreaSqM(List<GeoPoint> points) {
  if (points.length < 3) return 0;
  final centroidLat =
      points.map((p) => p.lat).reduce((a, b) => a + b) / points.length;
  final mPerDegLng = _mPerDegLat * math.cos(_toRad(centroidLat));

  var sum = 0.0;
  for (var i = 0; i < points.length; i++) {
    final a = points[i];
    final b = points[(i + 1) % points.length];
    final x1 = (a.lng - points.first.lng) * mPerDegLng;
    final y1 = (a.lat - centroidLat) * _mPerDegLat;
    final x2 = (b.lng - points.first.lng) * mPerDegLng;
    final y2 = (b.lat - centroidLat) * _mPerDegLat;
    sum += x1 * y2 - x2 * y1;
  }
  return sum.abs() / 2;
}

const double _acresPerSqM = 1 / 4046.8564224;

/// Polygon area in acres (what the backend stores as landAreaAcres).
double polygonAreaAcres(List<GeoPoint> points) =>
    polygonAreaSqM(points) * _acresPerSqM;

/// Perimeter length in metres (useful for fence-cost estimates).
double polygonPerimeterM(List<GeoPoint> points) {
  if (points.length < 2) return 0;
  var total = 0.0;
  for (var i = 0; i < points.length; i++) {
    final a = points[i];
    final b = points[(i + 1) % points.length];
    final dx = (b.lng - a.lng) * _mPerDegLat * math.cos(_toRad(a.lat));
    final dy = (b.lat - a.lat) * _mPerDegLat;
    total += math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

double _toRad(double deg) => deg * math.pi / 180;
