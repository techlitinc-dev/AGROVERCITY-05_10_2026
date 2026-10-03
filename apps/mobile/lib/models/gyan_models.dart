// Gyan Hub models — fields match GET /v1/workshops, /v1/expert-talks,
// /v1/videos, /v1/blogs exactly. Vernacular getters keep the ported
// prototype template unchanged (seeds carry vernacular text in title/topic).

class PaidWorkshop {
  final String id;
  final String title;
  final String instructor;
  final String instructorRole;
  final String institution;
  final int feeRupees;
  final int coinsDiscountAllowed;
  final String duration;
  final String batchDate;
  final String timing;
  final double rating;
  final int enrolledCount;
  final int totalSeats;
  final bool isCertified;
  final String certificateTitle;
  final List<String> syllabusModules;
  final List<String> deliverables;
  bool isEnrolled;

  PaidWorkshop({
    required this.id,
    required this.title,
    required this.instructor,
    required this.instructorRole,
    required this.institution,
    required this.feeRupees,
    required this.coinsDiscountAllowed,
    required this.duration,
    required this.batchDate,
    required this.timing,
    required this.rating,
    required this.enrolledCount,
    required this.totalSeats,
    required this.isCertified,
    required this.certificateTitle,
    required this.syllabusModules,
    required this.deliverables,
    this.isEnrolled = false,
  });

  String get vernacularTitle => title;

  factory PaidWorkshop.fromJson(Map<String, dynamic> json) => PaidWorkshop(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        instructor: json['instructor'] as String? ?? '',
        instructorRole: json['instructorRole'] as String? ?? '',
        institution: json['institution'] as String? ?? '',
        feeRupees: (json['feeRupees'] as num?)?.toInt() ?? 0,
        coinsDiscountAllowed:
            (json['coinsDiscountAllowed'] as num?)?.toInt() ?? 0,
        duration: json['duration'] as String? ?? '',
        batchDate: json['batchDate'] as String? ?? '',
        timing: json['timing'] as String? ?? '',
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        enrolledCount: (json['enrolledCount'] as num?)?.toInt() ?? 0,
        totalSeats: (json['totalSeats'] as num?)?.toInt() ?? 0,
        isCertified: json['isCertified'] == true,
        certificateTitle: json['certificateTitle'] as String? ?? '',
        syllabusModules:
            ((json['syllabusModules'] as List?) ?? const <dynamic>[])
                .map((e) => "$e")
                .toList(),
        deliverables: ((json['deliverables'] as List?) ?? const <dynamic>[])
            .map((e) => "$e")
            .toList(),
        isEnrolled: json['isEnrolled'] == true,
      );
}

class ExpertTalk {
  final String id;
  final String expertName;
  final String institution;
  final String topic;
  final String scheduledTime;
  final bool isLive;
  final int registeredCount;
  final String description;

  const ExpertTalk({
    required this.id,
    required this.expertName,
    required this.institution,
    required this.topic,
    required this.scheduledTime,
    required this.isLive,
    required this.registeredCount,
    required this.description,
  });

  String get vernacularTopic => topic;

  String get expertAvatar {
    final parts =
        expertName.split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1);
    return '${parts.first.substring(0, 1)}${parts[1].substring(0, 1)}';
  }

  factory ExpertTalk.fromJson(Map<String, dynamic> json) => ExpertTalk(
        id: json['id'] as String? ?? '',
        expertName: json['expertName'] as String? ?? '',
        institution: json['institution'] as String? ?? '',
        topic: json['topic'] as String? ?? '',
        scheduledTime: json['scheduledTime'] as String? ?? '',
        isLive: json['isLive'] == true,
        registeredCount: (json['registeredCount'] as num?)?.toInt() ?? 0,
        description: json['description'] as String? ?? '',
      );
}

class VideoGuide {
  final String id;
  final String title;
  final String instructor;
  final String duration;
  final String views;
  final String category;
  final String videoUrl;
  final String summary;
  final List<String> keyPoints;

  const VideoGuide({
    required this.id,
    required this.title,
    required this.instructor,
    required this.duration,
    required this.views,
    required this.category,
    required this.videoUrl,
    required this.summary,
    required this.keyPoints,
  });

  String get vernacularTitle => title;

  factory VideoGuide.fromJson(Map<String, dynamic> json) => VideoGuide(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        instructor: json['instructor'] as String? ?? '',
        duration: json['duration'] as String? ?? '',
        views: json['views'] as String? ?? '',
        category: json['category'] as String? ?? '',
        videoUrl: json['videoUrl'] as String? ?? '',
        summary: json['summary'] as String? ?? '',
        keyPoints: ((json['keyPoints'] as List?) ?? const <dynamic>[])
            .map((e) => "$e")
            .toList(),
      );
}

class BlogArticle {
  final String id;
  final String title;
  final String author;
  final String authorRole;
  final String readTimeMinutes;
  final String category;
  final String summary;
  final String content;
  final String publishedDate;
  int likesCount;
  bool isBookmarked;

  BlogArticle({
    required this.id,
    required this.title,
    required this.author,
    required this.authorRole,
    required this.readTimeMinutes,
    required this.category,
    required this.summary,
    required this.content,
    required this.publishedDate,
    required this.likesCount,
    this.isBookmarked = false,
  });

  String get vernacularTitle => title;

  factory BlogArticle.fromJson(Map<String, dynamic> json) => BlogArticle(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        author: json['author'] as String? ?? '',
        authorRole: json['authorRole'] as String? ?? '',
        readTimeMinutes: json['readTimeMinutes'] as String? ?? '',
        category: json['category'] as String? ?? '',
        summary: json['summary'] as String? ?? '',
        content: json['content'] as String? ?? '',
        publishedDate: json['publishedDate'] as String? ?? '',
        likesCount: (json['likesCount'] as num?)?.toInt() ?? 0,
        isBookmarked: json['isBookmarked'] == true,
      );
}
