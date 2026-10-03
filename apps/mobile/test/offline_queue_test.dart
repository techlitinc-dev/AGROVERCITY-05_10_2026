import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kisan_setu/api/api_client.dart';
import 'package:kisan_setu/services/offline_queue.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('enqueue persists and flush clears applied ops', () async {
    final queue = OfflineQueue();

    await queue.enqueue(
      method: 'POST',
      path: '/insurance/claims',
      body: {'policyId': 'pol-1'},
      idempotencyKey: 'k-applied',
    );
    await queue.enqueue(
      method: 'POST',
      path: '/equipment/slots/s1/book',
      body: {'farmerName': 'Ram'},
      idempotencyKey: 'k-error',
    );
    expect(await queue.pendingCount(), 2);

    final adapter = FakeHttpAdapter();
    adapter.onPost(
      '/sync',
      () => jsonResponse({
        'results': [
          {'idempotencyKey': 'k-applied', 'status': 'applied'},
          {'idempotencyKey': 'k-error', 'status': 'error', 'error': 'SLOT_FULL'},
        ],
      }, 200),
    );
    final client = ApiClient(
      dio: Dio(BaseOptions(baseUrl: 'http://fake'))
        ..httpClientAdapter = adapter,
    );

    await queue.flush(client);

    // applied op removed; error op kept for exactly one retry
    expect(await queue.pendingCount(), 1);

    final lastSync = adapter.requests.lastWhere((r) => r.path == '/sync');
    final ops = (lastSync.body['operations'] as List).cast<Map>();
    expect(
      ops.map((o) => o['idempotencyKey']).toList(),
      containsAll(['k-applied', 'k-error']),
    );

    await queue.flush(client);

    // error op retried once, then dropped
    expect(await queue.pendingCount(), 0);
  });
}
