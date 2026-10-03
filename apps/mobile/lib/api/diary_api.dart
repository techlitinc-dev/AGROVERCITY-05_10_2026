import 'package:dio/dio.dart';

import '../models/diary_analytics.dart';
import '../models/farm_diary_entry.dart';
import 'api_client.dart';
import 'endpoints.dart';

class DiaryApi {
  DiaryApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  static const String pathDiaryAnalytics = '/diary/analytics/summary';
  static const String pathDiaryEntryPhotos = '/photos'; // suffix on diaryEntryPath

  /// Backward-compatible flat list (page 1, up to 200 entries).
  Future<List<FarmDiaryEntry>> listEntries({
    String? type,
    String? category,
    String? from,
    String? to,
  }) async {
    final page = await listEntriesPage(
      type: type,
      category: category,
      from: from,
      to: to,
      page: 1,
      pageSize: 200,
    );
    return page.entries;
  }

  // REAL pagination: GET /diary/entries?page=&pageSize=&type=&category=&from=&to=
  Future<DiaryPage> listEntriesPage({
    String? type,
    String? category,
    String? from,
    String? to,
    int page = 1,
    int pageSize = 50,
  }) async {
    final res = await _client.get(pathDiaryEntries, query: {
      'type': ?type,
      'category': ?category,
      'from': ?from,
      'to': ?to,
      'page': page,
      'pageSize': pageSize,
    });
    return DiaryPage(
      entries: ((res['data'] as List?) ?? const <dynamic>[])
          .map((e) => FarmDiaryEntry.fromJson((e as Map).cast<String, dynamic>()))
          .toList(),
      page: (res['page'] as num?)?.toInt() ?? page,
      pageSize: (res['pageSize'] as num?)?.toInt() ?? pageSize,
      total: (res['total'] as num?)?.toInt() ?? 0,
    );
  }

  // Returns the saved entry plus the AgriCoins awarded by the backend.
  Future<(FarmDiaryEntry, int)> addEntry(FarmDiaryEntry entry) async {
    final res = await _client.post(pathDiaryEntries, body: entry.toJson());
    final saved = FarmDiaryEntry.fromJson(
      ((res['entry'] as Map?) ?? const {}).cast<String, dynamic>(),
    );
    final coins = (res['agriCoinsEarned'] as num?)?.toInt() ?? 0;
    return (saved, coins);
  }

  // Edit an existing entry → 200 {entry}
  Future<FarmDiaryEntry> updateEntry(
    String id,
    Map<String, dynamic> payload,
  ) async {
    final res = await _client.put(diaryEntryPath(id), body: payload);
    return FarmDiaryEntry.fromJson(
      ((res['entry'] as Map?) ?? const {}).cast<String, dynamic>(),
    );
  }

  // Multipart photo upload (field name "files", 1–3 images) → 201 {photoUrls}
  Future<List<String>> uploadPhotos(
    String entryId,
    List<String> filePaths,
  ) async {
    final form = FormData();
    for (final path in filePaths) {
      form.files.add(MapEntry(
        'files',
        await MultipartFile.fromFile(
          path,
          filename: path.split('/').last,
        ),
      ));
    }
    final res = await _client.postMultipart(
      diaryEntryPath(entryId) + pathDiaryEntryPhotos,
      form,
    );
    return ((res['photoUrls'] as List?) ?? const <dynamic>[])
        .map((u) => '$u')
        .toList();
  }

  Future<void> deleteEntry(String id) => _client.delete(diaryEntryPath(id));

  Future<DiaryAnalytics> getAnalytics({String? from, String? to}) async {
    final res = await _client.get(pathDiaryAnalytics, query: {
      'from': ?from,
      'to': ?to,
    });
    return DiaryAnalytics.fromJson(res);
  }

  Future<String> getReportUrl({String? from, String? to}) async {
    final res = await _client.get(pathDiaryReport, query: {
      'from': ?from,
      'to': ?to,
    });
    return res['reportUrl'] as String? ?? '';
  }
}

class DiaryPage {
  final List<FarmDiaryEntry> entries;
  final int page;
  final int pageSize;
  final int total;

  const DiaryPage({
    required this.entries,
    required this.page,
    required this.pageSize,
    required this.total,
  });
}
