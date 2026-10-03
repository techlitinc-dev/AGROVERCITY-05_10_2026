import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/content_api.dart';
import 'package:kisan_setu/models/agri_news_item.dart';
import 'package:kisan_setu/views/agri_news_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class FakeContentApi extends ContentApi {
  NewsPage newsPage = const NewsPage(items: [], page: 1, pageSize: 20, total: 0);

  String? lastCategory;
  int? lastPage;

  @override
  Future<NewsPage> listNews({String? category, int page = 1}) async {
    lastCategory = category;
    lastPage = page;
    return newsPage;
  }
}

AgriNewsItem _news(String id, {bool breaking = false, String category = 'market-policy'}) =>
    AgriNewsItem(
      id: id,
      title: 'Title $id',
      vernacularTitle: 'बातमी शीर्षक $id',
      category: category,
      source: 'Test Source',
      timestamp: '2026-09-17T08:30:00Z',
      summary: 'सारांश $id',
      content: 'सविस्तर मजकूर $id',
      isBreaking: breaking,
      audioText: 'ऑडिओ $id',
      impactRating: 'High Bullish 📈',
    );

Future<void> pumpNewsView(WidgetTester tester, FakeContentApi api) async {
  await pumpScreen(
    tester,
    Scaffold(body: AgriNewsView(state: TestAppState(), contentApi: api)),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('news renders breaking banner', (tester) async {
    final api = FakeContentApi()
      ..newsPage = NewsPage(
        items: [_news('n1', breaking: true), _news('n2')],
        page: 1,
        pageSize: 20,
        total: 2,
      );
    await pumpNewsView(tester, api);

    expect(find.text('BREAKING NEWS ⚡'), findsOneWidget);
    expect(find.text('बातमी शीर्षक n1'), findsWidgets);
  });

  testWidgets('category filter refetches', (tester) async {
    final api = FakeContentApi()
      ..newsPage = NewsPage(items: [_news('n1')], page: 1, pageSize: 20, total: 1);
    await pumpNewsView(tester, api);
    expect(api.lastCategory, isNull);

    await tester.tap(find.text('हवामान अलर्ट'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));

    expect(api.lastCategory, 'weather-alert');
  });
}
