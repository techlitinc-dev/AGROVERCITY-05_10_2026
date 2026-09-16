import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/api_client.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:kisan_setu/components/auth/mpin_reentry_sheet.dart';
import 'package:kisan_setu/core/navigation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

class _Harness extends StatefulWidget {
  const _Harness(this.client);

  final ApiClient client;

  @override
  State<_Harness> createState() => _HarnessState();
}

class _HarnessState extends State<_Harness> {
  String _output = 'idle';

  Future<void> _load() async {
    try {
      final data = await widget.client.get('/users/me');
      setState(() => _output = 'ok:${data['village']}');
    } on ApiException catch (e) {
      setState(() => _output = 'err:${e.code}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          ElevatedButton(onPressed: _load, child: const Text('load')),
          Text(_output),
        ],
      ),
    );
  }
}

void main() {
  late FakeHttpAdapter adapter;
  late ApiClient client;

  setUp(() {
    SharedPreferences.setMockInitialValues({
      'kAccessToken': 'old',
      'kRefreshToken': 'ref',
    });
    adapter = FakeHttpAdapter();
    adapter.onGet('/users/me', () => errorEnvelope('TOKEN_EXPIRED', 401));
    adapter.onGet('/users/me', () => jsonResponse({'village': 'Ozark'}, 200));
    adapter.onPost('/auth/mpin/verify', () => jsonResponse({'ok': true}, 200));
    adapter.onPost(
      '/auth/refresh',
      () => jsonResponse(
        {'accessToken': 'new', 'refreshToken': 'newref'},
        200,
      ),
    );

    final restorer = MpinSessionRestorer(
      contextProvider: () => rootNavigatorKey.currentContext,
      dio: Dio()..httpClientAdapter = adapter,
    );
    client = ApiClient(
      dio: Dio()..httpClientAdapter = adapter,
      sessionRestorer: restorer,
    );
  });

  Future<void> pumpHarness(WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(navigatorKey: rootNavigatorKey, home: _Harness(client)),
    );
    await tester.tap(find.text('load'));
    await tester.pumpAndSettle();
  }

  testWidgets('401 opens sheet, correct MPIN retries original request',
      (tester) async {
    await pumpHarness(tester);

    expect(find.text('सत्र समाप्त — MPIN दर्ज करें'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '1234');
    await tester.tap(find.text('पुष्टि करें'));
    await tester.pumpAndSettle();

    expect(find.text('ok:Ozark'), findsOneWidget);
    expect(find.text('सत्र समाप्त — MPIN दर्ज करें'), findsNothing);
    expect(
      adapter.requests.last.headers['Authorization'],
      'Bearer new',
    );
  });

  testWidgets('dismissing sheet propagates the original 401', (tester) async {
    await pumpHarness(tester);

    expect(find.text('सत्र समाप्त — MPIN दर्ज करें'), findsOneWidget);

    await tester.tap(find.text('रद्द करें'));
    await tester.pumpAndSettle();

    expect(find.text('err:TOKEN_EXPIRED'), findsOneWidget);
    expect(find.text('सत्र समाप्त — MPIN दर्ज करें'), findsNothing);
  });
}
