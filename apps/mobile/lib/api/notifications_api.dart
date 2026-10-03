import 'api_client.dart';
import 'endpoints.dart';

class NotificationsPage {
  const NotificationsPage({
    required this.data,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  final List<Map<String, dynamic>> data;
  final int page;
  final int pageSize;
  final int total;
}

class NotificationsApi {
  NotificationsApi({ApiClient? client}) : _client = client ?? ApiClient();

  final ApiClient _client;

  Future<NotificationsPage> listNotifications({
    int page = 1,
    int pageSize = 20,
  }) async {
    final res = await _client.get(
      pathNotifications,
      query: {'page': page, 'pageSize': pageSize},
    );
    return NotificationsPage(
      data: ((res['data'] as List?) ?? const <dynamic>[])
          .map((e) => (e as Map).cast<String, dynamic>())
          .toList(),
      page: (res['page'] as num?)?.toInt() ?? page,
      pageSize: (res['pageSize'] as num?)?.toInt() ?? pageSize,
      total: (res['total'] as num?)?.toInt() ?? 0,
    );
  }

  Future<void> markAllRead() => _client
      .put(pathNotificationsReadAll)
      .then((_) {});

  Future<void> markRead(String id) =>
      _client.post(notificationReadPath(id)).then((_) {});
}
