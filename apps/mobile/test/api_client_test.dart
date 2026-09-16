import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/api_client.dart';
import 'package:kisan_setu/api/api_exception.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'helpers.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late FakeHttpAdapter adapter;
  late ApiClient client;

  setUp(() {
    adapter = FakeHttpAdapter();
    client = ApiClient(dio: Dio()..httpClientAdapter = adapter);
  });

  test('adds Authorization header when token saved', () async {
    SharedPreferences.setMockInitialValues({'kAccessToken': 'tok'});
    adapter.onGet('/users/me', () => jsonResponse({'ok': true}, 200));

    await client.get('/users/me');

    expect(adapter.requests.single.headers['Authorization'], 'Bearer tok');
    expect(adapter.requests.single.headers['Accept-Language'], isNotEmpty);
  });

  test('adds Idempotency-Key on POST but not GET', () async {
    SharedPreferences.setMockInitialValues({});
    adapter.onPost('/auth/mpin/verify', () => jsonResponse({'ok': true}, 200));
    adapter.onGet('/users/me', () => jsonResponse({'ok': true}, 200));

    await client.post('/auth/mpin/verify', body: {'mpin': '1234'});
    await client.get('/users/me');

    final post = adapter.requests.first;
    final get = adapter.requests.last;
    expect(post.headers['Idempotency-Key'], isNotNull);
    expect(get.headers['Idempotency-Key'], isNull);
  });

  test('error envelope maps to ApiException', () async {
    SharedPreferences.setMockInitialValues({});
    adapter.on('DELETE', '/users/me/profiles/farmer',
        () => errorEnvelope('LAST_PROFILE', 409, message: 'कम से कम एक प्रोफाइल'));

    expect(
      () => client.delete('/users/me/profiles/farmer'),
      throwsA(isA<ApiException>()
          .having((e) => e.code, 'code', 'LAST_PROFILE')
          .having((e) => e.statusCode, 'statusCode', 409)),
    );
  });
}
