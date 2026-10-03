import '../../../core/network/json_value.dart';
import '../../../core/time/beijing_time.dart';
import '../domain/match_models.dart';

abstract final class MatchResponseMapper {
  static DateTime _time(Object? v) =>
      BeijingTime.parseInstant(JsonValue.string(v));
  static MatchItem item(Object? value) => JsonValue.decode(value, (v) {
    final j = JsonValue.object(v);
    return MatchItem(
      id: JsonValue.string(j['id']),
      name: JsonValue.string(j['name']),
      publicationMode: JsonValue.string(j['publication_mode']),
      opponentState: JsonValue.string(j['opponent_state']),
      status: JsonValue.string(j['status']),
      hostTeamId: JsonValue.nullable(j['host_team_id'], JsonValue.integer),
      hostTeamName: JsonValue.string(j['host_team_name']),
      awayTeamId: JsonValue.nullable(j['away_team_id'], JsonValue.integer),
      awayTeamName: JsonValue.nullable(j['away_team_name'], JsonValue.string),
      opponentName: JsonValue.nullable(j['opponent_name'], JsonValue.string),
      playersPerTeam: JsonValue.integer(j['players_per_team']),
      hostScore: JsonValue.nullable(j['host_score'], JsonValue.integer),
      awayScore: JsonValue.nullable(j['away_score'], JsonValue.integer),
      startTime: _time(j['start_time']),
      endTime: _time(j['end_time']),
      registrationStartAt: JsonValue.nullable(
        j['registration_start_at'],
        _time,
      ),
      registrationEndAt: JsonValue.nullable(j['registration_end_at'], _time),
      location: JsonValue.string(j['location']),
      locationLatitude: JsonValue.nullable(
        j['location_latitude'],
        (v) => JsonValue.number(v).toDouble(),
      ),
      locationLongitude: JsonValue.nullable(
        j['location_longitude'],
        (v) => JsonValue.number(v).toDouble(),
      ),
      description: JsonValue.nullable(j['description'], JsonValue.string),
      hostColor: JsonValue.nullable(j['host_color'], JsonValue.string),
      awayColor: JsonValue.nullable(j['away_color'], JsonValue.string),
      isFree: JsonValue.boolean(j['is_free']),
      paymentMode: JsonValue.string(j['payment_mode']),
      feePerPersonCents: JsonValue.integer(j['fee_per_person_cents']),
      feeType: JsonValue.nullable(j['fee_type'], JsonValue.string),
      createdByUserId: JsonValue.nullable(
        j['created_by_user_id'],
        JsonValue.integer,
      ),
      createdByAdminId: JsonValue.nullable(
        j['created_by_admin_id'],
        JsonValue.integer,
      ),
      createdAt: _time(j['created_at']),
      updatedAt: _time(j['updated_at']),
    );
  });
  static RegistrationEntry _entry(Object? value) {
    final j = JsonValue.object(value);
    return RegistrationEntry(
      userId: JsonValue.integer(j['user_id']),
      nickname: JsonValue.string(j['nickname']),
      realName: JsonValue.nullable(j['real_name'], JsonValue.string),
      avatarUrl: JsonValue.nullable(j['avatar_url'], JsonValue.string),
      memberRole: JsonValue.nullable(j['member_role'], JsonValue.string),
      status: JsonValue.string(j['status']),
      registrationCount: JsonValue.integer(j['registration_count']),
      paid: JsonValue.boolean(j['paid']),
    );
  }

  static RegistrationGroup _group(Object? value) {
    final j = JsonValue.object(value);
    return RegistrationGroup(
      id: JsonValue.string(j['id']),
      kind: JsonValue.string(j['kind']),
      teamId: JsonValue.nullable(j['team_id'], JsonValue.integer),
      minPlayers: JsonValue.nullable(j['min_players'], JsonValue.integer),
      maxPlayers: JsonValue.nullable(j['max_players'], JsonValue.integer),
      status: JsonValue.string(j['status']),
      registrations: JsonValue.array(j['registrations']).map(_entry).toList(),
    );
  }

  static MatchDetail detail(Object? value) => JsonValue.decode(value, (v) {
    final j = JsonValue.object(v);
    return MatchDetail(
      match: item(j['match']),
      groups: JsonValue.array(j['groups']).map(_group).toList(),
    );
  });
  static MatchPage page(Object? value) => JsonValue.decode(value, (v) {
    final j = JsonValue.object(v);
    final total = JsonValue.integer(j['total']);
    final page = JsonValue.integer(j['page']);
    final size = JsonValue.integer(j['page_size']);
    if (total < 0 || page < 1 || size < 1 || size > 100) {
      throw const FormatException('Invalid pagination');
    }
    return MatchPage(
      items: JsonValue.array(j['items']).map(item).toList(),
      total: total,
      page: page,
      pageSize: size,
    );
  });
}
