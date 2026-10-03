import '../../../core/network/api_client.dart';
import '../../../core/network/json_value.dart';
import '../domain/match_repository.dart';
import 'match_payload_mapper.dart';
import 'match_response_mapper.dart';

class HttpMatchRepository implements MatchRepository {
  HttpMatchRepository(this._api);
  final ApiClient _api;
  String _path(String id) => '/matches/${Uri.encodeComponent(id)}';
  @override
  Future<MatchPage> list(MatchQuery q) async => MatchResponseMapper.page(
    await _api.request(
      'GET',
      '/matches',
      query: {
        if (q.search.isNotEmpty) 'search': q.search,
        if (q.status?.isNotEmpty == true) 'status': q.status!,
        'page': '${q.page}',
        'page_size': '${q.pageSize}',
      },
    ),
  );
  @override
  Future<MatchDetail> get(String id) async =>
      MatchResponseMapper.detail(await _api.request('GET', _path(id)));
  Future<MatchDetail> _write(
    String method,
    String path,
    Map<String, Object?> body,
  ) async => JsonValue.decode(
    await _api.request(method, path, body: body),
    MatchResponseMapper.detail,
    uncertainWrite: true,
  );
  @override
  Future<MatchDetail> create(MatchDraft d) =>
      _write('POST', '/matches', MatchPayloadMapper.createJson(d));
  @override
  Future<MatchDetail> update(String id, MatchDraft d) =>
      _write('PATCH', _path(id), MatchPayloadMapper.updateJson(d));
  @override
  Future<MatchDetail> setStatus(String id, String status) =>
      _write('PATCH', '${_path(id)}/status', {'status': status});
  @override
  Future<MatchDetail> setScore(String id, int hostScore, int awayScore) =>
      _write('PATCH', '${_path(id)}/score', {
        'host_score': hostScore,
        'away_score': awayScore,
      });
  @override
  Future<void> delete(String id) async {
    await _api.request('DELETE', _path(id));
  }
}
