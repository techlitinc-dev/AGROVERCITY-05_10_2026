import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/courses_api.dart';
import 'package:kisan_setu/models/user_profile_type.dart';
import 'package:kisan_setu/views/courses/course_certificate_view.dart';
import 'package:kisan_setu/views/courses/course_classroom_view.dart';
import 'package:kisan_setu/views/courses/course_detail_view.dart';
import 'package:kisan_setu/views/courses/courses_view.dart';
import 'package:kisan_setu/views/profile_home/instructor_home_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class MockCoursesApi extends CoursesApi {
  MockCoursesApi({
    this.browse = const [],
    this.mine = const [],
    this.courseDetails = const {},
    this.classroomData = const {},
    this.certificateData = const {},
  });

  final List<Map<String, dynamic>> browse;
  final List<Map<String, dynamic>> mine;
  final Map<String, dynamic> courseDetails;
  final Map<String, dynamic> classroomData;
  final Map<String, dynamic> certificateData;

  @override
  Future<List<Map<String, dynamic>>> browseCourses({
    String? kind,
    String? category,
    String? language,
    String? search,
  }) async =>
      browse;

  @override
  Future<List<Map<String, dynamic>>> myCourses() async => mine;

  @override
  Future<Map<String, dynamic>> getCourse(String courseId) async =>
      courseDetails;

  @override
  Future<Map<String, dynamic>> getClassroom(String courseId) async =>
      classroomData;

  @override
  Future<Map<String, dynamic>> getCertificate(String courseId) async =>
      certificateData;

  @override
  Future<Map<String, dynamic>> updateLessonProgress(
    String courseId,
    String lessonId, {
    required bool completed,
  }) async =>
      {
        'completed': completed,
        'progressPercent': completed ? 100 : 0,
        'certificateUnlocked': completed,
      };
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  final sampleCourse = {
    'id': 'course_101',
    'title': 'Organic Cotton & Drip Irrigation',
    'category': 'Organic Farming',
    'level': 'Intermediate',
    'instructorName': 'Dr. Kulkarni',
    'priceRupees': 499,
    'maxCoinsDiscount': 100,
    'totalDurationMinutes': 120,
    'rating': 4.9,
    'reviewsCount': 18,
    'isPurchased': true,
    'isEnrolled': true,
    'modules': [
      {
        'id': 'm1',
        'title': 'Module 1: Field Setup',
        'lessons': [
          {
            'id': 'l1',
            'title': 'Drip Calibration',
            'durationMinutes': 15,
            'isPreview': true,
          }
        ]
      }
    ],
  };

  testWidgets('CoursesView renders categories and course list with badges',
      (tester) async {
    final api = MockCoursesApi(browse: [sampleCourse]);
    final state = TestAppState(
      linked: const [UserProfileType.farmer],
      initialLanguage: 'en',
    );

    await pumpScreen(
      tester,
      CoursesView(state: state, api: api),
    );

    expect(find.text('Organic Cotton & Drip Irrigation'), findsOneWidget);
    expect(find.text('Organic Farming'), findsWidgets);
    expect(find.text('Save ₹100'), findsOneWidget);
  });

  testWidgets('CourseDetailView renders curriculum, classroom launch and reviews',
      (tester) async {
    final api = MockCoursesApi(courseDetails: sampleCourse);
    final state = TestAppState(
      linked: const [UserProfileType.farmer],
      initialLanguage: 'en',
    );

    await pumpScreen(
      tester,
      CourseDetailView(
        state: state,
        courseId: 'course_101',
        api: api,
      ),
    );

    expect(find.text('Organic Cotton & Drip Irrigation'), findsOneWidget);
    expect(find.text('Syllabus & Curriculum'), findsOneWidget);
    expect(find.text('Enter Interactive Classroom 🎓'), findsOneWidget);
    expect(find.text('Write Review / Feedback'), findsOneWidget);
  });

  testWidgets('CourseClassroomView renders modules, progress bar and updates lesson',
      (tester) async {
    final api = MockCoursesApi(
      classroomData: {
        'course': sampleCourse,
        'enrollment': {
          'progressPercent': 50,
          'completedLessons': ['l1'],
          'completed': false,
        },
      },
    );
    final state = TestAppState(
      linked: const [UserProfileType.farmer],
      initialLanguage: 'en',
    );

    await pumpScreen(
      tester,
      CourseClassroomView(
        state: state,
        courseId: 'course_101',
        api: api,
      ),
    );

    expect(find.text('Your Course Progress: 50%'), findsOneWidget);
    expect(find.text('Section 1: Module 1: Field Setup'), findsOneWidget);
    expect(find.text('Completed ✓'), findsOneWidget);
  });

  testWidgets('CourseCertificateView renders official golden seal and student credentials',
      (tester) async {
    final state = TestAppState(initialLanguage: 'en');
    await pumpScreen(
      tester,
      CourseCertificateView(
        state: state,
        certificate: {
          'studentName': 'Ramesh Kumar Patel',
          'courseTitle': 'Precision Organic Cotton Farming',
          'instructorName': 'Dr. Anand Kulkarni',
          'certificateId': 'CERT-AGV-9921',
          'issuedAt': '2026-09-25T10:00:00Z',
        },
      ),
    );

    expect(find.text('CERTIFICATE OF COMPLETION'), findsOneWidget);
    expect(find.text('Ramesh Kumar Patel'), findsOneWidget);
    expect(find.text('Precision Organic Cotton Farming'), findsOneWidget);
    expect(find.text('ID: CERT-AGV-9921'), findsOneWidget);
    expect(find.text('Download Certificate'), findsOneWidget);
  });

  testWidgets('InstructorHomeView renders quick studio actions for curriculum, students, and ads',
      (tester) async {
    final api = MockCoursesApi(mine: [sampleCourse]);
    final state = TestAppState(
      linked: const [UserProfileType.instructor],
      initialLanguage: 'en',
    );

    await pumpScreen(
      tester,
      InstructorHomeView(state: state, api: api),
    );

    expect(find.text('New Course'), findsOneWidget);
    expect(find.text('Students'), findsOneWidget);
    expect(find.text('Ad Manager'), findsOneWidget);
    expect(find.text('Curriculum Builder'), findsOneWidget);
    expect(find.text('Roster & Certs'), findsOneWidget);
    expect(find.text('Promote Course'), findsOneWidget);
  });
}
