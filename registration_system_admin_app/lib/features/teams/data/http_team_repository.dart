import '../../../core/network/api_client.dart';
import '../../../core/network/json_value.dart';
import '../domain/team_repository.dart';
import 'team_payload_mapper.dart';
import 'team_response_mapper.dart';

class HttpTeamRepository implements TeamRepository {
  HttpTeamRepository(this._api);
  final ApiClient _api;
  @override
  Future<List<Team>> list({String? status}) async => TeamResponseMapper.list(
    await _api.request(
      'GET',
      '/teams',
      query: {if (status?.isNotEmpty == true) 'status': status!},
    ),
  );
  @override
  Future<Team> get(int id) async =>
      TeamResponseMapper.fromJson(await _api.request('GET', '/teams/$id'));
  Future<Team> _write(String method, String path, TeamDraft draft) async =>
      JsonValue.decode(
        await _api.request(method, path, body: TeamPayloadMapper.toJson(draft)),
        TeamResponseMapper.fromJson,
        uncertainWrite: true,
      );
  @override
  Future<Team> create(TeamDraft draft) => _write(
    'POST',
    '/teams',
    TeamDraft(name: draft.name, description: draft.description),
  );
  @override
  Future<Team> update(int id, TeamDraft draft) =>
      _write('PATCH', '/teams/$id', draft);
  @override
  Future<void> delete(int id) async {
    await _api.request('DELETE', '/teams/$id');
  }

  @override
  Future<void> setJoinPassword(int id, String password) async {
    await _api.request(
      'PUT',
      '/teams/$id/join-password',
      body: {'join_password': password},
    );
  }
}
