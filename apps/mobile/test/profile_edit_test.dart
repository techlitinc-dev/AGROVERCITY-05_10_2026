import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/views/common/profile_edit_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

const _user = <String, dynamic>{
  'name': 'Ram Singh',
  'village': 'Ozark',
  'tehsil': 'Niphad',
  'soilType': 'काली मिट्टी (Black Cotton)',
  'irrigationType': 'ड्रिप सिंचाई (Drip)',
  'landAreaAcres': 3.5,
  'activeCrops': ['Wheat (गेहूं)'],
};

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('form prefilled from current user', (tester) async {
    await pumpScreen(
      tester,
      ProfileEditView(state: TestAppState(user: _user)),
    );

    expect(find.text('Ram Singh'), findsOneWidget);
    expect(find.text('Ozark'), findsOneWidget);
    expect(find.text('Niphad'), findsOneWidget);
  });

  testWidgets('save sends only changed fields', (tester) async {
    final userApi = FakeUserApi(_user);
    await pumpScreen(
      tester,
      ProfileEditView(state: TestAppState(user: _user, userApi: userApi)),
    );

    await tester.enterText(
      find.widgetWithText(TextField, 'गांव'),
      'NewVillage',
    );
    await tester.tap(find.text('सहेजें'));
    await tester.pump();
    await tester.pump();

    expect(userApi.lastUpdateFields, equals({'village': 'NewVillage'}));
    expect(find.text('प्रोफ़ाइल अपडेट हुई'), findsOneWidget);

    // flush the snackbar timer
    await tester.pump(const Duration(seconds: 5));
  });
}
