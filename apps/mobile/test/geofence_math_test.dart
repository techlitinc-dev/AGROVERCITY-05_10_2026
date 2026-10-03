import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/core/geofence_math.dart';

void main() {
  // A 100 m × 100 m square field at Nashik (~20.17°N).
  const centerLat = 20.1742;
  const centerLng = 73.9851;
  const half = 50.0; // metres
  const mPerDegLat = 111320.0;

  double cosRad(double r) {
    var x = r;
    var term = 1.0;
    var sum = 1.0;
    var sign = -1.0;
    for (var i = 1; i <= 8; i++) {
      term *= x * x / ((2 * i - 1) * (2 * i));
      sum += sign * term;
      sign = -sign;
    }
    return sum;
  }

  double mPerDegLng(double lat) =>
      mPerDegLat * cosRad(lat * 3.141592653589793 / 180);

  List<GeoPoint> square() {
    final dLat = half / mPerDegLat;
    final dLng = half / mPerDegLng(centerLat);
    return [
      GeoPoint(centerLat + dLat, centerLng - dLng),
      GeoPoint(centerLat + dLat, centerLng + dLng),
      GeoPoint(centerLat - dLat, centerLng + dLng),
      GeoPoint(centerLat - dLat, centerLng - dLng),
    ];
  }

  test('square field area is ~10,000 m² (~2.47 acres)', () {
    final sq = square();
    final sqM = polygonAreaSqM(sq);
    expect(sqM, greaterThan(9900));
    expect(sqM, lessThan(10100));

    final acres = polygonAreaAcres(sq);
    expect(acres, greaterThan(2.44));
    expect(acres, lessThan(2.50));
  });

  test('perimeter of the square is ~400 m', () {
    final p = polygonPerimeterM(square());
    expect(p, greaterThan(395));
    expect(p, lessThan(405));
  });

  test('fewer than 3 pins gives zero area', () {
    expect(polygonAreaSqM(const [GeoPoint(20.1, 73.9)]), 0);
    expect(
      polygonAreaSqM(const [GeoPoint(20.1, 73.9), GeoPoint(20.2, 73.9)]),
      0,
    );
    expect(polygonAreaAcres(const []), 0);
  });

  test('GeoPoint json roundtrip', () {
    const p = GeoPoint(20.17, 73.98);
    final restored = GeoPoint.fromJson(p.toJson());
    expect(restored.lat, 20.17);
    expect(restored.lng, 73.98);
  });
}
