import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/diary_api.dart';
import 'package:kisan_setu/models/app_models.dart' show FarmDiaryType;
import 'package:kisan_setu/models/diary_analytics.dart';
import 'package:kisan_setu/models/farm_diary_entry.dart';
import 'package:kisan_setu/views/farm_diary_view.dart';

import 'helpers.dart';

class FakeDiaryApi extends DiaryApi {
  List<FarmDiaryEntry> entries = [];
  int coinsToAward = 15;

  final List<FarmDiaryEntry> addCalls = [];
  final List<String> deleteCalls = [];

  @override
  Future<List<FarmDiaryEntry>> listEntries({
    String? type,
    String? category,
    String? from,
    String? to,
  }) async =>
      entries;

  @override
  Future<DiaryPage> listEntriesPage({
    String? type,
    String? category,
    String? from,
    String? to,
    int page = 1,
    int pageSize = 50,
  }) async {
    final start = (page - 1) * pageSize;
    final end =
        start + pageSize > entries.length ? entries.length : start + pageSize;
    final slice =
        start >= entries.length ? <FarmDiaryEntry>[] : entries.sublist(start, end);
    return DiaryPage(entries: slice, page: page, pageSize: pageSize, total: entries.length);
  }

  @override
  Future<DiaryAnalytics> getAnalytics({String? from, String? to}) async {
    var income = 0.0, expense = 0.0;
    var incomeCount = 0, expenseCount = 0, activityCount = 0;
    final byCategory = <String, double>{};
    for (final e in entries) {
      switch (e.type) {
        case FarmDiaryType.income:
          income += e.amount;
          incomeCount++;
        case FarmDiaryType.expense:
          expense += e.amount;
          expenseCount++;
        case FarmDiaryType.farmActivity:
          activityCount++;
      }
      if (e.type != FarmDiaryType.farmActivity) {
        byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
      }
    }
    return DiaryAnalytics(
      totals: DiaryTotals(
        income: income,
        expense: expense,
        net: income - expense,
        entryCount: entries.length,
        incomeCount: incomeCount,
        expenseCount: expenseCount,
        activityCount: activityCount,
      ),
      byCategory: [
        for (final c in byCategory.entries)
          CategorySummary(
              category: c.key, type: 'expense', amount: c.value, count: 1),
      ],
    );
  }

  @override
  Future<(FarmDiaryEntry, int)> addEntry(FarmDiaryEntry entry) async {
    addCalls.add(entry);
    final saved = FarmDiaryEntry(
      id: 'd-new',
      title: entry.title,
      category: entry.category,
      type: entry.type,
      amount: entry.amount,
      date: entry.date,
      cropName: entry.cropName,
      notes: entry.notes,
      photos: entry.photos,
      quantity: entry.quantity,
      unit: entry.unit,
    );
    entries = [saved, ...entries];
    return (saved, coinsToAward);
  }

  @override
  Future<void> deleteEntry(String id) async {
    deleteCalls.add(id);
    entries = entries.where((e) => e.id != id).toList();
  }

  @override
  Future<String> getReportUrl({String? from, String? to}) async =>
      'https://example.com/diary.pdf';
}

const _income = {
  'id': 'd-1',
  'title': 'मंडी विक्री',
  'category': 'Mandi Sale',
  'type': 'income',
  'amount': 5000,
  'date': '2026-09-15',
  'cropName': 'Tomato',
  'notes': '2 क्विंटल टमाटर विक्री',
};

const _expense = {
  'id': 'd-2',
  'title': 'Urea 1 bag',
  'category': 'Fertilizer',
  'type': 'expense',
  'amount': 450,
  'date': '2026-09-13',
  'cropName': 'Wheat',
  'notes': 'खत खरेदी',
};

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('farm diary renders summary cards and entry list', (tester) async {
    final api = FakeDiaryApi();
    api.entries = [
      FarmDiaryEntry.fromJson(_income),
      FarmDiaryEntry.fromJson(_expense),
    ];

    await pumpScreen(tester, Scaffold(body: FarmDiaryView(state: TestAppState(), diaryApi: api)));

    // Summary cards driven by analytics totals (5000 income / 450 expense).
    expect(find.text('₹5,000'), findsOneWidget);
    expect(find.text('₹4,550'), findsOneWidget);
    expect(find.text('Urea 1 bag'), findsOneWidget);
  });

  testWidgets('add entry awards coins snackbar', (tester) async {
    final api = FakeDiaryApi();
    api.entries = [FarmDiaryEntry.fromJson(_expense)];

    await pumpScreen(tester, Scaffold(body: FarmDiaryView(state: TestAppState(), diaryApi: api)));

    await tester.tap(find.text('नई पंजी जोड़ें (+15 सिक्के)'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.text('पंजी सहेजें (+15 सिक्के)'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.addCalls.length, 1);
    expect(find.text('+15 AgriCoins मिले!'), findsOneWidget);
  });
}
