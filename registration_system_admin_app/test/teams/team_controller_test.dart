import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/core/state/resource_changes.dart';
import 'package:registration_system_admin_app/features/teams/application/team_controller.dart';
import 'package:registration_system_admin_app/features/teams/domain/team_draft.dart';
import 'package:registration_system_admin_app/features/teams/domain/team.dart';
import 'fixtures.dart';
import 'fake_team_repository.dart';

const missing = ApiError(
  message: '球队不存在',
  kind: ApiErrorKind.business,
  httpStatus: 404,
  code: 404,
);
void main() {
  test('local name search and latest backend status filter win race', () async {
    final r = FakeTeamRepository();
    final c = TeamController(repository: r);
    final first = Completer<List<Team>>(), second = Completer<List<Team>>();
    final statuses = <String?>[];
    r.onList = (status) {
      statuses.add(status);
      return statuses.length == 1 ? first.future : second.future;
    };
    final a = c.refresh(status: 'active'), b = c.refresh(status: 'frozen');
    second.complete([
      team(name: '星河二队', status: 'frozen'),
      team(id: 3, name: '另一队', status: 'frozen'),
    ]);
    await b;
    first.complete([team(name: '旧队')]);
    await a;
    c.setSearch(' 星河 ');
    expect(c.filteredTeams.single.name, '星河二队');
    expect(statuses, ['active', 'frozen']);
    expect(c.status, 'frozen');
    c.dispose();
  });
  test(
    'save locks duplicate and reports success independently from failed refresh',
    () async {
      final r = FakeTeamRepository();
      final c = TeamController(repository: r);
      await c.refresh();
      final pending = Completer<Team>();
      r.onCreate = (_) => pending.future;
      final a = c.save(const TeamDraft(name: '新队'));
      await c.save(const TeamDraft(name: '重复'));
      expect(r.creates, 1);
      r.onList = (_) => Future.error(Exception('刷新失败'));
      pending.complete(team(id: 99, name: '新队'));
      await a;
      expect(c.writeSucceeded, isTrue);
      expect(c.savedTeam!.id, 99);
      expect(c.state.error, isNotNull);
      expect(c.state.data!.single.id, 42);
      c.dispose();
    },
  );
  test(
    'failed write keeps data, validation and unknown team block writes',
    () async {
      final r = FakeTeamRepository();
      final c = TeamController(repository: r);
      await c.load(42);
      r.onUpdate = (_, _) => Future.error(Exception('拒绝'));
      await c.save(const TeamDraft(name: '改名', status: 'active'), id: 42);
      expect(c.writeSucceeded, isFalse);
      expect(c.detailState.data!.name, '星河队');
      await c.save(const TeamDraft(name: ''), id: 42);
      expect(c.fieldErrors, contains('name'));
      expect(r.updates, 1);
      r.onGet = (_) async => team(status: 'future');
      await c.load(42);
      await c.delete(42);
      await c.setJoinPassword(42, '密码');
      expect(r.deletes, 0);
      expect(r.passwords, 0);
      c.dispose();
    },
  );
  test(
    '404 removes stale detail and explains deletion without claiming success',
    () async {
      final r = FakeTeamRepository();
      final c = TeamController(repository: r);
      await c.load(42);
      r.onDelete = (_) => Future.error(missing);
      await c.delete(42);
      expect(c.missing, isTrue);
      expect(c.detailState.data, isNull);
      expect(c.writeSucceeded, isFalse);
      expect(c.writeError, missing);
      c.dispose();
    },
  );
  test(
    'uncertain write never replays and disposal ignores async completions',
    () async {
      final r = FakeTeamRepository();
      final c = TeamController(repository: r);
      await c.load(42);
      r.onPassword = (_, _) => Future.error(
        const ApiError(
          message: '超时',
          kind: ApiErrorKind.timeout,
          uncertainWrite: true,
        ),
      );
      await c.setJoinPassword(42, '密码');
      await c.setJoinPassword(42, '再发');
      await c.load(42);
      await c.setJoinPassword(42, '再发');
      expect(r.passwords, 1);
      expect(c.writeOutcomeUncertain, isTrue);
      c.acknowledgeOutcomeChecked();
      await c.setJoinPassword(42, '');
      expect(r.passwords, 2);
      c.dispose();
      final d = TeamController(repository: r);
      final p = Completer<List<Team>>();
      r.onList = (_) => p.future;
      final f = d.refresh();
      d.dispose();
      p.complete([team()]);
      await f;
      expect(d.state.data, isNull);
    },
  );
  test(
    'team resource event refreshes current list/detail and subscription disposes',
    () async {
      final r = FakeTeamRepository();
      final changes = ResourceChanges();
      final c = TeamController(repository: r, changes: changes);
      await c.refresh();
      await c.load(42);
      r.items = [team(name: '成员变更后')];
      changes.emit(ResourceKind.teams, teamId: 42);
      await Future<void>.delayed(Duration.zero);
      expect(c.state.data!.single.name, '成员变更后');
      expect(c.detailState.data!.name, '成员变更后');
      c.dispose();
      final calls = r.lists;
      changes.emit(ResourceKind.teams);
      await Future<void>.delayed(Duration.zero);
      expect(r.lists, calls);
      changes.dispose();
    },
  );
}
