import 'team.dart';
import 'team_draft.dart';
export 'team.dart';
export 'team_draft.dart';

abstract interface class TeamRepository {
  Future<List<Team>> list({String? status});
  Future<Team> get(int id);
  Future<Team> create(TeamDraft draft);
  Future<Team> update(int id, TeamDraft draft);
  Future<void> delete(int id);
  Future<void> setJoinPassword(int id, String password);
}
