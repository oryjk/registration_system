import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/core/state/resource_changes.dart';
import 'package:registration_system_admin_app/features/members/application/member_controller.dart';
import 'package:registration_system_admin_app/features/members/domain/member_models.dart';
import 'fixtures.dart';

const candidate = MemberCandidate(userId: 8, nickname: '候选');
void main() {
  test(
    'out of order candidate searches and disposed responses ignored',
    () async {
      final r = FakeMembers(),
          c = MemberController(repository: FakeMembers(), teamId: 42);
      c.dispose();
      final active = MemberController(repository: r, teamId: 42);
      final first = active.searchCandidates('old'),
          second = active.searchCandidates('new');
      r.searches['new']!.complete([candidate]);
      await second;
      r.searches['old']!.complete([
        const MemberCandidate(userId: 9, nickname: '旧'),
      ]);
      await first;
      expect(active.candidateState.data!.single.userId, 8);
      final last = active.searchCandidates('disposed');
      active.dispose();
      r.searches['disposed']!.complete([]);
      await last;
    },
  );
  test('only current candidates and ordinary roles can add', () async {
    final r = FakeMembers();
    final c = MemberController(repository: r, teamId: 42);
    await c.load();
    await c.addCandidate(candidate, 'member');
    expect(r.writes, 0);
    final search = c.searchCandidates('候选');
    r.searches['候选']!.complete([candidate]);
    await search;
    await c.addCandidate(candidate, 'captain');
    expect(r.writes, 0);
    await c.addCandidate(candidate, 'member');
    expect(r.writes, 1);
    expect(c.writeSucceeded, isTrue);
    c.dispose();
  });
  test(
    'captain ordinary edit removal and non-active assignment blocked',
    () async {
      final r = FakeMembers()
        ..value = management(
          captainId: 7,
          members: [
            member(role: 'captain'),
            member(userId: 8, status: 'inactive'),
            member(userId: 9, role: 'future'),
          ],
        );
      final c = MemberController(repository: r, teamId: 42);
      await c.load();
      expect(c.canEdit(r.value.members.first), isFalse);
      await c.updateMember(r.value.members.first, 'member', 'active');
      await c.removeMember(r.value.members.first);
      await c.assignCaptain(8);
      await c.assignCaptain(9);
      await c.assignCaptain(999);
      expect(r.writes, 0);
      await c.assignCaptain(null);
      expect(r.writes, 1);
      c.dispose();
    },
  );
  test(
    'success read failure retained and remove emits three resources',
    () async {
      final r = FakeMembers();
      final changes = ResourceChanges();
      final events = <ResourceKind>[];
      final sub = changes.stream.listen((e) => events.add(e.kind));
      final c = MemberController(repository: r, teamId: 42, changes: changes);
      await c.load();
      r.readError = Exception('刷新失败');
      await c.removeMember(r.value.members.first);
      await Future<void>.delayed(Duration.zero);
      expect(c.writeSucceeded, isTrue);
      expect(c.writeError, isNull);
      expect(c.state.error, isNotNull);
      expect(c.state.data, isNotNull);
      expect(
        events,
        containsAll([
          ResourceKind.teams,
          ResourceKind.members,
          ResourceKind.matches,
        ]),
      );
      expect(r.writes, 1);
      await c.load();
      expect(r.writes, 1);
      c.dispose();
      await sub.cancel();
      changes.dispose();
    },
  );
  test('profile validation and partial success remain separate', () async {
    final r = FakeMembers();
    final c = MemberController(repository: r, teamId: 42);
    await c.load();
    await c.saveProfile(r.value.members.first, '😀' * 121, null);
    expect(r.profiles, 0);
    expect(c.fieldErrors, contains('realName'));
    await c.saveProfile(r.value.members.first, '姓名', null);
    expect(c.writeSucceeded, isTrue);
    expect(c.writeAction, MemberWriteAction.profile);
    r.writeError = const ApiError(message: '角色拒绝', kind: ApiErrorKind.conflict);
    await c.updateMember(r.value.members.first, 'leader', 'active');
    expect(c.writeSucceeded, isFalse);
    expect(c.writeAction, MemberWriteAction.update);
    expect(r.profiles, 1);
    expect(
      c.results[MemberWriteAction.profile]!.outcome,
      MemberWriteOutcome.succeeded,
    );
    c.dispose();
  });
  test('uncertain write locks mutations without retries', () async {
    final r = FakeMembers();
    final c = MemberController(repository: r, teamId: 42);
    await c.load();
    r.writeError = const ApiError(
      message: '响应丢失',
      kind: ApiErrorKind.server,
      uncertainWrite: true,
    );
    await c.setPaid(r.value.members.first, true);
    expect(c.writeOutcomeUncertain, isTrue);
    await c.setPaid(r.value.members.first, true);
    expect(r.writes, 1);
    await c.load();
    expect(c.writeOutcomeUncertain, isTrue);
    c.dispose();
  });
  test(
    'disposed pending writes do not emit resources or notify listeners',
    () async {
      final r = FakeMembers();
      final changes = ResourceChanges();
      final events = <ResourceKind>[];
      final sub = changes.stream.listen((e) => events.add(e.kind));
      final c = MemberController(repository: r, teamId: 42, changes: changes);
      await c.load();
      r.pending = Completer<MemberManagement>();
      final write = c.setPaid(r.value.members.first, true);
      c.dispose();
      r.pending!.complete(r.value);
      await write;
      await Future<void>.delayed(Duration.zero);
      expect(events, isEmpty);
      await sub.cancel();
      changes.dispose();
    },
  );
  test('unknown team member and missing read disable mutations', () async {
    final r = FakeMembers()..value = management(status: 'future');
    final c = MemberController(repository: r, teamId: 42);
    await c.load();
    await c.setPaid(r.value.members.first, true);
    expect(r.writes, 0);
    r.value = management(members: [member(role: 'future')]);
    await c.load();
    await c.saveProfile(r.value.members.first, 'a', 'b');
    expect(r.profiles, 0);
    r.readError = const ApiError(
      message: '球队不存在',
      kind: ApiErrorKind.business,
      httpStatus: 404,
    );
    await c.load();
    expect(c.state.data, isNull);
    expect(c.missing, isTrue);
    c.dispose();
  });
  test(
    'verified applied uncertainty becomes success without another write',
    () async {
      final r = FakeMembers();
      final c = MemberController(repository: r, teamId: 42);
      await c.load();
      r.writeError = const ApiError(
        message: '响应丢失',
        kind: ApiErrorKind.server,
        uncertainWrite: true,
      );
      await c.setPaid(r.value.members.first, true);
      c.acknowledgeOutcomeChecked(applied: true);
      expect(c.writeSucceeded, isTrue);
      expect(c.writeOutcomeUncertain, isFalse);
      expect(r.writes, 1);
      c.dispose();
    },
  );
  test(
    'unknown role or status and missing current captain cannot revoke',
    () async {
      for (final members in [
        [member(role: 'future')],
        [member(role: 'captain', status: 'future')],
        <Member>[],
      ]) {
        final r = FakeMembers()
          ..value = management(captainId: 7, members: members);
        final c = MemberController(repository: r, teamId: 42);
        await c.load();
        await c.assignCaptain(null);
        expect(
          r.writes,
          0,
          reason: 'unknown or missing actual captain must not mutate',
        );
        c.dispose();
      }
    },
  );
  test(
    'known inactive or left captain can revoke and uses user lookup',
    () async {
      for (final status in ['active', 'inactive', 'left']) {
        final captain = member(role: 'captain', status: status);
        expect(captain.id, 1);
        expect(captain.userId, 7);
        final r = FakeMembers()
          ..value = management(captainId: 7, members: [captain]);
        final c = MemberController(repository: r, teamId: 42);
        await c.load();
        expect(c.memberById(7), same(captain));
        expect(c.memberById(1), isNull);
        await c.assignCaptain(null);
        expect(r.writes, 1);
        expect(c.writeSucceeded, isTrue);
        c.dispose();
      }
    },
  );
  test('member update sends user id rather than membership row id', () async {
    final r = FakeMembers();
    final c = MemberController(repository: r, teamId: 42);
    await c.load();
    await c.updateMember(r.value.members.single, 'leader', 'active');
    expect(r.lastWriteUserId, 7);
    expect(r.writes, 1);
    c.dispose();
  });
}
