import '../../../core/network/api_client.dart';
import '../../../core/network/api_error.dart';
import '../../../core/network/json_value.dart';
import '../domain/member_repository.dart';
import '../domain/member_validation.dart';
import 'member_response_mapper.dart';

class HttpMemberRepository implements MemberRepository {
  HttpMemberRepository(this._api);
  final ApiClient _api;
  @override
  Future<MemberManagement> list(int teamId) async =>
      MemberResponseMapper.management(
        await _api.request('GET', '/teams/$teamId/members'),
      );
  @override
  Future<List<MemberCandidate>> candidates(int teamId, String search) async =>
      MemberResponseMapper.candidates(
        await _api.request(
          'GET',
          '/teams/$teamId/member-candidates',
          query: {'search': search.trim()},
        ),
      );
  Future<MemberManagement> _write(
    String method,
    String path, {
    Map<String, Object?>? body,
  }) async => JsonValue.decode(
    await _api.request(method, path, body: body),
    MemberResponseMapper.management,
    uncertainWrite: true,
  );
  void _role(String role) {
    if (!MemberValidation.role(role)) {
      throw const ApiError(
        message: '队长请通过任免操作指定',
        kind: ApiErrorKind.validation,
      );
    }
  }

  @override
  Future<MemberManagement> add(int teamId, int userId, String role) async {
    _role(role);
    return _write(
      'POST',
      '/teams/$teamId/members',
      body: {'user_id': userId, 'role': role},
    );
  }

  @override
  Future<MemberManagement> update(
    int teamId,
    int userId,
    String role,
    String status,
  ) async {
    _role(role);
    if (!MemberValidation.status(status)) {
      throw const ApiError(message: '成员状态无效', kind: ApiErrorKind.validation);
    }
    return _write(
      'PATCH',
      '/teams/$teamId/members/$userId',
      body: {'role': role, 'status': status},
    );
  }

  @override
  Future<MemberManagement> remove(int teamId, int userId) =>
      _write('DELETE', '/teams/$teamId/members/$userId');
  @override
  Future<MemberManagement> setCaptain(int teamId, int? userId) =>
      _write('PATCH', '/teams/$teamId/captain', body: {'user_id': userId});
  @override
  Future<MemberManagement> setPaid(int teamId, int userId, bool paid) => _write(
    'PUT',
    '/teams/$teamId/members/$userId/paid-membership',
    body: {'is_paid_member': paid},
  );
  @override
  Future<PlayerProfile> updateProfile(
    int userId, {
    String? realName,
    String? phone,
  }) async {
    final errors = MemberValidation.profile(realName, phone);
    if (errors.isNotEmpty) {
      throw ApiError(
        message: errors.values.first,
        kind: ApiErrorKind.validation,
      );
    }
    String? clean(String? value) =>
        value?.trim().isNotEmpty == true ? value!.trim() : null;
    return JsonValue.decode(
      await _api.request(
        'PATCH',
        '/users/$userId/profile',
        body: {'real_name': clean(realName), 'phone_number': clean(phone)},
      ),
      MemberResponseMapper.profile,
      uncertainWrite: true,
    );
  }
}
