import 'dart:async';
import 'package:registration_system_admin_app/features/matches/data/match_response_mapper.dart';
import 'package:registration_system_admin_app/features/matches/domain/match_repository.dart';

Map<String, Object?> matchJson({
  String id = 'match-1',
  String status = 'registering',
  String mode = 'online_individual',
}) => {
  'id': id,
  'name': '测试比赛',
  'publication_mode': mode,
  'opponent_state': 'recruiting',
  'status': status,
  'host_team_id': mode == 'online_pickup' ? null : 12,
  'host_team_name': '测试球队',
  'away_team_id': null,
  'away_team_name': null,
  'opponent_name': null,
  'players_per_team': 5,
  'host_score': null,
  'away_score': null,
  'start_time': '2026-10-04T01:30:15.123456Z',
  'end_time': '2026-10-04T03:30:15.123456Z',
  'registration_start_at': '2026-10-03T01:00:00Z',
  'registration_end_at': '2026-10-04T01:00:00Z',
  'location': '测试球场',
  'location_latitude': 31.2,
  'location_longitude': 121.5,
  'description': '原说明',
  'host_color': '#abcdef',
  'away_color': null,
  'is_free': false,
  'payment_mode': 'prepaid',
  'fee_per_person_cents': 500,
  'fee_type': 'fixed_amount',
  'created_by_user_id': null,
  'created_by_admin_id': 3,
  'created_at': '2026-10-02T00:00:00Z',
  'updated_at': '2026-10-02T00:00:00Z',
};
Map<String, Object?> detailJson({
  String id = 'match-1',
  String status = 'registering',
  String mode = 'online_individual',
}) => {
  'match': matchJson(id: id, status: status, mode: mode),
  'groups': [
    {
      'id': 'group-1',
      'kind': 'host_team',
      'team_id': 12,
      'min_players': null,
      'max_players': 8,
      'status': 'open',
      'registrations': [
        {
          'user_id': 7,
          'nickname': '测试队员',
          'real_name': null,
          'avatar_url': null,
          'member_role': null,
          'status': 'future_status',
          'registration_count': 3,
          'paid': true,
        },
      ],
    },
  ],
};
MatchDetail detail({
  String id = 'match-1',
  String status = 'registering',
  String mode = 'online_individual',
}) =>
    MatchResponseMapper.detail(detailJson(id: id, status: status, mode: mode));
MatchPage page(int n, List<String> ids, {int total = 40}) => MatchPage(
  items: ids.map((id) => detail(id: id).match).toList(),
  total: total,
  page: n,
  pageSize: 20,
);

class PendingList {
  PendingList(this.query);
  final MatchQuery query;
  final result = Completer<MatchPage>();
}

class FakeMatchRepository implements MatchRepository {
  final lists = <PendingList>[];
  final reads = <Completer<MatchDetail>>[];
  final writes = <Completer<MatchDetail>>[];
  final deletes = <Completer<void>>[];
  final commands = <String>[];
  @override
  Future<MatchPage> list(MatchQuery query) {
    final p = PendingList(query);
    lists.add(p);
    return p.result.future;
  }

  @override
  Future<MatchDetail> get(String id) {
    final p = Completer<MatchDetail>();
    reads.add(p);
    return p.future;
  }

  Future<MatchDetail> write(String kind) {
    commands.add(kind);
    final p = Completer<MatchDetail>();
    writes.add(p);
    return p.future;
  }

  @override
  Future<MatchDetail> create(MatchDraft draft) => write('create');
  @override
  Future<MatchDetail> update(String id, MatchDraft draft) =>
      write('update:$id');
  @override
  Future<MatchDetail> setStatus(String id, String status) =>
      write('status:$status');
  @override
  Future<MatchDetail> setScore(String id, int host, int away) =>
      write('score:$host:$away');
  @override
  Future<void> delete(String id) {
    commands.add('delete:$id');
    final p = Completer<void>();
    deletes.add(p);
    return p.future;
  }
}
