import 'package:registration_system_admin_app/features/teams/domain/team_repository.dart';
import 'fixtures.dart';

class FakeTeamRepository implements TeamRepository {
  List<Team> items = [team()];
  Future<List<Team>> Function(String?)? onList;
  Future<Team> Function(int)? onGet;
  Future<Team> Function(TeamDraft)? onCreate;
  Future<Team> Function(int, TeamDraft)? onUpdate;
  Future<void> Function(int)? onDelete;
  Future<void> Function(int, String)? onPassword;
  int creates = 0, updates = 0, deletes = 0, passwords = 0, lists = 0;
  @override
  Future<List<Team>> list({String? status}) {
    lists++;
    return onList?.call(status) ??
        Future.value(
          items.where((t) => status == null || t.status == status).toList(),
        );
  }

  @override
  Future<Team> get(int id) =>
      onGet?.call(id) ?? Future.value(items.firstWhere((t) => t.id == id));
  @override
  Future<Team> create(TeamDraft draft) {
    creates++;
    return onCreate?.call(draft) ??
        Future.value(team(id: 99, name: draft.name));
  }

  @override
  Future<Team> update(int id, TeamDraft draft) {
    updates++;
    return onUpdate?.call(id, draft) ??
        Future.value(team(id: id, name: draft.name, status: draft.status!));
  }

  @override
  Future<void> delete(int id) {
    deletes++;
    return onDelete?.call(id) ?? Future.value();
  }

  @override
  Future<void> setJoinPassword(int id, String password) {
    passwords++;
    return onPassword?.call(id, password) ?? Future.value();
  }
}
