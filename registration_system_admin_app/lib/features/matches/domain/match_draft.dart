import '../../../core/time/beijing_time.dart';
import 'match_models.dart';

/// Editable wall-clock values. Original carries fields PATCH cannot change.
/// Null registration timestamps explicitly clear a previous value; unchanged
/// timestamps are omitted by the data mapper. Empty colors clear; null preserves.
class MatchDraft {
  MatchDraft({
    this.name = '',
    this.publicationMode = 'online_individual',
    this.hostTeamId,
    this.opponentName,
    this.playersPerTeam = 5,
    this.hostCapacityLimit,
    this.startTime,
    this.durationMinutes = 120,
    this.registrationStartAt,
    this.registrationEndAt,
    this.location = '',
    this.locationLatitude,
    this.locationLongitude,
    this.description,
    this.hostColor,
    this.awayColor,
    this.isFree = false,
    this.original,
  });
  factory MatchDraft.fromDetail(MatchDetail detail) {
    final m = detail.match;
    return MatchDraft(
      name: m.name,
      publicationMode: m.publicationMode,
      hostTeamId: m.hostTeamId,
      opponentName: m.opponentName,
      playersPerTeam: m.playersPerTeam,
      hostCapacityLimit: detail.hostCapacityLimit,
      startTime: BeijingClock.fromInstant(m.startTime),
      durationMinutes: m.endTime.difference(m.startTime).inMinutes,
      registrationStartAt: m.registrationStartAt == null
          ? null
          : BeijingClock.fromInstant(m.registrationStartAt!),
      registrationEndAt: m.registrationEndAt == null
          ? null
          : BeijingClock.fromInstant(m.registrationEndAt!),
      location: m.location,
      locationLatitude: m.locationLatitude,
      locationLongitude: m.locationLongitude,
      description: m.description,
      hostColor: m.hostColor,
      awayColor: m.awayColor,
      isFree: m.isFree,
      original: detail,
    );
  }
  final MatchDetail? original;
  String name, publicationMode, location;
  int? hostTeamId, hostCapacityLimit;
  String? opponentName, description, hostColor, awayColor;
  int playersPerTeam, durationMinutes;
  BeijingClock? startTime, registrationStartAt, registrationEndAt;
  double? locationLatitude, locationLongitude;
  bool isFree;
  bool get isEditing => original != null;
  DateTime? get endTime {
    final start = startTime?.toUtc();
    if (start == null) return null;
    final prior = original?.match;
    // Preserve seconds/subseconds of legacy duration when the field is untouched.
    final duration =
        prior != null &&
            durationMinutes ==
                prior.endTime.difference(prior.startTime).inMinutes
        ? prior.endTime.difference(prior.startTime)
        : Duration(minutes: durationMinutes);
    return start.add(duration);
  }

  Map<String, String> validate() {
    final errors = <String, String>{};
    void length(String field, String? value, int limit) {
      if ((value?.runes.length ?? 0) > limit) errors[field] = '不能超过 $limit 个字符';
    }

    if (name.trim().isEmpty) errors['name'] = '请输入比赛名称';
    if (location.trim().isEmpty) errors['location'] = '请输入比赛场地';
    length('name', name.trim(), 255);
    length('location', location.trim(), 255);
    length('opponent_name', opponentName, 255);
    length('description', description, 1000);
    final prior = original?.match;
    if (prior == null) {
      if (!const [
        'offline_confirmed',
        'online_team',
        'online_individual',
      ].contains(publicationMode)) {
        errors['publication_mode'] = '请选择支持的发布模式';
      }
      if (hostTeamId == null || hostTeamId! <= 0) {
        errors['host_team_id'] = '请选择主队';
      }
      if (playersPerTeam < 1 || playersPerTeam > 30) {
        errors['players_per_team'] = '每队人数须为 1 到 30';
      }
    } else {
      if (!prior.canEdit) errors['status'] = '当前比赛不能编辑，请刷新详情';
      if (publicationMode != prior.publicationMode) {
        errors['publication_mode'] = '不能修改发布模式';
      }
      if (hostTeamId != prior.hostTeamId) errors['host_team_id'] = '不能修改主队';
      if (playersPerTeam != prior.playersPerTeam) {
        errors['players_per_team'] = '不能修改每队人数';
      }
      if (isFree != prior.isFree) errors['is_free'] = '不能修改收费设置';
    }
    final opponent = isEditing && opponentName == null
        ? prior!.opponentName
        : opponentName;
    if (publicationMode == 'offline_confirmed' &&
        (opponent?.trim().isEmpty ?? true)) {
      errors['opponent_name'] = '请输入线下对手名称';
    }
    if (publicationMode != 'offline_confirmed' &&
        opponent?.trim().isNotEmpty == true) {
      errors['opponent_name'] = '线上发布不能填写手工对手';
    }
    if (hostCapacityLimit != null &&
        (hostCapacityLimit! < 1 || hostCapacityLimit! > 100) &&
        (!isEditing || hostCapacityLimit != original!.hostCapacityLimit)) {
      errors['host_capacity_limit'] = '报名上限须为 1 到 100';
    }
    // PATCH capacity only updates an existing host_team registration group.
    // Pickup capacity belongs to individual_opponent and has no update contract.
    if (isEditing &&
        hostCapacityLimit != null &&
        !original!.groups.any((group) => group.kind == 'host_team')) {
      errors['host_capacity_limit'] = '当前比赛没有主队报名组，不能修改报名上限';
    }
    if (startTime == null) errors['start_time'] = '请选择开始时间';
    if ((durationMinutes < 30 || durationMinutes > 600) &&
        (prior == null ||
            durationMinutes !=
                prior.endTime.difference(prior.startTime).inMinutes)) {
      errors['duration_minutes'] = '时长须为 30 到 600 分钟';
    }
    if (registrationStartAt != null &&
        registrationEndAt != null &&
        !registrationEndAt!.toUtc().isAfter(registrationStartAt!.toUtc())) {
      errors['registration_end_at'] = '报名截止时间必须晚于开始时间';
    }
    if ((locationLatitude == null) != (locationLongitude == null)) {
      errors[locationLatitude == null
              ? 'location_latitude'
              : 'location_longitude'] =
          '经纬度须同时填写';
    }
    if (locationLatitude != null &&
        (!locationLatitude!.isFinite ||
            locationLatitude! < -90 ||
            locationLatitude! > 90)) {
      errors['location_latitude'] = '纬度范围为 -90 到 90';
    }
    if (locationLongitude != null &&
        (!locationLongitude!.isFinite ||
            locationLongitude! < -180 ||
            locationLongitude! > 180)) {
      errors['location_longitude'] = '经度范围为 -180 到 180';
    }
    for (final entry in {
      'host_color': hostColor,
      'away_color': awayColor,
    }.entries) {
      final color = entry.value?.trim();
      if (color != null &&
          color.isNotEmpty &&
          !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(color)) {
        errors[entry.key] = '颜色格式须为 #RRGGBB';
      }
    }
    return errors;
  }
}
