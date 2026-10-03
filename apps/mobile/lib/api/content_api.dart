import '../models/agri_live_channel.dart';
import '../models/agri_news_item.dart';
import 'api_client.dart';
import 'endpoints.dart';

class ContentApi {
  ContentApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<NewsPage> listNews({String? category, int page = 1}) async {
    final res = await _client.get(pathNews, query: {
      'category': ?category,
      'page': page,
    });
    return NewsPage.fromJson(res);
  }

  Future<List<AgriLiveChannel>> listChannels() async {
    final res = await _client.get(pathChannels);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => AgriLiveChannel.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<ChatMessage>> getChat(String channelId) async {
    final res = await _client.get(channelChatPath(channelId));
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => ChatMessage.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  // Empty text with joined/left is a viewer-count ping, not a chat message.
  Future<Map<String, dynamic>> postChat(
    String channelId,
    String text, {
    bool joined = false,
    bool left = false,
  }) =>
      _client.post(
        channelChatPath(channelId),
        body: {'text': text},
        query: {
          if (joined) 'joined': 'true',
          if (left) 'left': 'true',
        },
      );

  Future<List<ScheduledBroadcast>> listBroadcastSchedules() async {
    final res = await _client.get(pathChannelsSchedule);
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) =>
            ScheduledBroadcast.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<Map<String, dynamic>> toggleBroadcastReminder(String bcastId) =>
      _client.post(channelScheduleRemindPath(bcastId));

  Future<Map<String, dynamic>> toggleScheduleReminder(String bcastId) =>
      toggleBroadcastReminder(bcastId);

  Future<List<LivePoll>> listPolls(String channelId) async {
    final res = await _client.get(channelPollsPath(channelId));
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => LivePoll.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<LivePoll> createPoll(
    String channelId, {
    required String question,
    required List<String> options,
  }) async {
    final res = await _client.post(channelPollsPath(channelId), body: {
      'question': question,
      'options': options,
    });
    return LivePoll.fromJson(res);
  }

  Future<LivePoll> votePoll(
    String channelId,
    String pollId,
    int optionIndex,
  ) async {
    final res =
        await _client.post(channelPollVotePath(channelId, pollId), body: {
      'optionIndex': optionIndex,
    });
    return LivePoll.fromJson(res);
  }

  Future<List<LiveQuestion>> listQuestions(String channelId) async {
    final res = await _client.get(channelQuestionsPath(channelId));
    return ((res['data'] as List?) ?? const <dynamic>[])
        .map((e) => LiveQuestion.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<LiveQuestion> askQuestion(String channelId, String questionText) async {
    final res = await _client.post(channelQuestionsPath(channelId), body: {
      'questionText': questionText,
    });
    return LiveQuestion.fromJson(res);
  }

  Future<Map<String, dynamic>> upvoteQuestion(
    String channelId,
    String questionId,
  ) =>
      _client.post(channelQuestionUpvotePath(channelId, questionId));

  Future<Map<String, dynamic>> answerQuestion(
    String channelId,
    String questionId,
  ) =>
      _client.put(channelQuestionAnswerPath(channelId, questionId));

  Future<Map<String, dynamic>> pinAnnouncement(
    String channelId,
    String text,
  ) =>
      _client.put(channelPinPath(channelId), body: {'pinnedText': text});

  Future<ChannelGift> sendGift(
    String channelId, {
    required String giftType,
    required int coins,
    String note = '',
  }) async {
    final res = await _client.post(channelGiftPath(channelId), body: {
      'giftType': giftType,
      'coins': coins,
      'note': note,
    });
    return ChannelGift.fromJson(res);
  }
}

