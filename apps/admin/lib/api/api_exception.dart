class ApiException implements Exception {
  ApiException({required this.code, this.message = ''});

  final String code;
  final String message;

  factory ApiException.fromBody(int statusCode, Map<String, dynamic> body) {
    final error = body['error'];
    if (error is Map<String, dynamic>) {
      return ApiException(
        code: error['code'] as String? ?? 'HTTP_$statusCode',
        message: error['message'] as String? ?? '',
      );
    }
    return ApiException(code: 'HTTP_$statusCode');
  }

  @override
  String toString() => 'ApiException($code, $message)';
}
