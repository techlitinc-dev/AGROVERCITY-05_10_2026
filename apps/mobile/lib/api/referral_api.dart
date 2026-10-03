import '../models/referral.dart';
import 'api_client.dart';

class ReferralApi {
  static const String pathReferrals = '/referrals';
  static const String pathReferralsInvite = '/referrals/invite';

  ReferralApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<ReferralSummary> get() async {
    final res = await _client.get(pathReferrals);
    return ReferralSummary.fromJson(res);
  }

  // Returns the created invite plus fresh stats/milestones; throws ApiException
  // (400 VALIDATION_ERROR with fieldErrors.phone / 409 ALREADY_INVITED).
  Future<InviteResult> invite({
    required String name,
    required String phone,
  }) async {
    final res = await _client.post(
      pathReferralsInvite,
      body: {'name': name, 'phone': phone},
    );
    return InviteResult.fromJson(res);
  }
}
