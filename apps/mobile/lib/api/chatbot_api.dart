import 'api_client.dart';
import 'endpoints.dart';

class ChatbotApi {
  ChatbotApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<Map<String, dynamic>> sendMessage({
    required String text,
    String? sessionId,
    String? language,
    Map<String, dynamic>? context,
  }) =>
      _client.post(pathChatbotMessages, body: {
        'text': text,
        'sessionId': ?sessionId,
        'language': ?language,
        'context': ?context,
      });

  Future<List<Map<String, dynamic>>> getHistory({int limit = 50}) async {
    final res = await _client.get(pathChatbotHistory, query: {'limit': '$limit'});
    return ((res['messages'] as List?) ?? const <dynamic>[])
        .map((e) => (e as Map).cast<String, dynamic>())
        .toList();
  }

  Future<Map<String, dynamic>> requestExpertHandoff({
    required String query,
    String? category,
    String? urgency,
    Map<String, dynamic>? context,
  }) =>
      _client.post(pathChatbotExpertHandoff, body: {
        'query': query,
        'category': ?category,
        'urgency': ?urgency,
        'context': ?context,
      });

  Future<List<Map<String, dynamic>>> listExperts() async {
    final res = await _client.get(pathChatbotExperts);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => (e as Map).cast<String, dynamic>())
        .toList();
  }
}
