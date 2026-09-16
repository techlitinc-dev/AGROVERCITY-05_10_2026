import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String code;
  final String message;
  final Map<String, dynamic> fieldErrors;
  final int statusCode;

  const ApiException({
    required this.code,
    this.message = '',
    this.fieldErrors = const {},
    this.statusCode = 0,
  });

  factory ApiException.fromResponse(Response response) {
    final data = response.data;
    if (data is Map<String, dynamic> && data['error'] is Map<String, dynamic>) {
      final error = data['error'] as Map<String, dynamic>;
      return ApiException(
        code: error['code'] as String? ?? 'UNKNOWN',
        message: error['message'] as String? ?? '',
        fieldErrors:
            (error['fieldErrors'] as Map?)?.cast<String, dynamic>() ?? const {},
        statusCode: response.statusCode ?? 0,
      );
    }
    return ApiException(
      code: 'HTTP_${response.statusCode}',
      statusCode: response.statusCode ?? 0,
    );
  }

  @override
  String toString() => 'ApiException($code): $message';
}
