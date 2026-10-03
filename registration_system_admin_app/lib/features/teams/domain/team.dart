/// The admin API omits memberCount outside the list; absence is not zero.
class Team {
  const Team({
    required this.id,
    required this.name,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.description,
    this.logoUrl,
    this.captainId,
    this.captain,
    this.memberCount,
  });
  final int id;
  final String name, status;
  final String? description, logoUrl;
  final int? captainId, memberCount;
  final TeamCaptain? captain;
  final DateTime createdAt, updatedAt;
  static const editableStatuses = ['active', 'frozen', 'dissolved'];
  bool get canManage => editableStatuses.contains(status);
  bool get isActive => status == 'active';
}

class TeamCaptain {
  const TeamCaptain({
    required this.userId,
    required this.nickname,
    this.avatarUrl,
    this.realName,
  });
  final int userId;
  final String nickname;
  final String? avatarUrl, realName;
}
