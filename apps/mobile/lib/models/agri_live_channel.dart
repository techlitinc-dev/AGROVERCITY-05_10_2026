// Live channel + channel chat message — fields match GET /v1/channels and
// GET /v1/channels/{id}/chat exactly. The vernacular getters keep the ported
// prototype template unchanged (seeds carry vernacular text in the main
// name/program fields).

class AgriLiveChannel {
  final String id;
  final String channelName;
  final String broadcaster;
  final String programTitle;
  final String currentSpeaker;
  final int liveViewersCount;
  final bool isLiveNow;
  final String category;
  final String streamThumbnail;
  final String streamUrl;
  final String scheduleTime;
  final String pinnedAnnouncement;
  final bool isBroadcasterHost;

  const AgriLiveChannel({
    required this.id,
    required this.channelName,
    required this.broadcaster,
    required this.programTitle,
    required this.currentSpeaker,
    required this.liveViewersCount,
    required this.isLiveNow,
    required this.category,
    required this.streamThumbnail,
    required this.streamUrl,
    required this.scheduleTime,
    this.pinnedAnnouncement = '',
    this.isBroadcasterHost = false,
  });

  String get vernacularName => channelName;
  String get vernacularProgram => programTitle;

  factory AgriLiveChannel.fromJson(Map<String, dynamic> json) =>
      AgriLiveChannel(
        id: json['id'] as String? ?? '',
        channelName: json['channelName'] as String? ?? '',
        broadcaster: json['broadcaster'] as String? ?? '',
        programTitle: json['programTitle'] as String? ?? '',
        currentSpeaker: json['currentSpeaker'] as String? ?? '',
        liveViewersCount: (json['liveViewersCount'] as num?)?.toInt() ?? 0,
        isLiveNow: json['isLiveNow'] == true,
        category: json['category'] as String? ?? '',
        streamThumbnail: json['streamThumbnail'] as String? ?? '',
        streamUrl: json['streamUrl'] as String? ?? '',
        scheduleTime: json['scheduleTime'] as String? ?? '',
        pinnedAnnouncement: json['pinnedAnnouncement'] as String? ?? '',
        isBroadcasterHost: json['isBroadcasterHost'] == true,
      );
}

class ChatMessage {
  final String id;
  final String userName;
  final String text;
  final String sentAt;

  const ChatMessage({
    required this.id,
    required this.userName,
    required this.text,
    required this.sentAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as String? ?? '',
        userName: json['userName'] as String? ?? '',
        text: json['text'] as String? ?? '',
        sentAt: json['sentAt'] as String? ?? '',
      );
}

class ScheduledBroadcast {
  final String id;
  final String channelName;
  final String programTitle;
  final String speakerName;
  final String speakerRole;
  final String scheduledStart;
  final String topic;
  final int reminderCount;
  final bool hasReminder;
  final String thumbnailUrl;

  const ScheduledBroadcast({
    required this.id,
    required this.channelName,
    required this.programTitle,
    required this.speakerName,
    required this.speakerRole,
    required this.scheduledStart,
    required this.topic,
    required this.reminderCount,
    required this.hasReminder,
    required this.thumbnailUrl,
  });

  factory ScheduledBroadcast.fromJson(Map<String, dynamic> json) =>
      ScheduledBroadcast(
        id: json['id'] as String? ?? '',
        channelName: json['channelName'] as String? ?? '',
        programTitle: json['programTitle'] as String? ?? '',
        speakerName: json['speakerName'] as String? ?? '',
        speakerRole: json['speakerRole'] as String? ?? '',
        scheduledStart: json['scheduledStart'] as String? ?? '',
        topic: json['topic'] as String? ?? '',
        reminderCount: (json['reminderCount'] as num?)?.toInt() ?? 0,
        hasReminder: json['hasReminder'] == true,
        thumbnailUrl: json['thumbnailUrl'] as String? ?? '',
      );
}

class LivePoll {
  final String id;
  final String channelId;
  final String question;
  final List<String> options;
  final Map<String, int> votes;
  final int totalVotes;
  final int? userVotedOption;
  final bool isActive;
  final String createdAt;

  const LivePoll({
    required this.id,
    required this.channelId,
    required this.question,
    required this.options,
    required this.votes,
    required this.totalVotes,
    this.userVotedOption,
    required this.isActive,
    required this.createdAt,
  });

  factory LivePoll.fromJson(Map<String, dynamic> json) {
    final votesMap = <String, int>{};
    if (json['votes'] is Map) {
      (json['votes'] as Map).forEach((k, v) {
        votesMap[k.toString()] = (v as num).toInt();
      });
    }
    return LivePoll(
      id: json['id'] as String? ?? '',
      channelId: json['channelId'] as String? ?? '',
      question: json['question'] as String? ?? '',
      options: ((json['options'] as List?) ?? const <dynamic>[])
          .map((e) => "$e")
          .toList(),
      votes: votesMap,
      totalVotes: (json['totalVotes'] as num?)?.toInt() ?? 0,
      userVotedOption: (json['userVotedOption'] as num?)?.toInt(),
      isActive: json['isActive'] != false,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

class LiveQuestion {
  final String id;
  final String channelId;
  final String userId;
  final String userName;
  final String questionText;
  final int upvotesCount;
  final bool isAnswered;
  final bool userHasUpvoted;
  final String createdAt;

  const LiveQuestion({
    required this.id,
    required this.channelId,
    required this.userId,
    required this.userName,
    required this.questionText,
    required this.upvotesCount,
    required this.isAnswered,
    required this.userHasUpvoted,
    required this.createdAt,
  });

  factory LiveQuestion.fromJson(Map<String, dynamic> json) => LiveQuestion(
        id: json['id'] as String? ?? '',
        channelId: json['channelId'] as String? ?? '',
        userId: json['userId'] as String? ?? '',
        userName: json['userName'] as String? ?? '',
        questionText: json['questionText'] as String? ?? '',
        upvotesCount: (json['upvotesCount'] as num?)?.toInt() ?? 0,
        isAnswered: json['isAnswered'] == true,
        userHasUpvoted: json['userHasUpvoted'] == true,
        createdAt: json['createdAt'] as String? ?? '',
      );
}

class ChannelGift {
  final String id;
  final String channelId;
  final String userId;
  final String userName;
  final String giftType;
  final String giftLabel;
  final int coins;
  final String note;
  final String sentAt;

  const ChannelGift({
    required this.id,
    required this.channelId,
    required this.userId,
    required this.userName,
    required this.giftType,
    required this.giftLabel,
    required this.coins,
    required this.note,
    required this.sentAt,
  });

  factory ChannelGift.fromJson(Map<String, dynamic> json) => ChannelGift(
        id: json['id'] as String? ?? '',
        channelId: json['channelId'] as String? ?? '',
        userId: json['userId'] as String? ?? '',
        userName: json['userName'] as String? ?? '',
        giftType: json['giftType'] as String? ?? 'green_sprout',
        giftLabel: json['giftLabel'] as String? ?? '',
        coins: (json['coins'] as num?)?.toInt() ?? 0,
        note: json['note'] as String? ?? '',
        sentAt: json['sentAt'] as String? ?? '',
      );
}

