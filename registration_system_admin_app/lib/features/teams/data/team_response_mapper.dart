import '../../../core/network/json_value.dart';
import '../../../core/time/beijing_time.dart';
import '../domain/team.dart';

abstract final class TeamResponseMapper {
  static Team fromJson(Object? value) => JsonValue.decode(value, (value) {
    final j = JsonValue.object(value);
    return Team(
      id: JsonValue.integer(j['id']),
      name: JsonValue.string(j['name']),
      status: JsonValue.string(j['status']),
      description: JsonValue.nullable(j['description'], JsonValue.string),
      logoUrl: JsonValue.nullable(j['logo_url'], JsonValue.string),
      captainId: JsonValue.nullable(j['captain_id'], JsonValue.integer),
      memberCount: JsonValue.nullable(j['member_count'], JsonValue.integer),
      captain: JsonValue.nullable(j['captain'], (value) {
        final c = JsonValue.object(value);
        return TeamCaptain(
          userId: JsonValue.integer(c['user_id']),
          nickname: JsonValue.string(c['nickname']),
          avatarUrl: JsonValue.nullable(c['avatar_url'], JsonValue.string),
          realName: JsonValue.nullable(c['real_name'], JsonValue.string),
        );
      }),
      createdAt: BeijingTime.parseInstant(JsonValue.string(j['created_at'])),
      updatedAt: BeijingTime.parseInstant(JsonValue.string(j['updated_at'])),
    );
  });
  static List<Team> list(Object? value) => JsonValue.decode(
    value,
    (v) => List.unmodifiable(JsonValue.array(v).map(fromJson)),
  );
}
