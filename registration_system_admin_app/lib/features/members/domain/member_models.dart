import '../../teams/domain/team.dart';
export '../../teams/domain/team.dart';

class MemberManagement {
  MemberManagement({required this.team, required List<Member> members})
    : members = List.unmodifiable(members);
  final Team team;
  final List<Member> members;
}

class Member {
  const Member({
    required this.id,
    required this.userId,
    required this.nickname,
    required this.role,
    required this.status,
    required this.joinedAt,
    required this.balanceCents,
    required this.isPaidMember,
    this.avatarUrl,
    this.realName,
    this.phoneNumber,
    this.lastRechargeAt,
  });

  /// Membership-row ID. Never use this as a player/profile/fund route key.
  final int id;

  /// User ID used by Go member routes, captain assignment and fund scopes.
  final int userId;
  final int balanceCents;
  final String nickname, role, status;
  final String? avatarUrl, realName, phoneNumber;
  final DateTime joinedAt;
  final DateTime? lastRechargeAt;
  final bool isPaidMember;
  String get displayName =>
      realName?.trim().isNotEmpty == true ? realName! : nickname;
  static const assignableRoles = ['leader', 'vice_captain', 'member'];
  static const statuses = ['active', 'inactive', 'left'];
  bool get known =>
      (assignableRoles.contains(role) || role == 'captain') &&
      statuses.contains(status);
}

class MemberCandidate {
  const MemberCandidate({
    required this.userId,
    required this.nickname,
    this.avatarUrl,
    this.realName,
    this.phoneNumber,
  });
  final int userId;
  final String nickname;
  final String? avatarUrl, realName, phoneNumber;
  String get displayName =>
      realName?.trim().isNotEmpty == true ? realName! : nickname;
}

class PlayerProfile {
  const PlayerProfile({
    required this.id,
    required this.nickname,
    required this.status,
    this.avatarUrl,
    this.realName,
    this.phoneNumber,
  });
  final int id;
  final String nickname, status;
  final String? avatarUrl, realName, phoneNumber;
}
