import 'api_client.dart';
import 'endpoints.dart';

/// Teacher Profile & Creator Studio API client.
class TeachersApi {
  TeachersApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  static List<Map<String, dynamic>> _data(Map<String, dynamic> res) =>
      (res['data'] as List?)?.cast<Map<String, dynamic>>() ?? const [];

  Future<Map<String, dynamic>> getMyProfile() async {
    final res = await _client.get(pathTeachersMe);
    return res;
  }

  Future<Map<String, dynamic>> updateMyProfile(Map<String, dynamic> profile) async {
    final res = await _client.put(pathTeachersMe, body: profile);
    return res;
  }

  Future<Map<String, dynamic>> getTeacherPublicProfile(String teacherId) async {
    final res = await _client.get(teacherPath(teacherId));
    return res;
  }

  Future<List<Map<String, dynamic>>> getStudents({String? courseId}) async {
    final query = <String, dynamic>{
      if (courseId != null && courseId.isNotEmpty) 'courseId': courseId,
    };
    final res = await _client.get(pathTeachersStudents, query: query);
    return _data(res);
  }

  Future<Map<String, dynamic>> issueCertificate({
    required String studentId,
    required String courseId,
    String? grade,
  }) async {
    final res = await _client.post(
      pathTeachersCertificatesIssue,
      body: {
        'studentId': studentId,
        'courseId': courseId,
        if (grade != null) 'grade': grade,
      },
    );
    return res;
  }

  Future<Map<String, dynamic>> broadcastAnnouncement({
    required String courseId,
    required String title,
    required String message,
  }) async {
    final res = await _client.post(
      pathTeachersAnnouncements,
      body: {
        'courseId': courseId,
        'title': title,
        'message': message,
      },
    );
    return res;
  }

  Future<Map<String, dynamic>> getAnalytics() async {
    final res = await _client.get(pathTeachersAnalytics);
    return res;
  }
}
