import 'api_client.dart';
import 'endpoints.dart';

/// Instructor courses & podcasts API (module 27).
class CoursesApi {
  CoursesApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  static List<Map<String, dynamic>> _data(Map<String, dynamic> res) =>
      (res['data'] as List?)?.cast<Map<String, dynamic>>() ?? const [];

  Future<Map<String, dynamic>> createCourse({
    required String title,
    required String kind, // courseMaterial | audioPodcast | videoPodcast
    String description = '',
    String language = 'hi',
    String category = 'General',
    String level = 'All Levels',
    double priceRupees = 0,
    int maxCoinsDiscount = 0,
    String? thumbnailUrl,
    String? mediaUrl,
    String? previewUrl,
    List<Map<String, dynamic>>? modules,
    List<String>? whatYouWillLearn,
    List<String>? requirements,
    List<String>? tags,
  }) async {
    final res = await _client.post(
      pathCourses,
      body: {
        'title': title,
        'description': description,
        'kind': kind,
        'language': language,
        'category': category,
        'level': level,
        'priceRupees': priceRupees,
        'maxCoinsDiscount': maxCoinsDiscount,
        if (thumbnailUrl != null) 'thumbnailUrl': thumbnailUrl,
        if (mediaUrl != null) 'mediaUrl': mediaUrl,
        if (previewUrl != null) 'previewUrl': previewUrl,
        if (modules != null) 'modules': modules,
        if (whatYouWillLearn != null) 'whatYouWillLearn': whatYouWillLearn,
        if (requirements != null) 'requirements': requirements,
        if (tags != null) 'tags': tags,
      },
    );
    return res;
  }

  Future<Map<String, dynamic>> updateCourse(
    String courseId,
    Map<String, dynamic> data,
  ) async {
    final res = await _client.put(coursePath(courseId), body: data);
    return res;
  }

  Future<List<Map<String, dynamic>>> myCourses() async {
    final res = await _client.get(pathCoursesMine);
    return _data(res);
  }

  Future<void> deleteCourse(String courseId) =>
      _client.delete(coursePath(courseId));

  Future<List<Map<String, dynamic>>> browseCourses({
    String? kind,
    String? category,
    String? language,
    String? search,
  }) async {
    final query = <String, dynamic>{
      if (kind != null) 'kind': kind,
      if (category != null) 'category': category,
      if (language != null) 'language': language,
      if (search != null && search.isNotEmpty) 'search': search,
    };
    final res = await _client.get(pathCourses, query: query);
    return _data(res);
  }

  Future<Map<String, dynamic>> getCourse(String courseId) async {
    final res = await _client.get(coursePath(courseId));
    return res;
  }

  /// Returns `{purchased: true}` for free/already-owned, or
  /// `{purchased: false, paymentOrderId, amountDue}` when payment is needed.
  Future<Map<String, dynamic>> purchase(String courseId) async {
    final res = await _client.post(coursePurchasePath(courseId));
    return res;
  }

  Future<Map<String, dynamic>> enrollCourse(
    String courseId, {
    bool useAgriCoins = false,
    int coinsRedeemed = 0,
  }) async {
    final res = await _client.post(
      courseEnrollPath(courseId),
      body: {
        'useAgriCoins': useAgriCoins,
        'coinsRedeemed': coinsRedeemed,
      },
    );
    return res;
  }

  Future<Map<String, dynamic>> getClassroom(String courseId) async {
    final res = await _client.get(courseLearnPath(courseId));
    return res;
  }

  Future<Map<String, dynamic>> updateLessonProgress(
    String courseId,
    String lessonId, {
    required bool completed,
  }) async {
    final res = await _client.post(
      courseLessonProgressPath(courseId, lessonId),
      body: {'completed': completed},
    );
    return res;
  }

  Future<Map<String, dynamic>> getCertificate(String courseId) async {
    final res = await _client.get(courseCertificatePath(courseId));
    return res;
  }

  Future<Map<String, dynamic>> verifyPurchase({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    String razorpaySignature = 'dev',
  }) async {
    final res = await _client.post(
      pathCoursesPurchasesVerify,
      body: {
        'razorpayOrderId': razorpayOrderId,
        'razorpayPaymentId': razorpayPaymentId,
        'razorpaySignature': razorpaySignature,
      },
    );
    return res;
  }

  Future<List<Map<String, dynamic>>> myLibrary() async {
    final res = await _client.get(pathCoursesPurchasedList);
    return _data(res);
  }

  Future<List<Map<String, dynamic>>> myLearning() async {
    final res = await _client.get(pathCoursesMyLearning);
    return _data(res);
  }

  Future<List<Map<String, dynamic>>> getReviews(String courseId) async {
    final res = await _client.get(courseReviewsPath(courseId));
    return _data(res);
  }

  Future<Map<String, dynamic>> addReview(
    String courseId, {
    required int rating,
    required String comment,
  }) async {
    final res = await _client.post(
      courseReviewsPath(courseId),
      body: {'rating': rating, 'comment': comment},
    );
    return res;
  }

  Future<List<Map<String, dynamic>>> getQuestions(String courseId) async {
    final res = await _client.get(courseQuestionsPath(courseId));
    return _data(res);
  }

  Future<Map<String, dynamic>> askQuestion(
    String courseId,
    String question,
  ) async {
    final res = await _client.post(
      courseQuestionsPath(courseId),
      body: {'question': question},
    );
    return res;
  }

  Future<Map<String, dynamic>> answerQuestion(
    String courseId,
    String questionId,
    String answer,
  ) async {
    final res = await _client.post(
      courseQuestionAnswersPath(courseId, questionId),
      body: {'answer': answer},
    );
    return res;
  }
}
