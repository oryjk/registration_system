import 'member_models.dart';
export 'member_models.dart';

abstract interface class MemberRepository {
  Future<MemberManagement> list(int teamId);
  Future<List<MemberCandidate>> candidates(int teamId, String search);
  Future<MemberManagement> add(int teamId, int userId, String role);
  Future<MemberManagement> update(
    int teamId,
    int userId,
    String role,
    String status,
  );
  Future<MemberManagement> remove(int teamId, int userId);
  Future<MemberManagement> setCaptain(int teamId, int? userId);
  Future<MemberManagement> setPaid(int teamId, int userId, bool paid);
  Future<PlayerProfile> updateProfile(
    int userId, {
    String? realName,
    String? phone,
  });
}
