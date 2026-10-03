import '../models/emarket_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class CouponsApi {
  CouponsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<Coupon>> list({int? cartTotal}) async {
    final res = await _client.get(
      pathCoupons,
      query: {'cartTotal': ?cartTotal},
    );
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => Coupon.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<CouponValidation> validate({
    required String code,
    required int cartTotal,
  }) async {
    final res = await _client.post(
      pathCouponsValidate,
      body: {'code': code, 'cartTotal': cartTotal},
    );
    return CouponValidation.fromJson(res, code: code);
  }
}
