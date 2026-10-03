import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_error.dart';
import 'json_value.dart';
import 'session_access.dart';

/// Go envelope boundary. This client never retries requests or logs credentials.
class ApiClient {
  ApiClient({
    required Uri baseUrl,
    required http.Client transport,
    required SessionAccess session,
    Duration timeout = const Duration(seconds: 20),
  }) : _baseUrl = baseUrl,
       _transport = transport,
       _session = session,
       _timeout = timeout;

  final Uri _baseUrl;
  final http.Client _transport;
  final SessionAccess _session;
  final Duration _timeout;

  Future<Object?> request(
    String method,
    String path, {
    Map<String, Object?>? body,
    Map<String, String>? query,
    bool authenticated = true,
    bool adminPrefix = true,
  }) async {
    final verb = method.toUpperCase();
    final isWrite = verb != 'GET' && verb != 'HEAD' && verb != 'OPTIONS';
    // Snapshot both values before dispatch; a newer login must not be cleared
    // by an older request. SessionController owns the generation comparison.
    final requestGeneration = _session.generation;
    final token = authenticated ? _session.token : null;
    final basePath = _baseUrl.path.replaceFirst(RegExp(r'/+$'), '');
    final endpoint = path.replaceFirst(RegExp(r'^/+'), '');
    final prefix = adminPrefix ? '/api/v1/admin' : '';
    final uri = _baseUrl.replace(
      path: '$basePath$prefix/$endpoint',
      queryParameters: query,
    );
    final request = http.Request(verb, uri);
    request.headers['Accept'] = 'application/json';
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    if (body != null) {
      // Encoding happens before dispatch: a local encoding failure cannot have
      // executed a write and must not be mistaken for a network failure.
      try {
        request.headers['Content-Type'] = 'application/json; charset=utf-8';
        request.bodyBytes = utf8.encode(jsonEncode(body));
      } on Object {
        throw const ApiError(message: '请求数据格式有误', kind: ApiErrorKind.protocol);
      }
    }

    final http.Response response;
    try {
      response = await (() async {
        final streamed = await _transport.send(request);
        return http.Response.fromStream(streamed);
      })().timeout(_timeout);
    } on TimeoutException {
      throw ApiError(
        message: '请求超时，请检查网络后重试',
        kind: ApiErrorKind.timeout,
        uncertainWrite: isWrite,
      );
    } on Object {
      throw ApiError(
        message: '网络连接失败，请检查网络后重试',
        kind: ApiErrorKind.network,
        uncertainWrite: isWrite,
      );
    }

    final status = response.statusCode;
    Map<String, Object?>? envelope;
    try {
      envelope = JsonValue.object(jsonDecode(utf8.decode(response.bodyBytes)));
    } on Object {
      // HTTP rejections remain useful even when a proxy returns HTML/text.
    }
    final code = envelope?['code'] is int ? envelope!['code'] as int : null;
    final message = envelope?['message'] is String
        ? envelope!['message'] as String
        : null;
    final httpFailed = status < 200 || status >= 300;
    if (httpFailed || (code != null && code != 0)) {
      // HTTP and business codes are preserved independently; HTTP failures are
      // authoritative when a backend/proxy sends inconsistent codes.
      final kind = _rejectionKind(httpFailed ? status : code!);
      if (kind == ApiErrorKind.unauthorized && authenticated) {
        await _session.unauthorized(requestGeneration);
      }
      throw ApiError(
        message: message?.trim().isNotEmpty == true
            ? message!
            : _fallbackMessage(kind),
        httpStatus: status,
        code: code,
        kind: kind,
        uncertainWrite: isWrite && kind == ApiErrorKind.server,
      );
    }
    if (code != 0 || message == null || !envelope!.containsKey('data')) {
      throw ApiError(
        message: '服务器返回的数据格式有误，请稍后重试',
        httpStatus: status,
        code: code,
        kind: ApiErrorKind.protocol,
        uncertainWrite: isWrite,
      );
    }
    return envelope['data'];
  }

  static ApiErrorKind _rejectionKind(int code) => switch (code) {
    401 => ApiErrorKind.unauthorized,
    403 => ApiErrorKind.forbidden,
    422 => ApiErrorKind.validation,
    409 => ApiErrorKind.conflict,
    >= 500 && < 600 => ApiErrorKind.server,
    _ => ApiErrorKind.business,
  };

  static String _fallbackMessage(ApiErrorKind kind) => switch (kind) {
    ApiErrorKind.unauthorized => '登录已失效，请重新登录',
    ApiErrorKind.forbidden => '没有执行此操作的权限',
    ApiErrorKind.validation => '提交的数据未通过校验',
    ApiErrorKind.conflict => '数据已变化，请刷新后重试',
    ApiErrorKind.server => '服务器暂时无法完成请求',
    _ => '请求未能完成',
  };

  void close() => _transport.close();
}
