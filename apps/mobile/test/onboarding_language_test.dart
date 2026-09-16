import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/views/onboarding/language_select_view.dart';

import 'helpers.dart';

void main() {
  testWidgets('language grid renders with regional groups', (tester) async {
    await pumpScreen(tester, LanguageSelectView(state: TestAppState()));

    expect(find.text('Hindi'), findsOneWidget);
    expect(find.textContaining('West'), findsWidgets);
  });

  testWidgets('audio preview button exists per language', (tester) async {
    await pumpScreen(tester, LanguageSelectView(state: TestAppState()));

    expect(find.byIcon(Icons.volume_up_rounded), findsAtLeastNWidgets(3));
  });
}
