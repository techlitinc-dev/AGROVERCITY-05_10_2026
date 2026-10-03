import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/courses_api.dart';
import 'package:kisan_setu/models/user_profile_type.dart';
import 'package:kisan_setu/views/profile_home/instructor_home_view.dart';
import 'package:kisan_setu/views/courses/courses_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';
import 'register_referral_test.dart' show pumpWizard, completeToStep3;

class FakeCoursesApi extends CoursesApi {
  FakeCoursesApi({this.mine = const [], this.browse = const []});

  final List<Map<String, dynamic>> mine;
  final List<Map<String, dynamic>> browse;

  @override
  Future<List<Map<String, dynamic>>> myCourses() async => mine;

  @override
  Future<List<Map<String, dynamic>>> browseCourses({
    String? kind,
    String? category,
    String? language,
    String? search,
  }) async =>
      browse;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('instructor onboarding page validates expertise and serializes role profile',
      (tester) async {
    final authApi = FakeAuthApi();
    final state = TestAppState(
      linked: const [UserProfileType.farmer, UserProfileType.instructor],
      authApi: authApi,
    );
    state.selectMultipleProfilesDuringRegistration(
      primary: UserProfileType.instructor,
      selectedProfiles: const [
        UserProfileType.farmer,
        UserProfileType.instructor,
      ],
    );

    await pumpWizard(tester, state);
    await completeToStep3(tester); // fills village on the farmer page

    // Continue to the instructor page
    await tester.tap(find.text('भाषा चुनें और आगे बढ़ें →'));
    await tester.pumpAndSettle();

    expect(find.text('प्रशिक्षक विवरण'), findsOneWidget);

    // Finish without expertise is blocked
    await tester.tap(find.text('पंजीकरण पूरा करें'));
    await tester.pump();
    expect(find.text('कम से कम एक विषय-क्षेत्र चुनें'), findsOneWidget);
    expect(authApi.lastRegisterBody, isNull);

    // Select an expertise chip and finish
    await tester.tap(find.text('Agronomy'));
    await tester.pump();
    await tester.tap(find.text('पंजीकरण पूरा करें'));
    await tester.pump();
    await tester.pump();

    final roleProfiles =
        authApi.lastRegisterBody?['roleProfiles'] as Map<String, dynamic>?;
    expect(roleProfiles?['instructor']?['expertise'], ['Agronomy']);
    expect(authApi.lastRegisterBody?['profiles'],
        containsAll(['farmer', 'instructor']));

    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('instructor studio renders KPIs and course list', (tester) async {
    final api = FakeCoursesApi(mine: [
      {
        'id': 'c1',
        'title': 'Tomato IPM Course',
        'kind': 'videoPodcast',
        'status': 'published',
        'priceRupees': 199,
        'salesCount': 3,
        'instructorEarningsRupees': 537.3,
      },
      {
        'id': 'c2',
        'title': 'Soil Health Podcast',
        'kind': 'audioPodcast',
        'status': 'pendingReview',
        'priceRupees': 0,
        'salesCount': 0,
        'instructorEarningsRupees': 0,
      },
    ]);

    await pumpScreen(
      tester,
      InstructorHomeView(
        state: TestAppState(
          linked: const [UserProfileType.instructor],
          initialLanguage: 'en',
        ),
        api: api,
      ),
    );

    // KPIs: 2 courses, 3 sales, ₹537 earnings
    expect(find.text('Tomato IPM Course'), findsOneWidget);
    expect(find.text('Soil Health Podcast'), findsOneWidget);
    expect(find.text('Published'), findsOneWidget);
    expect(find.text('In Review'), findsOneWidget);
  });

  testWidgets('courses storefront renders browse results', (tester) async {
    final api = FakeCoursesApi(browse: [
      {
        'id': 'c1',
        'title': 'Advanced Onion Storage',
        'kind': 'courseMaterial',
        'instructorName': 'Dr. Kelkar',
        'priceRupees': 99,
        'isFeatured': false,
      },
    ]);

    await pumpScreen(
      tester,
      CoursesView(
        state: TestAppState(
          linked: const [UserProfileType.farmer],
          initialLanguage: 'en',
        ),
        api: api,
      ),
    );

    expect(find.text('Advanced Onion Storage'), findsOneWidget);
    expect(find.textContaining('Dr. Kelkar'), findsOneWidget);
  });
}
