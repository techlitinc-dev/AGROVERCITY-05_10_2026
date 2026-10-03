import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/models/app_models.dart' show FarmDiaryType;
import 'package:kisan_setu/models/diary_analytics.dart';
import 'package:kisan_setu/models/farm_diary_entry.dart';

void main() {
  group('DiaryAnalytics.fromJson', () {
    test('parses the exact backend contract payload', () {
      final analytics = DiaryAnalytics.fromJson(const {
        'from': '2026-01-01',
        'to': '2026-09-26',
        'totals': {
          'income': 12000.0,
          'expense': 4500.5,
          'net': 7499.5,
          'entryCount': 14,
          'incomeCount': 4,
          'expenseCount': 7,
          'activityCount': 3,
        },
        'byCategory': [
          {'category': 'Fertilizer', 'type': 'expense', 'amount': 2200.0, 'count': 5},
          {'category': 'Mandi Sale', 'type': 'income', 'amount': 9000.0, 'count': 2},
        ],
        'byCrop': [
          {'cropName': 'Tomato', 'income': 9000.0, 'expense': 2000.0, 'net': 7000.0, 'count': 6},
          {'cropName': 'अन्य', 'income': 0.0, 'expense': 2500.0, 'net': -2500.0, 'count': 4},
        ],
        'byMonth': [
          {'month': '2026-08', 'income': 4000.0, 'expense': 1500.0, 'net': 2500.0, 'count': 4},
          {'month': '2026-09', 'income': 8000.0, 'expense': 3000.0, 'net': 5000.0, 'count': 10},
        ],
        'byDay': [
          {'date': '2026-09-01', 'income': 1000.0, 'expense': 0.0, 'count': 1},
          {'date': '2026-09-02', 'income': 0.0, 'expense': 500.0, 'count': 2},
        ],
      });

      expect(analytics.from, '2026-01-01');
      expect(analytics.to, '2026-09-26');

      expect(analytics.totals.income, 12000.0);
      expect(analytics.totals.expense, 4500.5);
      expect(analytics.totals.net, 7499.5);
      expect(analytics.totals.entryCount, 14);
      expect(analytics.totals.incomeCount, 4);
      expect(analytics.totals.expenseCount, 7);
      expect(analytics.totals.activityCount, 3);

      expect(analytics.byCategory.length, 2);
      expect(analytics.byCategory.first.category, 'Fertilizer');
      expect(analytics.byCategory.first.type, 'expense');
      expect(analytics.byCategory.first.amount, 2200.0);
      expect(analytics.byCategory.first.count, 5);

      expect(analytics.byCrop.length, 2);
      expect(analytics.byCrop.first.cropName, 'Tomato');
      expect(analytics.byCrop.first.net, 7000.0);
      expect(analytics.byCrop[1].cropName, 'अन्य');
      expect(analytics.byCrop[1].net, -2500.0);

      expect(analytics.byMonth.length, 2);
      expect(analytics.byMonth.first.month, '2026-08');
      expect(analytics.byMonth.last.income, 8000.0);

      expect(analytics.byDay.length, 2);
      expect(analytics.byDay.first.date, '2026-09-01');
      expect(analytics.byDay.last.expense, 500.0);
      expect(analytics.byDay.last.count, 2);
    });

    test('parses null from/to (all-time) and missing sections', () {
      final analytics = DiaryAnalytics.fromJson(const {
        'from': null,
        'to': null,
        'totals': {
          'income': 0.0,
          'expense': 0.0,
          'net': 0.0,
          'entryCount': 0,
          'incomeCount': 0,
          'expenseCount': 0,
          'activityCount': 0,
        },
      });

      expect(analytics.from, isNull);
      expect(analytics.to, isNull);
      expect(analytics.totals.net, 0.0);
      expect(analytics.byCategory, isEmpty);
      expect(analytics.byCrop, isEmpty);
      expect(analytics.byMonth, isEmpty);
      expect(analytics.byDay, isEmpty);
    });

    test('empty map yields safe defaults', () {
      final analytics = DiaryAnalytics.fromJson(const {});
      expect(analytics.from, isNull);
      expect(analytics.totals.income, 0.0);
      expect(analytics.totals.activityCount, 0);
      expect(analytics.byMonth, isEmpty);
    });

    test('tolerates malformed rows inside sections', () {
      final analytics = DiaryAnalytics.fromJson(const {
        'byCategory': [
          {'amount': 'oops'},
          null,
        ],
        'byMonth': [
          {'month': '2026-09'},
        ],
      });
      expect(analytics.byCategory.length, 1); // null row skipped, bad row defaulted
      expect(analytics.byCategory.first.category, '');
      expect(analytics.byCategory.first.amount, 0.0);
      expect(analytics.byMonth.single.month, '2026-09');
      expect(analytics.byMonth.single.count, 0);
    });
  });

  group('FarmDiaryEntry parsing', () {
    test('full contract JSON round-trips through fromJson/toJson', () {
      final entry = FarmDiaryEntry.fromJson(const {
        'id': 'e1',
        'title': 'Weeding',
        'category': 'Labor',
        'type': 'farmActivity',
        'amount': 0,
        'date': '2026-09-20',
        'cropName': 'Tomato',
        'notes': '2 labourers',
        'photos': ['https://img.example/a.jpg', 'https://img.example/b.jpg'],
        'quantity': 2.5,
        'unit': 'quintal',
        'createdAt': '2026-09-20T10:00:00.000Z',
        'updatedAt': '2026-09-20T11:00:00.000Z',
      });

      expect(entry.type, FarmDiaryType.farmActivity);
      expect(entry.photos.length, 2);
      expect(entry.quantity, 2.5);
      expect(entry.unit, 'quintal');
      expect(entry.createdAt, '2026-09-20T10:00:00.000Z');
      expect(entry.updatedAt, '2026-09-20T11:00:00.000Z');

      final json = entry.toJson();
      expect(json['photos'], ['https://img.example/a.jpg', 'https://img.example/b.jpg']);
      expect(json['quantity'], 2.5);
      expect(json['unit'], 'quintal');
      expect(json['type'], 'farmActivity');
      expect(json.containsKey('id'), isFalse);
    });

    test('legacy doc without new fields gets defaults', () {
      final entry = FarmDiaryEntry.fromJson(const {
        'id': 'd-legacy',
        'title': 'Old entry',
        'category': 'Seeds',
        'type': 'expense',
        'amount': 300,
        'date': '2025-11-02',
        'cropName': 'Wheat',
        'notes': 'legacy',
      });

      expect(entry.photos, isEmpty);
      expect(entry.quantity, isNull);
      expect(entry.unit, isNull);
      expect(entry.createdAt, '');
      expect(entry.updatedAt, '');
      expect(entry.toJson()['quantity'], isNull);
    });

    test('null photos/quantity/unit are tolerated', () {
      final entry = FarmDiaryEntry.fromJson(const {
        'id': 'e2',
        'title': 't',
        'category': 'c',
        'type': 'income',
        'amount': 100,
        'date': '2026-01-01',
        'cropName': 'c',
        'notes': 'n',
        'photos': null,
        'quantity': null,
        'unit': null,
      });
      expect(entry.photos, isEmpty);
      expect(entry.quantity, isNull);
      expect(entry.unit, isNull);
    });
  });
}
