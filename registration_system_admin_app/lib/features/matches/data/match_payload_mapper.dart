import '../domain/match_draft.dart';

abstract final class MatchPayloadMapper {
  static Map<String, Object?> _base(MatchDraft d) => {
    'name': d.name.trim(), 'start_time': d.startTime!.toUtc().toIso8601String(),
    'end_time': d.endTime!.toIso8601String(), 'location': d.location.trim(),
    // Backend replaces these pointers even when omitted. Carry original values.
    'location_latitude': d.locationLatitude,
    'location_longitude': d.locationLongitude,
    'description': d.description,
  };
  static Map<String, Object?> createJson(MatchDraft d) => {
    ..._base(d),
    'publication_mode': d.publicationMode,
    if (d.hostTeamId != null) 'host_team_id': d.hostTeamId,
    'players_per_team': d.playersPerTeam,
    if (d.hostCapacityLimit != null) 'host_capacity_limit': d.hostCapacityLimit,
    'opponent_name': d.opponentName?.trim(),
    'registration_start_at': d.registrationStartAt?.toUtc().toIso8601String(),
    'registration_end_at': d.registrationEndAt?.toUtc().toIso8601String(),
    'host_color': d.hostColor?.trim().toLowerCase(),
    'away_color': d.awayColor?.trim().toLowerCase(),
    'is_free': d.isFree,
  };
  static Map<String, Object?> updateJson(MatchDraft d) {
    final original = d.original;
    if (original == null) {
      throw ArgumentError('Editing requires original detail');
    }
    final m = original.match;
    final j = _base(d);
    final start = d.registrationStartAt?.toUtc();
    final end = d.registrationEndAt?.toUtc();
    if (start != m.registrationStartAt) {
      j['registration_start_at'] = start?.toIso8601String();
    }
    if (end != m.registrationEndAt) {
      j['registration_end_at'] = end?.toIso8601String();
    }
    if (d.opponentName != null && d.opponentName != m.opponentName) {
      j['opponent_name'] = d.opponentName!.trim();
    }
    if (d.hostCapacityLimit != null &&
        d.hostCapacityLimit != original.hostCapacityLimit) {
      j['host_capacity_limit'] = d.hostCapacityLimit;
    }
    if (d.hostColor != null && d.hostColor != m.hostColor) {
      j['host_color'] = d.hostColor!.trim().toLowerCase();
    }
    if (d.awayColor != null && d.awayColor != m.awayColor) {
      j['away_color'] = d.awayColor!.trim().toLowerCase();
    }
    return j;
  }
}
