// Offline write queue (Day 11 Task B4). Failed-network POSTs queue here and
// replay via POST /v1/sync (backend lands Day 14 Task A3).

import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../api/endpoints.dart';

class OfflineQueue {
  OfflineQueue();

  static final OfflineQueue instance = OfflineQueue();
  static const String _storageKey = 'offline_write_queue';

  // Feeds the AppState sync pill.
  void Function(int count)? onPendingCountChanged;

  Future<List<Map<String, dynamic>>> _read() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      return (jsonDecode(raw) as List)
          .map((e) => (e as Map).cast<String, dynamic>())
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> _write(List<Map<String, dynamic>> ops) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, jsonEncode(ops));
    onPendingCountChanged?.call(ops.length);
  }

  Future<int> pendingCount() async => (await _read()).length;

  Future<String> enqueue({
    required String method,
    required String path,
    required Map<String, dynamic> body,
    String? idempotencyKey,
  }) async {
    final key = idempotencyKey ?? const Uuid().v4();
    final ops = await _read();
    ops.add({
      'idempotencyKey': key,
      'method': method,
      'path': path,
      'body': body,
      'queuedAt': DateTime.now().toUtc().toIso8601String(),
      'retries': 0,
    });
    await _write(ops);
    return key;
  }

  Future<void> flush(ApiClient client) async {
    final ops = await _read();
    if (ops.isEmpty) return;
    final Map<String, dynamic> res;
    try {
      res = await client.post(pathSync, body: {'operations': ops});
    } on ApiException catch (e) {
      if (e.code == 'NETWORK_ERROR') return; // still offline — keep all
      rethrow;
    }
    final results = ((res['results'] as List?) ?? const <dynamic>[])
        .map((e) => (e as Map).cast<String, dynamic>());
    final byKey = {for (final r in results) '${r['idempotencyKey']}': r};
    final remaining = <Map<String, dynamic>>[];
    for (final op in ops) {
      final result = byKey['${op['idempotencyKey']}'];
      final status = result?['status'];
      if (status == 'applied' || status == 'duplicate') continue;
      if (status == 'error') {
        final retries = ((op['retries'] as num?) ?? 0).toInt();
        if (retries >= 1) {
          debugPrint('OfflineQueue: dropping op ${op['idempotencyKey']} '
              'after retry (${result?['error'] ?? 'error'})');
          continue;
        }
        op['retries'] = retries + 1;
      }
      remaining.add(op);
    }
    await _write(remaining);
  }
}

// Flush triggers: foreground resume + connectivity restore (Day 11 B4.3).
class OfflineSyncCoordinator with WidgetsBindingObserver {
  OfflineSyncCoordinator({
    required this.queue,
    required this.client,
    Connectivity? connectivity,
  }) : _connectivity = connectivity ?? Connectivity();

  final OfflineQueue queue;
  final ApiClient client;
  final Connectivity _connectivity;
  StreamSubscription<List<ConnectivityResult>>? _sub;
  bool _flushing = false;

  void start() {
    WidgetsBinding.instance.addObserver(this);
    _sub = _connectivity.onConnectivityChanged.listen((results) {
      final online = results.any((r) => r != ConnectivityResult.none);
      if (online) flush();
    });
    unawaited(queue.pendingCount().then(
        (n) => queue.onPendingCountChanged?.call(n)));
    flush();
  }

  void stop() {
    WidgetsBinding.instance.removeObserver(this);
    _sub?.cancel();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) flush();
  }

  Future<void> flush() async {
    if (_flushing) return;
    _flushing = true;
    try {
      await queue.flush(client);
    } catch (_) {
      // replay errors surface on the next trigger
    } finally {
      _flushing = false;
    }
  }
}
