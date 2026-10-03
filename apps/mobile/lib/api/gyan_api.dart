import '../models/gyan_models.dart';
import 'api_client.dart';
import 'endpoints.dart';

class GyanApi {
  GyanApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<List<PaidWorkshop>> listWorkshops() async {
    final res = await _client.get(pathWorkshops);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => PaidWorkshop.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, dynamic>> enrollWorkshop(
    String workshopId, {
    bool useCoins = false,
    int coinsToRedeem = 0,
  }) =>
      _client.post(workshopEnrollPath(workshopId), body: {
        'useCoins': useCoins,
        'coinsToRedeem': coinsToRedeem,
      });

  Future<List<ExpertTalk>> listTalks() async {
    final res = await _client.get(pathExpertTalks);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => ExpertTalk.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, dynamic>> registerTalk(String talkId) =>
      _client.post(expertTalkRegisterPath(talkId), body: const {});

  Future<Map<String, dynamic>> askQuestion(String talkId, String question) =>
      _client.post(expertTalkQuestionsPath(talkId), body: {
        'question': question,
      });

  Future<List<VideoGuide>> listVideos({String? category}) async {
    final res = await _client.get(pathVideos, query: {
      'category': ?category,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => VideoGuide.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<BlogArticle>> listBlogs({String? category}) async {
    final res = await _client.get(pathBlogs, query: {
      'category': ?category,
    });
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => BlogArticle.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<bool> toggleBookmark(String blogId) async {
    final res = await _client.post(blogBookmarkPath(blogId), body: const {});
    return res['isBookmarked'] == true;
  }

  Future<int> likeBlog(String blogId) async {
    final res = await _client.post(blogLikePath(blogId), body: const {});
    return (res['likesCount'] as num?)?.toInt() ?? 0;
  }
}
