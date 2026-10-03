/// Raw enum values survive new server versions; capabilities require known values.
class MatchItem {
  const MatchItem({
    required this.id,
    required this.name,
    required this.publicationMode,
    required this.opponentState,
    required this.status,
    required this.hostTeamId,
    required this.hostTeamName,
    required this.awayTeamId,
    required this.awayTeamName,
    required this.opponentName,
    required this.playersPerTeam,
    required this.hostScore,
    required this.awayScore,
    required this.startTime,
    required this.endTime,
    required this.registrationStartAt,
    required this.registrationEndAt,
    required this.location,
    required this.locationLatitude,
    required this.locationLongitude,
    required this.description,
    required this.hostColor,
    required this.awayColor,
    required this.isFree,
    required this.paymentMode,
    required this.feePerPersonCents,
    required this.feeType,
    required this.createdByUserId,
    required this.createdByAdminId,
    required this.createdAt,
    required this.updatedAt,
  });
  final String id,
      name,
      publicationMode,
      opponentState,
      status,
      hostTeamName,
      location,
      paymentMode;
  final int? hostTeamId,
      awayTeamId,
      hostScore,
      awayScore,
      createdByUserId,
      createdByAdminId;
  final String? awayTeamName,
      opponentName,
      description,
      hostColor,
      awayColor,
      feeType;
  final int playersPerTeam, feePerPersonCents;
  final DateTime startTime, endTime, createdAt, updatedAt;
  final DateTime? registrationStartAt, registrationEndAt;
  final double? locationLatitude, locationLongitude;
  final bool isFree;
  bool get hasKnownStatus =>
      const ['registering', 'ongoing', 'ended', 'cancelled'].contains(status);
  bool get hasKnownMode => const [
    'offline_confirmed',
    'online_team',
    'online_individual',
    'online_pickup',
  ].contains(publicationMode);
  bool get hasKnownOpponentState => const [
    'no_recruitment',
    'recruiting',
    'confirmed',
  ].contains(opponentState);
  bool get hasKnownRules =>
      hasKnownStatus &&
      hasKnownMode &&
      hasKnownOpponentState &&
      const ['postpaid', 'prepaid'].contains(paymentMode) &&
      (feeType == null ||
          feeType == '' ||
          const [
            'offline_aa',
            'free',
            'fixed_amount',
            'team_fund',
          ].contains(feeType));
  bool get canEdit =>
      hasKnownRules && (status == 'registering' || status == 'ongoing');
  bool get canRecordScore =>
      hasKnownRules && (status == 'ongoing' || status == 'ended');

  /// UI must additionally require super-admin permission and confirmation.
  bool get canDelete => hasKnownRules;
  List<String> get allowedNextStatuses => !hasKnownRules
      ? const []
      : switch (status) {
          'registering' => const ['ongoing', 'cancelled'],
          'ongoing' => const ['ended', 'cancelled'],
          _ => const [],
        };
  String get statusLabel => enumLabel(status, const {
    'registering': '报名中',
    'ongoing': '进行中',
    'ended': '已结束',
    'cancelled': '已取消',
  });
  String get publicationModeLabel => enumLabel(publicationMode, const {
    'offline_confirmed': '线下已约',
    'online_team': '线上约队',
    'online_individual': '散人对手',
    'online_pickup': '散人约球',
  });
  String get opponentStateLabel => enumLabel(opponentState, const {
    'no_recruitment': '无需招募',
    'recruiting': '招募中',
    'confirmed': '已确认',
  });
}

String enumLabel(String raw, Map<String, String> labels) =>
    labels[raw] ?? '未知（$raw）';

class RegistrationEntry {
  const RegistrationEntry({
    required this.userId,
    required this.nickname,
    required this.realName,
    required this.avatarUrl,
    required this.memberRole,
    required this.status,
    required this.registrationCount,
    required this.paid,
  });
  final int userId, registrationCount;
  final String nickname, status;
  final String? realName, avatarUrl, memberRole;
  final bool paid;
  String get statusLabel => enumLabel(status, const {
    'unknown': '未表态',
    'attending': '参赛',
    'leave': '请假',
    'absent': '缺席',
    'cancelled': '已取消',
    'unregistered': '未报名',
  });
}

class RegistrationGroup {
  RegistrationGroup({
    required this.id,
    required this.kind,
    required this.teamId,
    required this.minPlayers,
    required this.maxPlayers,
    required this.status,
    required List<RegistrationEntry> registrations,
  }) : registrations = List.unmodifiable(registrations);
  final String id, kind, status;
  final int? teamId, minPlayers, maxPlayers;
  final List<RegistrationEntry> registrations;
  String get kindLabel => enumLabel(kind, const {
    'host_team': '主队',
    'guest_team': '客队',
    'individual_opponent': '散人',
  });
  String get statusLabel => enumLabel(status, const {
    'open': '开放',
    'closed': '已满',
    'cancelled': '已取消',
  });
}

class MatchDetail {
  MatchDetail({required this.match, required List<RegistrationGroup> groups})
    : groups = List.unmodifiable(groups);
  final MatchItem match;
  final List<RegistrationGroup> groups;
  int? get hostCapacityLimit {
    for (final group in groups) {
      if (group.kind == 'host_team') return group.maxPlayers;
    }
    return null;
  }
}

class MatchPage {
  MatchPage({
    required List<MatchItem> items,
    required this.total,
    required this.page,
    required this.pageSize,
  }) : items = List.unmodifiable(items);
  final List<MatchItem> items;
  final int total, page, pageSize;
  bool get hasMore => page * pageSize < total;
}

class MatchQuery {
  const MatchQuery({
    this.search = '',
    this.status,
    this.page = 1,
    this.pageSize = 20,
  });
  final String search;
  final String? status;
  final int page, pageSize;
}
