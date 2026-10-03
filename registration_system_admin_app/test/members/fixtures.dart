import 'dart:async';
import 'package:registration_system_admin_app/features/members/domain/member_repository.dart';
import '../teams/fixtures.dart' as teams;

Member member({
  int userId = 7,
  int? membershipId,
  String role = 'member',
  String status = 'active',
  bool paid = false,
  int balance = -150,
  String? name,
}) => Member(
  id: membershipId ?? (userId == 7 ? 1 : userId + 1000),
  userId: userId,
  nickname: '球员$userId',
  realName: name,
  role: role,
  status: status,
  joinedAt: DateTime.utc(2026, 10, 3),
  balanceCents: balance,
  isPaidMember: paid,
);
MemberManagement management({
  List<Member>? members,
  int? captainId,
  String status = 'active',
}) => MemberManagement(
  team: Team(
    id: 42,
    name: '星河队',
    status: status,
    captainId: captainId,
    createdAt: teams.team().createdAt,
    updatedAt: teams.team().updatedAt,
  ),
  members: members ?? [member()],
);

class FakeMembers implements MemberRepository {
  MemberManagement value = management();
  Object? readError, writeError;
  int reads = 0, writes = 0, profiles = 0;
  int? lastWriteUserId;
  final searches = <String, Completer<List<MemberCandidate>>>{};
  Completer<MemberManagement>? pending;
  @override
  Future<MemberManagement> list(int teamId) async {
    reads++;
    if (readError != null) throw readError!;
    return value;
  }

  @override
  Future<List<MemberCandidate>> candidates(int teamId, String search) =>
      (searches[search] = Completer()).future;
  Future<MemberManagement> write([int? userId]) async {
    lastWriteUserId = userId;
    writes++;
    if (writeError != null) throw writeError!;
    return pending?.future ?? value;
  }

  @override
  Future<MemberManagement> add(int teamId, int userId, String role) =>
      write(userId);
  @override
  Future<MemberManagement> update(
    int teamId,
    int userId,
    String role,
    String status,
  ) => write(userId);
  @override
  Future<MemberManagement> remove(int teamId, int userId) => write(userId);
  @override
  Future<MemberManagement> setCaptain(int teamId, int? userId) => write(userId);
  @override
  Future<MemberManagement> setPaid(int teamId, int userId, bool paid) =>
      write(userId);
  @override
  Future<PlayerProfile> updateProfile(
    int userId, {
    String? realName,
    String? phone,
  }) async {
    profiles++;
    if (writeError != null) throw writeError!;
    return PlayerProfile(
      id: userId,
      nickname: '球员$userId',
      status: 'active',
      realName: realName,
      phoneNumber: phone,
    );
  }
}
