import '../../../core/network/api_client.dart';
import '../../../core/network/api_error.dart';
import '../../../core/network/json_value.dart';
import '../../../core/time/beijing_time.dart';
import '../domain/admin_session.dart';
import '../domain/session_repository.dart';

/// Go wire fields are mapped here; domain models contain no transport details.
class HttpSessionRepository implements SessionRepository {
  const HttpSessionRepository({required ApiClient client}) : _client = client;
  final ApiClient _client;

  @override
  Future<AdminSession> login(String username, String password) async {
    final data = await _client.request(
      'POST',
      '/auth/login',
      body: {'username': username, 'password': password},
      authenticated: false,
    );
    return JsonValue.decode(data, (value) {
      final json = JsonValue.object(value);
      final token = JsonValue.string(json['access_token']);
      if (token.trim().isEmpty) {
        throw const ApiError(
          message: '登录响应缺少有效凭证',
          kind: ApiErrorKind.protocol,
        );
      }
      return AdminSession(accessToken: token, admin: _admin(json['admin']));
    });
  }

  @override
  Future<AdminUser> current() async =>
      JsonValue.decode(await _client.request('GET', '/auth/me'), _admin);

  static AdminUser _admin(Object? value) {
    final json = JsonValue.object(value);
    return AdminUser(
      id: JsonValue.integer(json['id']),
      username: JsonValue.string(json['username']),
      role: JsonValue.string(json['role']),
      status: JsonValue.string(json['status']),
      isSuperAdmin: JsonValue.boolean(json['is_super_admin']),
      createdAt: BeijingTime.parseInstant(JsonValue.string(json['created_at'])),
    );
  }
}
