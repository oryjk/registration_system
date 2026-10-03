import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/core/time/beijing_time.dart';
import 'package:registration_system_admin_app/features/matches/domain/match_draft.dart';
import 'package:registration_system_admin_app/features/matches/data/match_payload_mapper.dart';
import 'package:registration_system_admin_app/features/matches/application/match_form_controller.dart';
import 'fixtures.dart';

MatchDraft valid() => MatchDraft(
  name: '新比赛',
  hostTeamId: 12,
  startTime: BeijingClock(2026, 10, 4, 9, 30),
  location: '球场',
);
void main() {
  test('creation supports only approved modes and mode-required fields', () {
    final d = valid();
    expect(d.validate(), isEmpty);
    d.publicationMode = 'offline_confirmed';
    expect(d.validate(), contains('opponent_name'));
    d.opponentName = '对手';
    expect(d.validate(), isEmpty);
    d.publicationMode = 'online_team';
    expect(d.validate(), contains('opponent_name'));
    d.opponentName = null;
    d.hostTeamId = null;
    expect(d.validate(), contains('host_team_id'));
    d.hostTeamId = 12;
    for (final mode in ['online_pickup', 'future_mode']) {
      d.publicationMode = mode;
      expect(d.validate(), contains('publication_mode'));
    }
  });
  test('players capacities and duration validate inclusive boundaries', () {
    final d = valid();
    for (final value in [0, 31]) {
      d.playersPerTeam = value;
      expect(d.validate(), contains('players_per_team'));
    }
    for (final value in [1, 30]) {
      d.playersPerTeam = value;
      expect(d.validate(), isEmpty);
    }
    for (final value in [0, 101]) {
      d.hostCapacityLimit = value;
      expect(d.validate(), contains('host_capacity_limit'));
    }
    for (final value in [1, 100]) {
      d.hostCapacityLimit = value;
      expect(d.validate(), isEmpty);
    }
    for (final value in [29, 601]) {
      d.durationMinutes = value;
      expect(d.validate(), contains('duration_minutes'));
    }
    for (final value in [30, 600]) {
      d.durationMinutes = value;
      expect(d.validate(), isEmpty);
    }
  });
  test(
    'registration ordering coordinates colors and length use field errors',
    () {
      final d = valid()
        ..registrationStartAt = BeijingClock(2026, 10, 4, 8, 0)
        ..registrationEndAt = BeijingClock(2026, 10, 4, 8, 0);
      expect(d.validate(), contains('registration_end_at'));
      d.registrationEndAt = BeijingClock(2026, 10, 4, 9, 0);
      d.locationLatitude = 90;
      expect(d.validate(), contains('location_longitude'));
      d.locationLongitude = 180;
      expect(d.validate(), isEmpty);
      d.locationLatitude = double.nan;
      expect(d.validate(), contains('location_latitude'));
      d.locationLatitude = -91;
      d.locationLongitude = 181;
      expect(
        d.validate().keys,
        containsAll(['location_latitude', 'location_longitude']),
      );
      d.locationLatitude = null;
      d.locationLongitude = null;
      d.hostColor = '#12345';
      expect(d.validate(), contains('host_color'));
      d.hostColor = '';
      d.awayColor = '#ABCDEF';
      expect(d.validate(), isEmpty);
      d.name = ' ';
      d.location = ' ';
      d.description = '文' * 1001;
      expect(
        d.validate().keys,
        containsAll(['name', 'location', 'description']),
      );
    },
  );
  test(
    'create UTC and edit omission null and empty semantics preserve original',
    () {
      final json = MatchPayloadMapper.createJson(valid());
      expect(json['start_time'], '2026-10-04T01:30:00.000Z');
      expect(json['end_time'], '2026-10-04T03:30:00.000Z');
      final d = MatchDraft.fromDetail(detail());
      final untouched = MatchPayloadMapper.updateJson(d);
      expect(untouched.containsKey('publication_mode'), isFalse);
      expect(untouched.containsKey('host_team_id'), isFalse);
      expect(untouched.containsKey('payment_mode'), isFalse);
      expect(untouched.containsKey('fee_per_person_cents'), isFalse);
      expect(untouched.containsKey('registration_start_at'), isFalse);
      expect(untouched.containsKey('host_capacity_limit'), isFalse);
      expect(untouched['location_latitude'], 31.2);
      expect(untouched['location_longitude'], 121.5);
      expect(untouched['description'], '原说明');
      expect(untouched['start_time'], '2026-10-04T01:30:15.123456Z');
      d.hostColor = null;
      d.opponentName = null;
      d.hostCapacityLimit = null;
      final nullPreserves = MatchPayloadMapper.updateJson(d);
      expect(nullPreserves.containsKey('host_color'), isFalse);
      expect(nullPreserves.containsKey('opponent_name'), isFalse);
      expect(nullPreserves.containsKey('host_capacity_limit'), isFalse);
      d.registrationEndAt = null;
      d.hostColor = '';
      d.description = '';
      d.hostCapacityLimit = 10;
      final edited = MatchPayloadMapper.updateJson(d);
      expect(edited.containsKey('registration_end_at'), isTrue);
      expect(edited['registration_end_at'], isNull);
      expect(edited['host_color'], '');
      expect(edited['description'], '');
      expect(edited['host_capacity_limit'], 10);
      expect(d.original!.match.feePerPersonCents, 500);
    },
  );
  test(
    'existing pickup is editable but immutable identity cannot be changed',
    () {
      final d = MatchDraft.fromDetail(detail(mode: 'online_pickup'));
      expect(d.validate(), isEmpty);
      d.publicationMode = 'online_team';
      expect(d.validate(), contains('publication_mode'));
    },
  );
  test(
    'form invalid saves never send and duplicate saves are locked',
    () async {
      final repo = FakeMatchRepository();
      final c = MatchFormController(repository: repo);
      expect(await c.save(MatchDraft()), isNull);
      expect(c.fieldErrors, contains('name'));
      expect(repo.commands, isEmpty);
      final save = c.save(valid());
      expect(c.submitting, isTrue);
      expect(await c.save(valid()), isNull);
      expect(repo.commands, ['create']);
      repo.writes.single.complete(detail());
      expect(await save, isNotNull);
      expect(c.writeSucceeded, isTrue);
      expect(c.submitting, isFalse);
      expect(repo.reads, isEmpty);
      expect(await c.save(valid()), isNull);
      expect(repo.commands.length, 1);
      c.dispose();
    },
  );
  test(
    'uncertain form write retains error and requires explicit outcome check',
    () async {
      final repo = FakeMatchRepository();
      final c = MatchFormController(repository: repo);
      final save = c.save(valid());
      repo.writes.single.completeError(
        const ApiError(
          message: 'failed',
          kind: ApiErrorKind.server,
          uncertainWrite: true,
        ),
      );
      expect(await save, isNull);
      expect(c.writeOutcomeUncertain, isTrue);
      expect(await c.save(valid()), isNull);
      expect(repo.commands.length, 1);
      c.acknowledgeOutcomeChecked();
      final next = c.save(valid());
      repo.writes.last.complete(detail());
      expect(await next, isNotNull);
      c.dispose();
    },
  );
  test('disposed form result cannot publish success', () async {
    final repo = FakeMatchRepository();
    final c = MatchFormController(repository: repo);
    final save = c.save(valid());
    c.dispose();
    repo.writes.single.complete(detail());
    expect(await save, isNull);
    expect(c.writeSucceeded, isFalse);
  });
  test(
    'pickup with only individual group rejects unsupported capacity before sending',
    () async {
      final pickup = detail(mode: 'online_pickup');
      expect(pickup.groups.single.kind, 'individual_opponent');
      expect(pickup.groups.single.teamId, isNull);
      expect(pickup.hostCapacityLimit, isNull);
      final d = MatchDraft.fromDetail(pickup)..hostCapacityLimit = 12;
      expect(d.validate(), contains('host_capacity_limit'));
      final repo = FakeMatchRepository();
      final c = MatchFormController(repository: repo, id: pickup.match.id);
      expect(await c.save(d), isNull);
      expect(c.fieldErrors, contains('host_capacity_limit'));
      expect(repo.commands, isEmpty);
      expect(c.writeOutcomeUncertain, isFalse);
      c.dispose();
    },
  );
  test(
    'pickup mapper omits capacity even if unsupported draft bypasses validation',
    () {
      final d = MatchDraft.fromDetail(detail(mode: 'online_pickup'))
        ..hostCapacityLimit = 12;
      expect(
        MatchPayloadMapper.updateJson(d).containsKey('host_capacity_limit'),
        isFalse,
      );
    },
  );
  test(
    'pickup ordinary edits preserve individual limits and stay submitable',
    () async {
      final d = MatchDraft.fromDetail(detail(mode: 'online_pickup'))
        ..name = '更新散人比赛';
      expect(d.validate(), isEmpty);
      final payload = MatchPayloadMapper.updateJson(d);
      expect(payload['name'], '更新散人比赛');
      expect(payload.containsKey('host_capacity_limit'), isFalse);
      final repo = FakeMatchRepository();
      final c = MatchFormController(repository: repo, id: 'match-1');
      final save = c.save(d);
      expect(repo.commands, ['update:match-1']);
      repo.writes.single.complete(detail(mode: 'online_pickup'));
      expect(await save, isNotNull);
      expect(c.writeSucceeded, isTrue);
      expect(c.state.data!.groups.single.maxPlayers, 14);
      c.dispose();
    },
  );
}
