import '../../../core/network/json_value.dart';
import '../../../core/time/beijing_time.dart';
import '../../teams/data/team_response_mapper.dart';
import '../domain/member_models.dart';

abstract final class MemberResponseMapper {
  static MemberManagement management(Object? value) =>
      JsonValue.decode(value, (v) {
        final j = JsonValue.object(v);
        return MemberManagement(
          team: TeamResponseMapper.fromJson(j['team']),
          members: JsonValue.array(j['members']).map(member).toList(),
        );
      });
  static Member member(Object? value) => JsonValue.decode(value, (v) {
    final j = JsonValue.object(v);
    return Member(
      id: JsonValue.integer(j['id']),
      userId: JsonValue.integer(j['user_id']),
      nickname: JsonValue.string(j['nickname']),
      avatarUrl: JsonValue.nullable(j['avatar_url'], JsonValue.string),
      realName: JsonValue.nullable(j['real_name'], JsonValue.string),
      phoneNumber: JsonValue.nullable(j['phone_number'], JsonValue.string),
      role: JsonValue.string(j['role']),
      status: JsonValue.string(j['status']),
      joinedAt: BeijingTime.parseInstant(JsonValue.string(j['joined_at'])),
      balanceCents: JsonValue.integer(j['balance_cents']),
      isPaidMember: JsonValue.boolean(j['is_paid_member']),
      lastRechargeAt: JsonValue.nullable(
        j['last_recharge_at'],
        (v) => BeijingTime.parseInstant(JsonValue.string(v)),
      ),
    );
  });
  static List<MemberCandidate> candidates(Object? value) => JsonValue.decode(
    value,
    (v) => List.unmodifiable(
      JsonValue.array(v).map((v) {
        final j = JsonValue.object(v);
        return MemberCandidate(
          userId: JsonValue.integer(j['user_id']),
          nickname: JsonValue.string(j['nickname']),
          avatarUrl: JsonValue.nullable(j['avatar_url'], JsonValue.string),
          realName: JsonValue.nullable(j['real_name'], JsonValue.string),
          phoneNumber: JsonValue.nullable(j['phone_number'], JsonValue.string),
        );
      }),
    ),
  );
  static PlayerProfile profile(Object? value) => JsonValue.decode(value, (v) {
    final j = JsonValue.object(v);
    return PlayerProfile(
      id: JsonValue.integer(j['id']),
      nickname: JsonValue.string(j['nickname']),
      status: JsonValue.string(j['status']),
      avatarUrl: JsonValue.nullable(j['avatar_url'], JsonValue.string),
      realName: JsonValue.nullable(j['real_name'], JsonValue.string),
      phoneNumber: JsonValue.nullable(j['phone_number'], JsonValue.string),
    );
  });
}
