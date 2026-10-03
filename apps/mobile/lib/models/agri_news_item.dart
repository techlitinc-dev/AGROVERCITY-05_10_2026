// Agri News item + pagination envelope — fields match GET /v1/news exactly.

class AgriNewsItem {
  final String id;
  final String title;
  final String vernacularTitle;
  final String category;
  final String source;
  final String timestamp;
  final String summary;
  final String content;
  final bool isBreaking;
  final String audioText;
  final String? impactRating;

  const AgriNewsItem({
    required this.id,
    required this.title,
    required this.vernacularTitle,
    required this.category,
    required this.source,
    required this.timestamp,
    required this.summary,
    required this.content,
    required this.isBreaking,
    required this.audioText,
    this.impactRating,
  });

  factory AgriNewsItem.fromJson(Map<String, dynamic> json) => AgriNewsItem(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        vernacularTitle: json['vernacularTitle'] as String? ?? '',
        category: json['category'] as String? ?? '',
        source: json['source'] as String? ?? '',
        timestamp: json['timestamp'] as String? ?? '',
        summary: json['summary'] as String? ?? '',
        content: json['content'] as String? ?? '',
        isBreaking: json['isBreaking'] == true,
        audioText: json['audioText'] as String? ?? '',
        impactRating: json['impactRating'] as String?,
      );
}

class NewsPage {
  final List<AgriNewsItem> items;
  final int page;
  final int pageSize;
  final int total;

  const NewsPage({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  factory NewsPage.fromJson(Map<String, dynamic> json) => NewsPage(
        items: ((json['data'] as List?) ?? const <dynamic>[])
            .map((e) => AgriNewsItem.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
        page: (json['page'] as num?)?.toInt() ?? 1,
        pageSize: (json['pageSize'] as num?)?.toInt() ?? 20,
        total: (json['total'] as num?)?.toInt() ?? 0,
      );
}
