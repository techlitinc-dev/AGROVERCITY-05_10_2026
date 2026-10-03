import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/auth_api.dart';
import 'package:kisan_setu/api/user_api.dart';
import 'package:kisan_setu/models/user_profile_type.dart';
import 'package:kisan_setu/state/app_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Auth fake that echoes the selected profiles back like the real backend.
class _EchoAuthApi extends AuthApi {
  _EchoAuthApi(this.storedUser);

  Map<String, dynamic>? lastRegisterBody;
  final Map<String, dynamic> storedUser;

  @override
  Future<Map<String, dynamic>> register({
    required String idToken,
    required String name,
    required String phone,
    required String state,
    required String district,
    required String tehsil,
    required String village,
    required double landAreaAcres,
    required String soilType,
    required String irrigationType,
    required List<String> crops,
    required String mpin,
    required List<String> profiles,
    required String primaryProfile,
    String? referralCode,
    Map<String, Map<String, dynamic>>? roleProfiles,
    String? language,
    String? preferredLanguage,
  }) async {
    lastRegisterBody = {'profiles': profiles, 'primaryProfile': primaryProfile};
    final user = Map<String, dynamic>.from(storedUser)
      ..['linkedProfiles'] = profiles
      ..['activeProfile'] = primaryProfile
      ..['primaryProfile'] = primaryProfile;
    return {
      'accessToken': 'a',
      'refreshToken': 'r',
      'isNewUser': false,
      'user': user,
    };
  }

  @override
  Future<Map<String, dynamic>> firebaseVerify(String idToken) async => {
        'accessToken': 'a',
        'refreshToken': 'r',
        'isNewUser': false,
        'user': storedUser,
      };

  @override
  Future<Map<String, dynamic>> mpinVerify(String mpin) async => {'ok': true};
}

class _StaticUserApi extends UserApi {
  _StaticUserApi(this.user);

  final Map<String, dynamic> user;

  @override
  Future<Map<String, dynamic>> getMe() async => user;

  @override
  Future<Map<String, dynamic>> activateProfile(String profileType) async => {
        'activeProfile': profileType,
        'defaultHomeRoute': '${profileType}Home',
        'user': {...user, 'activeProfile': profileType},
      };

  @override
  Future<Map<String, dynamic>> saveFarmBoundary(
    List<Map<String, double>> points,
    double acres,
    String? khasraNumber,
  ) async =>
      user;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('registration roundtrip keeps selected profiles', () async {
    final api = _EchoAuthApi({'name': 'Ram Singh', 'preferredLanguage': 'en'});
    final state = AppState(authApi: api);

    state.selectMultipleProfilesDuringRegistration(
      primary: UserProfileType.transport,
      selectedProfiles: [UserProfileType.transport, UserProfileType.farmer],
    );
    expect(state.activeProfile, UserProfileType.transport);
    expect(state.linkedProfiles,
        containsAll([UserProfileType.transport, UserProfileType.farmer]));

    await state.completeRegistration(
      idToken: 'tok',
      name: 'Ram Singh',
      phone: '+919876543210',
      village: 'Rampur',
      tehsil: 'Nashik',
      district: 'Nashik',
      state: 'Maharashtra',
      landAreaAcres: 5.5,
      soilType: 'Black',
      irrigationType: 'Drip',
      crops: const ['Wheat'],
      mpin: '1234',
    );

    expect(state.activeProfile, UserProfileType.transport,
        reason: 'active profile lost in register roundtrip');
    expect(state.linkedProfiles.length, 2,
        reason: 'linked profiles lost in register roundtrip');
  });

