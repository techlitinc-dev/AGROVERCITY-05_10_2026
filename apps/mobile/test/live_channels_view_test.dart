import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/content_api.dart';
import 'package:kisan_setu/models/agri_live_channel.dart';
import 'package:kisan_setu/views/live_channels_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeChannelsApi extends ContentApi {
  List<AgriLiveChannel> channels = const [];
  List<ChatMessage> chat = const [];
  List<LivePoll> polls = const [];
  List<LiveQuestion> questions = const [];
  List<ScheduledBroadcast> schedules = const [];
  ChannelGift? lastGift;

  @override
  Future<List<AgriLiveChannel>> listChannels() async => channels;

  @override
  Future<List<ChatMessage>> getChat(String channelId) async => chat;

  @override
  Future<Map<String, dynamic>> postChat(
    String channelId,
    String text, {
    bool joined = false,
    bool left = false,
  }) async =>
      {'ok': true};

  @override
  Future<List<LivePoll>> listPolls(String channelId) async => polls;

  @override
  Future<LivePoll> votePoll(String channelId, String pollId, int optionIndex) async {
    final idx = polls.indexWhere((p) => p.id == pollId);
    if (idx >= 0) {
      final old = polls[idx];
      final newVotes = Map<String, int>.from(old.votes);
      newVotes[optionIndex.toString()] = (newVotes[optionIndex.toString()] ?? 0) + 1;
      final updated = LivePoll(
        id: old.id,
        channelId: old.channelId,
        question: old.question,
        options: old.options,
        votes: newVotes,
        totalVotes: old.totalVotes + 1,
        userVotedOption: optionIndex,
        isActive: old.isActive,
        createdAt: old.createdAt,
      );
      polls = List.from(polls)..[idx] = updated;
      return updated;
    }
    throw Exception("Not found");
  }

  @override
  Future<List<LiveQuestion>> listQuestions(String channelId) async => questions;

  @override
  Future<Map<String, dynamic>> upvoteQuestion(String channelId, String questionId) async {
    final idx = questions.indexWhere((q) => q.id == questionId);
    if (idx >= 0) {
      final old = questions[idx];
      final updated = LiveQuestion(
        id: old.id,
        channelId: old.channelId,
        userId: old.userId,
        userName: old.userName,
        questionText: old.questionText,
        upvotesCount: old.upvotesCount + 1,
        isAnswered: old.isAnswered,
        userHasUpvoted: true,
        createdAt: old.createdAt,
      );
      questions = List.from(questions)..[idx] = updated;
    }
    return {'ok': true};
  }

  @override
  Future<List<ScheduledBroadcast>> listBroadcastSchedules() async => schedules;

  @override
  Future<Map<String, dynamic>> toggleScheduleReminder(String bcastId) async {
    final idx = schedules.indexWhere((s) => s.id == bcastId);
    if (idx >= 0) {
      final old = schedules[idx];
      final updated = ScheduledBroadcast(
        id: old.id,
        channelName: old.channelName,
        programTitle: old.programTitle,
        speakerName: old.speakerName,
        speakerRole: old.speakerRole,
        scheduledStart: old.scheduledStart,
        topic: old.topic,
        reminderCount: old.hasReminder ? old.reminderCount - 1 : old.reminderCount + 1,
        hasReminder: !old.hasReminder,
        thumbnailUrl: old.thumbnailUrl,
      );
      schedules = List.from(schedules)..[idx] = updated;
    }
    return {'ok': true};
  }

  @override
  Future<ChannelGift> sendGift(
    String channelId, {
    required String giftType,
    required int coins,
    String note = '',
  }) async {
    final gift = ChannelGift(
      id: 'g-1',
      channelId: channelId,
      userId: 'u-1',
      userName: 'Test Farmer',
      giftType: giftType,
      giftLabel: giftType,
      coins: coins,
      note: note,
      sentAt: '2026-09-25T12:00:00Z',
    );
    lastGift = gift;
    return gift;
  }
}

AgriLiveChannel _channel(String id, {bool live = true, String pinned = ''}) =>
    AgriLiveChannel(
      id: id,
      channelName: 'वाहिनी $id',
      broadcaster: 'Doordarshan Agri',
      programTitle: 'कार्यक्रम $id',
      currentSpeaker: 'डॉ. कुलकर्णी',
      liveViewersCount: 1200,
      isLiveNow: live,
      category: 'Weather & Advisory',
      streamThumbnail: '',
      streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      scheduleTime: 'दररोज सायं. 7:00',
      pinnedAnnouncement: pinned,
    );

