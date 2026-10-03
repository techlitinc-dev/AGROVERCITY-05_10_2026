import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../config.dart';
import '../core/constants.dart';
import 'api_exception.dart';
import 'endpoints.dart';

class AppConfigApi {
  AppConfigApi({Dio? dio}) : _dio = dio ?? Dio();

  final Dio _dio;

  String get _platform {
    if (kIsWeb) return 'web';
    return switch (defaultTargetPlatform) {
      TargetPlatform.iOS => 'ios',
      _ => 'android',
    };
  }

  Future<Map<String, dynamic>> getAppConfig() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '$apiBaseUrl$pathAppConfig',
      queryParameters: {'version': kAppVersion, 'platform': _platform},
    );
    final data = response.data;
    if (data == null) {
      throw const ApiException(code: 'EMPTY_RESPONSE');
    }
    return data;
  }
}
