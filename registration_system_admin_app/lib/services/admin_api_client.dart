import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'admin_session.dart';

class AdminApiClient {
  AdminApiClient({
    required String baseUrl,
    String? accessToken,
    http.Client? client,
  }) : _baseUrl = normalizeAdminApiBaseUrl(baseUrl),
       _accessToken = accessToken,
       _client = client ?? http.Client();

  final String _baseUrl;
  final String? _accessToken;
  final http.Client _client;

  Future<AdminSession> login({
    required String username,
    required String password,
  }) async {
    final data = await _postJson(
      '/auth/login',
      body: {'username': username, 'password': password},
      authenticated: false,
    );
    return AdminSession.fromJson(data);
  }

  Future<Map<String, dynamic>> createActivity({
    required String name,
    required String location,
    required String holdingDate,
    required String startTime,
    required String endTime,
    required String matchKind,
    String? description,
    int? playersPerTeam,
  }) {
    final body = <String, dynamic>{
      'name': name,
      'location': location,
      'holding_date': holdingDate,
      'start_time': startTime,
      'end_time': endTime,
      'match_kind': matchKind,
    };
    _addIntValue(body, 'players_per_team', playersPerTeam);
    _addStringValue(body, 'description', description);
    return _postJson('/activities', body: body);
  }

  Future<Map<String, dynamic>> createTeam({
    required String name,
    String? description,
    String? joinPassword,
    int? captainId,
  }) {
    final body = <String, dynamic>{'name': name};
    _addIntValue(body, 'captain_id', captainId);
    _addStringValue(body, 'description', description);
    _addStringValue(body, 'join_password', joinPassword);
    return _postJson('/teams/admin', body: body);
  }

  Future<Map<String, dynamic>> _postJson(
    String path, {
    required Map<String, dynamic> body,
    bool authenticated = true,
  }) async {
    if (authenticated && (_accessToken == null || _accessToken.isEmpty)) {
      throw const AdminApiException('请先登录管理端账号');
    }

    late http.Response response;
    try {
      response = await _client.post(
        Uri.parse('$_baseUrl$path'),
        headers: _headers(authenticated: authenticated),
        body: jsonEncode(body),
      );
    } on SocketException catch (error) {
      throw AdminApiException('网络请求失败：${error.message}');
    } on http.ClientException catch (error) {
      throw AdminApiException('网络请求失败：${error.message}');
    } on FormatException catch (error) {
      throw AdminApiException('API 地址格式不正确：${error.message}');
    }
    return _decodeResponse(response);
  }

  Map<String, String> _headers({required bool authenticated}) {
    return {
      'Content-Type': 'application/json; charset=utf-8',
      if (authenticated && _accessToken != null && _accessToken.isNotEmpty)
        'Authorization': 'Bearer $_accessToken',
    };
  }

  Map<String, dynamic> _decodeResponse(http.Response response) {
    late final Object? decoded;
    try {
      decoded = jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      throw AdminApiException('接口响应不是合法 JSON', statusCode: response.statusCode);
    }
    if (decoded is! Map<String, dynamic>) {
      throw AdminApiException('接口响应格式不正确');
    }

    final success = decoded['success'] == true;
    final message = decoded['message'] as String? ?? '请求失败';
    if (response.statusCode < 200 || response.statusCode >= 300 || !success) {
      throw AdminApiException(message, statusCode: response.statusCode);
    }

    final data = decoded['data'];
    if (data is Map<String, dynamic>) {
      return data;
    }
    return <String, dynamic>{};
  }
}

void _addStringValue(Map<String, dynamic> body, String key, String? value) {
  final trimmed = value?.trim();
  if (trimmed != null && trimmed.isNotEmpty) {
    body[key] = trimmed;
  }
}

void _addIntValue(Map<String, dynamic> body, String key, int? value) {
  if (value != null) {
    body[key] = value;
  }
}

class AdminApiException implements Exception {
  const AdminApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}