Future<void> pumpChannelsView(WidgetTester tester, FakeChannelsApi api) async {
  await pumpScreen(
    tester,
    Scaffold(
      body: LiveChannelsView(
        state: TestAppState(),
        contentApi: api,
        enableVideo: false,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
  await tester.pump(const Duration(seconds: 1));
}

Future<void> unmount(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 5));
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('channels list renders with LIVE badge', (tester) async {
    final api = FakeChannelsApi()
      ..channels = [_channel('ch-1'), _channel('ch-2', live: false)];
    await pumpChannelsView(tester, api);

    expect(find.text('LIVE'), findsWidgets);
    expect(find.text('वाहिनी ch-1'), findsWidgets);
    expect(find.text('वाहिनी ch-2'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('chat messages render', (tester) async {
    final api = FakeChannelsApi()
      ..channels = [_channel('ch-1')]
      ..chat = const [
        ChatMessage(
          id: 'm1',
          userName: 'Ramesh (Niphad)',
          text: 'टोमॅटोचा भाव काय?',
          sentAt: '2026-09-17T08:00:00Z',
        ),
        ChatMessage(
          id: 'm2',
          userName: 'Suresh Patil',
          text: 'आज आवक भरपूर आहे.',
          sentAt: '2026-09-17T08:01:00Z',
        ),
      ];
    await pumpChannelsView(tester, api);

    expect(find.textContaining('Ramesh (Niphad): टोमॅटोचा भाव काय?', findRichText: true), findsOneWidget);
    expect(find.textContaining('Suresh Patil: आज आवक भरपूर आहे.', findRichText: true), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('pinned announcement banner renders', (tester) async {
    final api = FakeChannelsApi()
      ..channels = [_channel('ch-1', pinned: 'विशेष कृषी कीड मार्गदर्शन सत्र सुरू!')];
    await pumpChannelsView(tester, api);

    expect(find.text('प्रसारक सूचना (Host Pin)'), findsOneWidget);
    expect(find.text('विशेष कृषी कीड मार्गदर्शन सत्र सुरू!'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('polls tab displays active poll and handles voting', (tester) async {
    final api = FakeChannelsApi()
      ..channels = [_channel('ch-1')]
      ..polls = const [
        LivePoll(
          id: 'p-1',
          channelId: 'ch-1',
          question: 'या हंगामात तुम्ही बांबू लागवड करणार का?',
          options: ['होय, नक्कीच', 'नाही, विचार चालू आहे'],
          votes: {'0': 12, '1': 4},
          totalVotes: 16,
          isActive: true,
          createdAt: '2026-09-25T10:00:00Z',
        ),
      ];
    await pumpChannelsView(tester, api);

    // Switch to Polls tab
    final pollTab = find.textContaining('📊 मतदान');
    await tester.ensureVisible(pollTab);
    await tester.pump();
    await tester.tap(pollTab);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('या हंगामात तुम्ही बांबू लागवड करणार का?'), findsOneWidget);
    expect(find.text('होय, नक्कीच'), findsOneWidget);

    // Vote on first option
    await tester.tap(find.text('होय, नक्कीच'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(api.polls.first.totalVotes, 17);

    await unmount(tester);
  });

  testWidgets('questions tab displays Q&A and upvotes', (tester) async {
    final api = FakeChannelsApi()
      ..channels = [_channel('ch-1')]
      ..questions = const [
        LiveQuestion(
          id: 'q-1',
          channelId: 'ch-1',
          userId: 'u-1',
          userName: 'बाळू पाटील',
          questionText: 'पाऊस लांबल्यास कांदा पुनर्लागवड कधी करावी?',
          upvotesCount: 8,
          isAnswered: false,
          userHasUpvoted: false,
          createdAt: '2026-09-25T11:00:00Z',
        ),
      ];
    await pumpChannelsView(tester, api);

    // Switch to Q&A tab
    final qaTab = find.textContaining('❓ प्रश्नोत्तरे');
    await tester.ensureVisible(qaTab);
    await tester.pump();
    await tester.tap(qaTab);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('पाऊस लांबल्यास कांदा पुनर्लागवड कधी करावी?'), findsOneWidget);
    expect(find.text('8 समर्थन'), findsOneWidget);

    // Upvote
    await tester.tap(find.text('8 समर्थन'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(api.questions.first.upvotesCount, 9);

    await unmount(tester);
  });

  testWidgets('schedules tab renders upcoming broadcast', (tester) async {
    final api = FakeChannelsApi()
      ..channels = [_channel('ch-1')]
      ..schedules = const [
        ScheduledBroadcast(
          id: 'sc-1',
          channelName: 'डीडी किसान',
          programTitle: 'जैविक खत कार्यशाळा',
          speakerName: 'डॉ. संजय काळे',
          speakerRole: 'वरिष्ठ मृदा शास्त्रज्ञ',
          scheduledStart: 'उद्या संध्याकाळी ६:०० वाजता',
          topic: 'सेंद्रिय कर्ब वाढवण्याचे सोपे उपाय',
          reminderCount: 35,
          hasReminder: false,
          thumbnailUrl: '',
        ),
      ];
    await pumpChannelsView(tester, api);

    // Switch to Schedule tab
    final scheduleTab = find.textContaining('📅 वेळापत्रक');
    await tester.ensureVisible(scheduleTab);
    await tester.pump();
    await tester.tap(scheduleTab);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('जैविक खत कार्यशाळा'), findsOneWidget);
    expect(find.text('मार्गदर्शक: डॉ. संजय काळे (वरिष्ठ मृदा शास्त्रज्ञ)'), findsOneWidget);

    // Toggle reminder
    await tester.tap(find.text('स्मरणपत्र द्या'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(api.schedules.first.hasReminder, true);

    await unmount(tester);
  });
}
