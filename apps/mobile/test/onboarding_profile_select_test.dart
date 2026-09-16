import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/views/onboarding/profile_select_view.dart';

import 'helpers.dart';

Finder _personaCard(String labelHi) => find.ancestor(
      of: find.text(labelHi),
      matching: find.byType(AnimatedContainer),
    );

void main() {
  testWidgets('six persona cards render', (tester) async {
    await pumpScreen(tester, ProfileSelectView(state: TestAppState()));

    expect(find.text('किसान'), findsOneWidget);
    expect(find.text('खेत मालिक'), findsOneWidget);
    expect(find.text('परिवहन'), findsOneWidget);
    expect(find.text('व्यापारी'), findsOneWidget);
  });

  testWidgets('continue disabled until selection', (tester) async {
    await pumpScreen(
      tester,
      ProfileSelectView(state: TestAppState(linked: const [])),
    );

    ElevatedButton continueButton = tester.widget(find.byType(ElevatedButton));
    expect(continueButton.onPressed, isNull);

    await tester.tap(find.text('किसान'));
    await tester.pump();

    continueButton = tester.widget(find.byType(ElevatedButton));
    expect(continueButton.onPressed, isNotNull);
  });

  testWidgets('star marks primary profile', (tester) async {
    await pumpScreen(tester, ProfileSelectView(state: TestAppState()));

    await tester.ensureVisible(find.text('व्यापारी'));
    await tester.pump(const Duration(milliseconds: 500));

    await tester.tap(find.text('व्यापारी'));
    await tester.pump(const Duration(milliseconds: 300));

    expect(
      find.descendant(
        of: _personaCard('व्यापारी'),
        matching: find.byIcon(Icons.check_rounded),
      ),
      findsOneWidget,
    );

    await tester.tap(find.text('जुड़ा'));
    await tester.pump(const Duration(milliseconds: 300));

    expect(
      find.descendant(
        of: _personaCard('व्यापारी'),
        matching: find.byIcon(Icons.star_rounded),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: _personaCard('किसान'),
        matching: find.byIcon(Icons.check_rounded),
      ),
      findsOneWidget,
    );

    // flush the 4s toast timer from showToast
    await tester.pump(const Duration(seconds: 5));
  });
}
