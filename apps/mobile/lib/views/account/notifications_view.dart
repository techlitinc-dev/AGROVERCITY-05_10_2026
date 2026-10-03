// Account: Notifications center. GET /v1/notifications lands Day 13 — until
// then any API failure renders the graceful empty state.

import 'package:flutter/material.dart';

import '../../api/notifications_api.dart';
import '../../state/app_state.dart';

class NotificationsView extends StatefulWidget {
  final AppState state;
  final NotificationsApi? notificationsApi;

  const NotificationsView({super.key, required this.state, this.notificationsApi});

  @override
  State<NotificationsView> createState() => _NotificationsViewState();
}

class _NotificationsViewState extends State<NotificationsView> {
  late final NotificationsApi _api =
      widget.notificationsApi ?? NotificationsApi();

  List<Map<String, dynamic>> _items = const [];
  bool _loading = true;

  static const Map<String, IconData> _typeIcons = {
    'rent_reminder': Icons.payments_rounded,
    'weather_alert': Icons.thunderstorm_rounded,
    'booking': Icons.event_rounded,
    'scheme': Icons.account_balance_rounded,
    'claim': Icons.health_and_safety_rounded,
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final page = await _api.listNotifications();
      if (!mounted) return;
      setState(() {
        _items = page.data;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _items = const [];
        _loading = false;
      });
    }
  }

  Future<void> _markAllRead() async {
    try {
      await _api.markAllRead();
      if (!mounted) return;
      setState(() {
        _items = [
          for (final n in _items) {...n, 'read': true},
        ];
      });
    } catch (_) {}
  }

  Future<void> _openItem(Map<String, dynamic> item) async {
    final type = item['type'] as String? ?? '';
    if (item['read'] != true) {
      final id = item['id'] as String?;
      if (id != null && id.isNotEmpty) {
        try {
          await _api.markRead(id);
        } catch (_) {}
        if (!mounted) return;
        setState(() {
          _items = [
            for (final n in _items)
              if (n['id'] == id) {...n, 'read': true} else n,
          ];
        });
      }
    }
    if (type == 'claim') widget.state.openClaimTracker();
  }

  String _relativeTime(String iso) {
    final at = DateTime.tryParse(iso)?.toLocal();
    if (at == null) return '';
    final diff = DateTime.now().difference(at);
    if (diff.inMinutes < 60) {
      return widget.state
          .tr('account.minutesAgo')
          .replaceAll('{count}', '${diff.inMinutes}');
    }
    if (diff.inHours < 24) {
      return widget.state
          .tr('account.hoursAgo')
          .replaceAll('{count}', '${diff.inHours}');
    }
    return widget.state
        .tr('account.daysAgo')
        .replaceAll('{count}', '${diff.inDays}');
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(widget.state.tr('notifications'),
                  style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF263238))),
              if (_items.isNotEmpty)
                TextButton(
                  onPressed: _markAllRead,
                  child: Text(widget.state.tr('account.markAllRead'),
                      style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF2E7D32))),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: CircularProgressIndicator(color: Color(0xFF43A047)),
              ),
            )
          else if (_items.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 60),
                child: Column(
                  children: [
                    const Icon(Icons.notifications_off_outlined,
                        size: 44, color: Colors.grey),
                    const SizedBox(height: 10),
                    Text(widget.state.tr('account.noNotifications'),
                        style:
                            const TextStyle(fontSize: 14, color: Colors.grey)),
                  ],
                ),
              ),
            )
          else
            ..._items.map((n) {
              final type = n['type'] as String? ?? '';
              final unread = n['read'] != true;
              return InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => _openItem(n),
                child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: unread ? const Color(0xFFF1F8E9) : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: unread ? const Color(0xFFA5D6A7) : const Color(0xFFECEFF1),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(_typeIcons[type] ?? Icons.notifications_rounded,
                        size: 20, color: const Color(0xFF43A047)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(n['title'] as String? ?? '',
                              style: const TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 2),
                          Text(n['body'] as String? ?? '',
                              style: const TextStyle(
                                  fontSize: 12, color: Colors.black87)),
                          const SizedBox(height: 4),
                          Text(
                            _relativeTime(n['createdAt'] as String? ?? ''),
                            style: const TextStyle(
                                fontSize: 10.5, color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                    if (unread)
                      Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.only(top: 4),
                        decoration: const BoxDecoration(
                          color: Color(0xFF43A047),
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
