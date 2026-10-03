// Dashboard behaviour: summary cards show ₹ amounts from analytics and the
// entries timeline paginates with a "load more" affordance.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kisan_setu/api/diary_api.dart';
import 'package:kisan_setu/models/app_models.dart' show FarmDiaryType;
import 'package:kisan_setu/models/diary_analytics.dart';
import 'package:kisan_setu/models/farm_diary_entry.dart';
import 'package:kisan_setu/views/farm_diary_view.dart';

import 'helpers.dart';

class PagedDiaryApi extends DiaryApi {
  PagedDiaryApi(this.entries);

  final List<FarmDiaryEntry> entries;
  final pagesRequested = <int>[];

  @override
  Future<DiaryPage> listEntriesPage({
    String? type,
    String? category,
    String? from,
    String? to,
    int page = 1,
    int pageSize = 50,
  }) async {
    pagesRequested.add(page);
    final start = (page - 1) * pageSize;
    final end =
        start + pageSize > entries.length ? entries.length : start + pageSize;
    final slice =
        start >= entries.length ? <FarmDiaryEntry>[] : entries.sublist(start, end);
    return DiaryPage(
        entries: slice, page: page, pageSize: pageSize, total: entries.length);
  }

  @override
  Future<DiaryAnalytics> getAnalytics({String? from, String? to}) async =>
      const DiaryAnalytics(
        totals: DiaryTotals(
          income: 10000,
          expense: 2500,
          net: 7500,
          entryCount: 25,
          incomeCount: 10,
          expenseCount: 15,
          activityCount: 0,
        ),
      );
}

List<FarmDiaryEntry> _makeEntries(int count) => [
      for (var i = 1; i <= count; i++)
        FarmDiaryEntry(
          id: 'd-$i',
          title: 'Entry $i',
          category: 'Fertilizer',
          type: FarmDiaryType.expense,
          amount: 100,
          date: '2026-09-10',
          cropName: 'Tomato',
          notes: 'n$i',
        ),
    ];

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('summary cards show ₹ amounts from analytics totals',
      (tester) async {
    final api = PagedDiaryApi(_makeEntries(25));

    await pumpScreen(
        tester, Scaffold(body: FarmDiaryView(state: TestAppState(), diaryApi: api)));

    expect(find.text('₹10,000'), findsOneWidget); // total income
    expect(find.text('₹2,500'), findsOneWidget); // total expense
    expect(find.text('₹7,500'), findsOneWidget); // net
  });

  testWidgets('load-more appears when total > pageSize and appends next page',
      (tester) async {
    final api = PagedDiaryApi(_makeEntries(25));

    await pumpScreen(
        tester, Scaffold(body: FarmDiaryView(state: TestAppState(), diaryApi: api)));

    // Page 1 loaded: first entry visible, load-more present.
    expect(find.text('Entry 1'), findsOneWidget);
    expect(find.text('Entry 20'), findsOneWidget);
    expect(find.text('Entry 21'), findsNothing);
    final verticalScrollable = find.byWidgetPredicate(
        (w) => w is Scrollable && w.axis == Axis.vertical);
    await tester.scrollUntilVisible(
      find.text('और दिखाएँ'),
      300,
      scrollable: verticalScrollable,
    );
    await tester.pump();
    expect(find.text('और दिखाएँ'), findsOneWidget);
    expect(find.text('20/25'), findsOneWidget); // loaded/total counter

    await tester.ensureVisible(find.text('और दिखाएँ'));
    await tester.pump();
    await tester.tap(find.text('और दिखाएँ'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(api.pagesRequested, contains(2));
    expect(find.text('Entry 21'), findsOneWidget);
    expect(find.text('25/25'), findsOneWidget);
    // All entries loaded → load-more disappears.
    expect(find.text('और दिखाएँ'), findsNothing);
  });

  testWidgets('no load-more when total fits in the first page', (tester) async {
    final api = PagedDiaryApi(_makeEntries(5));

    await pumpScreen(
        tester, Scaffold(body: FarmDiaryView(state: TestAppState(), diaryApi: api)));

    expect(find.text('Entry 5'), findsOneWidget);
    expect(find.text('और दिखाएँ'), findsNothing);
    expect(find.text('5/5'), findsOneWidget);
  });
}
