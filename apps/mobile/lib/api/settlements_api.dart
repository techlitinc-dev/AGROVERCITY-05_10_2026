import '../models/settlement.dart';
import '../models/user_profile_type.dart';
import 'api_client.dart';
import 'endpoints.dart';

class SettlementsApi {
  SettlementsApi({ApiClient? client, this.activeProfile})
      : _client = client ?? ApiClient();

  final ApiClient _client;
  final UserProfileType Function()? activeProfile;

  // Settlements exist only for the three earning personas.
  Future<List<Settlement>> listMySettlements() async {
    final profile = activeProfile?.call() ?? UserProfileType.farmer;
    final path = switch (profile) {
      UserProfileType.transport => pathTransportSettlements,
      UserProfileType.equipmentRental => pathEquipmentSettlements,
      UserProfileType.broker => pathBrokerSettlements,
      _ => throw StateError('No settlements endpoint for persona $profile'),
    };
    final res = await _client.get(path);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => Settlement.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }
}
