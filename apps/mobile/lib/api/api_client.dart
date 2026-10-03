import 'dart:async';

import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';

import '../config.dart';
import '../core/session_store.dart';
import 'api_exception.dart';

import 'endpoints.dart';

// Implemented by the MPIN re-entry flow: returns true when the session was
// restored (MPIN verified + tokens refreshed) and the request may be retried.
abstract class SessionRestorer {
  Future<bool> restoreSession();
}

class ApiClient {
  ApiClient({
    Dio? dio,
    SessionStore? sessionStore,
    String Function()? languageProvider,
    this.sessionRestorer,
  })  : dio = dio ?? Dio(BaseOptions(baseUrl: apiBaseUrl)),
        sessionStore = sessionStore ?? SessionStore(),
        _languageProvider = languageProvider ?? (() => 'en') {
    this.dio.interceptors.add(
          InterceptorsWrapper(onRequest: _onRequest, onError: _onError),
        );
  }

  final Dio dio;
  final SessionStore sessionStore;
  final String Function() _languageProvider;
  final SessionRestorer? sessionRestorer;
  final Uuid _uuid = const Uuid();

  Completer<bool>? _restoring;

  static bool _isPublicAuthPath(String path) {
    final cleanPath = path.split('?').first;
    return cleanPath == pathAuthLogin ||
        cleanPath == pathAuthFirebaseVerify ||
        cleanPath == pathAuthRegister ||
        cleanPath == pathAuthRefresh ||
        cleanPath == pathAuthMpinReset ||
        cleanPath.contains('/auth/login') ||
        cleanPath.contains('/auth/firebase-verify') ||
        cleanPath.contains('/auth/register') ||
        cleanPath.contains('/auth/refresh') ||
        cleanPath.contains('/auth/mpin/reset') ||
        cleanPath.contains('/auth/quick-login') ||
        cleanPath.contains('/app-config');
  }

  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (!_isPublicAuthPath(options.path)) {
      final token = await sessionStore.accessToken;
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    options.headers['Accept-Language'] = _languageProvider();
    const writeMethods = {'POST', 'PUT', 'PATCH', 'DELETE'};
    if (writeMethods.contains(options.method) &&
        options.headers['Idempotency-Key'] == null) {
      options.headers['Idempotency-Key'] = _uuid.v4();
    }
    handler.next(options);
  }

  Future<void> _onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final response = err.response;
    if (response == null) {
      handler.reject(_wrap(err, const ApiException(code: 'NETWORK_ERROR')));
      return;
    }

    final apiError = ApiException.fromResponse(response);
    final hadAuth = err.requestOptions.headers['Authorization'] != null;
    final alreadyRetried = err.requestOptions.extra['retried'] == true;
    final isPublicAuth = _isPublicAuthPath(err.requestOptions.path);

    if (response.statusCode == 401 &&
        hadAuth &&
        !isPublicAuth &&
        !alreadyRetried &&
        sessionRestorer != null) {
      final restored = await _restore();
      if (restored) {
        try {
          err.requestOptions.extra['retried'] = true;
          // removed so the auth interceptor re-adds the fresh token
          err.requestOptions.headers.remove('Authorization');
          final retryResponse = await dio.fetch(err.requestOptions);
          return handler.resolve(retryResponse);
        } on DioException catch (retryErr) {
          final retryApiError = retryErr.error;
          return handler.reject(
            retryApiError is ApiException ? retryErr : _wrap(retryErr, apiError),
          );
        }
      } else {
        await sessionStore.clear();
      }
    }
    handler.reject(_wrap(err, apiError));
  }

  Future<bool> _restore() {
    final inFlight = _restoring;
    if (inFlight != null) return inFlight.future;
    final completer = Completer<bool>();
    _restoring = completer;
    sessionRestorer!.restoreSession().then(completer.complete).catchError((_) {
      completer.complete(false);
    }).whenComplete(() => _restoring = null);
    return completer.future;
  }

  DioException _wrap(DioException err, ApiException apiError) {
    return DioException(
      requestOptions: err.requestOptions,
      response: err.response,
      type: err.type,
      error: apiError,
    );
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) =>
      _run(() => dio.get(path, queryParameters: query));

  Future<Map<String, dynamic>> post(
    String path, {
    dynamic body,
    Map<String, dynamic>? query,
  }) =>
      _run(() => dio.post(path, data: body, queryParameters: query));

  Future<Map<String, dynamic>> put(String path, {dynamic body}) =>
      _run(() => dio.put(path, data: body));

  Future<Map<String, dynamic>> patch(String path, {dynamic body}) =>
      _run(() => dio.patch(path, data: body));

  Future<Map<String, dynamic>> delete(String path, {dynamic body}) =>
      _run(() => dio.delete(path, data: body));

  Future<Map<String, dynamic>> postMultipart(String path, FormData form) =>
      _run(() => dio.post(path, data: form));

  Future<Map<String, dynamic>> _run(
    Future<Response<dynamic>> Function() call,
  ) async {
    try {
      final response = await call();
      final data = response.data;
      if (data is Map<String, dynamic>) return data;
      return {'data': data};
    } on DioException catch (e) {
      final error = e.error;
      if (error is ApiException) throw error;
      throw ApiException(code: 'NETWORK_ERROR', message: e.message ?? '');
    }
  }
}
