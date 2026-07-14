import 'dart:io';

import 'package:shared_preferences/shared_preferences.dart';

String get defaultAdminApiBaseUrl {
  return 'http://127.0.0.1:18080/api/admin';
}

class AdminSession {
  const AdminSession({
    required this.accessToken,
    required this.tokenType,
    required this.admin,
  });

  final String accessToken;
  final String tokenType;
  final AdminUser admin;

  factory AdminSession.fromJson(Map<String, dynamic> json) {
    return AdminSession(
      accessToken: json['access_token'] as String,
      tokenType: json['token_type'] as String? ?? 'Bearer',
      admin: AdminUser.fromJson(json['admin'] as Map<String, dynamic>),
    );
  }
}

class AdminUser {
  const AdminUser({
    required this.id,
    required this.username,
    required this.nickname,
    required this.status,
    required this.isSuperAdmin,
  });

  final int id;
  final String username;
  final String nickname;
  final int status;
  final bool isSuperAdmin;

  factory AdminUser.fromJson(Map<String, dynamic> json) {
    return AdminUser(
      id: json['id'] as int,
      username: json['username'] as String,
      nickname: json['nickname'] as String? ?? '',
      status: json['status'] as int? ?? 0,
      isSuperAdmin: json['is_super_admin'] as bool? ?? false,
    );
  }
}

class AdminSessionStore {
  static const _tokenKey = 'admin_access_token';
  static const _apiBaseUrlKey = 'admin_api_base_url';

  Future<String?> readToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  Future<String> readApiBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_apiBaseUrlKey);
    if (stored == null || stored.trim().isEmpty) {
      return defaultAdminApiBaseUrl;
    }
    return resolveStoredAdminApiBaseUrl(stored, isAndroid: Platform.isAndroid);
  }

  Future<void> saveApiBaseUrl(String baseUrl) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_apiBaseUrlKey, normalizeAdminApiBaseUrl(baseUrl));
  }

  Future<void> saveSession(AdminSession session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, session.accessToken);
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }
}

String resolveStoredAdminApiBaseUrl(String stored, {required bool isAndroid}) {
  final normalized = normalizeAdminApiBaseUrl(stored);
  if (isAndroid && normalized.startsWith('http://10.0.2.2:')) {
    return normalized.replaceFirst('http://10.0.2.2:', 'http://127.0.0.1:');
  }
  return normalized;
}

String normalizeAdminApiBaseUrl(String input) {
  var value = input.trim();
  if (value.isEmpty) {
    return defaultAdminApiBaseUrl;
  }
  while (value.endsWith('/')) {
    value = value.substring(0, value.length - 1);
  }
  if (value.endsWith('/api/admin')) {
    return value;
  }
  if (value.endsWith('/api')) {
    return '$value/admin';
  }
  return '$value/api/admin';
}