  test('mpin login hydrates linked and active profiles from backend', () async {
    final storedUser = {
      'name': 'Ram Singh',
      'preferredLanguage': 'en',
      'linkedProfiles': ['transport', 'farmer'],
      'activeProfile': 'transport',
      'primaryProfile': 'transport',
    };
    // Fresh app instance (new device / cleared storage) starts with defaults.
    final state = AppState(
      authApi: _EchoAuthApi(storedUser),
      userApi: _StaticUserApi(storedUser),
    );
    expect(state.linkedProfiles, [UserProfileType.farmer]);

    final ok = await state.loginWithMobileAndMpin('9876543210', '1234');

    expect(ok, isTrue);
    // Linked profiles hydrate from the backend; the active profile itself
    // starts on the platform default (farmer) whenever it is linked — same
    // deliberate landing rule as the post-registration flow below.
    expect(state.activeProfile, UserProfileType.farmer,
        reason: 'farmer is the platform default landing');
    expect(
      state.linkedProfiles,
      containsAll([UserProfileType.transport, UserProfileType.farmer]),
      reason: 'linked profiles not hydrated after MPIN login',
    );
    // The stored backend profile is one activation away.
    await state.activateProfileApi(UserProfileType.transport);
    expect(state.activeProfile, UserProfileType.transport);
  });

  test('applyAuthUser ignores an activeProfile that is not linked', () {
    final state = AppState();

    state.applyAuthUser({
      'linkedProfiles': ['farmer'],
      'activeProfile': 'transport',
      'preferredLanguage': 'en',
    });

    expect(state.linkedProfiles, [UserProfileType.farmer]);
    expect(state.activeProfile, UserProfileType.farmer);
  });

  test('applyAuthUser keeps local selection when backend omits profiles', () {
    final state = AppState();
    state.selectMultipleProfilesDuringRegistration(
      primary: UserProfileType.seller,
      selectedProfiles: [UserProfileType.seller, UserProfileType.farmer],
    );

    state.applyAuthUser({'name': 'Partial Doc', 'preferredLanguage': 'en'});

    expect(state.activeProfile, UserProfileType.seller);
    expect(state.linkedProfiles,
        containsAll([UserProfileType.seller, UserProfileType.farmer]));
  });

  test('full flow: register farmer+instructor, reach dashboard, switch both ways',
      () async {
    final state = AppState(
      authApi: _EchoAuthApi({'name': 'Guru', 'preferredLanguage': 'en'}),
      userApi: _StaticUserApi({
        'name': 'Guru',
        'preferredLanguage': 'en',
        'linkedProfiles': ['farmer', 'instructor'],
        'activeProfile': 'instructor',
        'primaryProfile': 'instructor',
      }),
    );

    // 1. Onboarding profile selection
    state.selectMultipleProfilesDuringRegistration(
      primary: UserProfileType.instructor,
      selectedProfiles: const [
        UserProfileType.instructor,
        UserProfileType.farmer,
      ],
    );
    expect(state.onboardingStep, 'register');
    expect(state.activeProfile, UserProfileType.instructor);

    // 2. Registration completes → map step
    await state.completeRegistration(
      idToken: 'tok',
      name: 'Guru',
      phone: '+919876543210',
      village: 'Rampur',
      tehsil: 'Nashik',
      district: 'Nashik',
      state: 'Maharashtra',
      landAreaAcres: 5.5,
      soilType: 'Black',
      irrigationType: 'Drip',
      crops: const ['Wheat'],
      mpin: '1234',
    );
    expect(state.onboardingStep, 'map');

    // 3. Farm map confirm → farmer is the platform default, so the session
    // starts on the farmer dashboard even though instructor was primary.
    await state.confirmFarmMap(const [
      {'lat': 20.17, 'lng': 73.98},
      {'lat': 20.18, 'lng': 73.98},
      {'lat': 20.18, 'lng': 73.99},
    ], 4.2);
    expect(state.isOnboarded, isTrue);
    expect(state.activeProfile, UserProfileType.farmer);
    expect(state.currentRoute, 'home');
    expect(
      state.linkedProfiles,
      containsAll([UserProfileType.instructor, UserProfileType.farmer]),
    );

    // 4. Switch to the instructor dashboard and back
    await state.activateProfileApi(UserProfileType.instructor);
    expect(state.activeProfile, UserProfileType.instructor);
    expect(state.currentRoute, 'instructorHome');

    await state.activateProfileApi(UserProfileType.farmer);
    expect(state.activeProfile, UserProfileType.farmer);
    expect(state.currentRoute, 'home');
  });
}
