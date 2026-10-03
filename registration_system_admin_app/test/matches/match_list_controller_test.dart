import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/features/matches/application/match_list_controller.dart';
import 'package:registration_system_admin_app/features/matches/application/match_detail_controller.dart';
import 'fixtures.dart';

void main() {
  test(
    'older filter response cannot replace latest query and pagination resets',
    () async {
      final r = FakeMatchRepository();
      final c = MatchListController(repository: r);
      final old = c.refresh();
      final current = c.setFilter(search: 'new', status: 'ongoing');
      expect(r.lists.last.query.page, 1);
      r.lists.last.result.complete(page(1, ['new']));
      await current;
      r.lists.first.result.complete(page(1, ['old']));
      await old;
      expect(c.state.data!.items.single.id, 'new');
      expect(c.query.search, 'new');
      final clear = c.setFilter(status: '');
      expect(c.query.status, isNull);
      expect(c.state.data, isNull);
      r.lists.last.result.complete(page(1, []));
      await clear;
      c.dispose();
    },
  );
  test(
    'loadMore locked deduplicates pages and failed refresh retains data',
    () async {
      final r = FakeMatchRepository();
      final c = MatchListController(repository: r);
      final first = c.refresh();
      r.lists.single.result.complete(page(1, ['1', '2']));
      await first;
      final more = c.loadMore();
      await c.loadMore();
      expect(r.lists.length, 2);
      expect(r.lists.last.query.page, 2);
      r.lists.last.result.complete(page(2, ['2', '3']));
      await more;
      expect(c.state.data!.items.map((x) => x.id), ['1', '2', '3']);
      final refresh = c.refresh();
      expect(c.state.refreshing, isTrue);
      r.lists.last.result.completeError(Exception('offline'));
      await refresh;
      expect(c.state.data!.items.length, 3);
      expect(c.state.error, isNotNull);
      c.dispose();
    },
  );
  test(
    'refresh invalidates loadMore and dispose suppresses responses',
    () async {
      final r = FakeMatchRepository();
      final c = MatchListController(repository: r);
      final first = c.refresh();
      r.lists.last.result.complete(page(1, ['1']));
      await first;
      final more = c.loadMore();
      final refresh = c.refresh();
      r.lists.last.result.complete(page(1, ['fresh']));
      await refresh;
      r.lists[1].result.complete(page(2, ['old-more']));
      await more;
      expect(c.state.data!.items.single.id, 'fresh');
      final disposed = c.refresh();
      c.dispose();
      r.lists.last.result.complete(page(1, ['disposed']));
      await disposed;
      expect(c.state.data!.items.single.id, 'fresh');
    },
  );
  test(
    'detail returned write data persists when later refresh fails',
    () async {
      final r = FakeMatchRepository();
      final c = MatchDetailController(repository: r, id: 'match-1');
      final load = c.load();
      r.reads.single.complete(detail());
      await load;
      final write = c.changeStatus('ongoing');
      await c.changeStatus('cancelled');
      expect(r.commands, ['status:ongoing']);
      r.writes.single.complete(detail(status: 'ongoing'));
      await write;
      expect(c.writeSucceeded, isTrue);
      expect(c.state.data!.match.status, 'ongoing');
      expect(r.reads.length, 1);
      final refresh = c.load();
      r.reads.last.completeError(Exception('offline'));
      await refresh;
      expect(c.writeSucceeded, isTrue);
      expect(c.state.data!.match.status, 'ongoing');
      expect(c.state.error, isNotNull);
      expect(c.writeError, isNull);
      c.dispose();
    },
  );
  test('unknown values never allow edit score status or delete', () async {
    final r = FakeMatchRepository();
    final c = MatchDetailController(repository: r, id: 'match-1');
    final load = c.load();
    r.reads.single.complete(detail(status: 'future'));
    await load;
    expect(c.state.data!.match.statusLabel, contains('future'));
    expect(c.state.data!.match.canEdit, isFalse);
    await c.changeStatus('ongoing');
    await c.saveScore(0, 0);
    await c.delete();
    expect(r.commands, isEmpty);
    c.dispose();
  });
  test(
    'score includes zero and prevents invalid values uncertain writes lock',
    () async {
      final r = FakeMatchRepository();
      final c = MatchDetailController(repository: r, id: 'match-1');
      final load = c.load();
      r.reads.single.complete(detail(status: 'ongoing'));
      await load;
      await c.saveScore(-1, 2);
      await c.saveScore(0, 1000);
      expect(r.commands, isEmpty);
      final write = c.saveScore(0, 0);
      r.writes.single.completeError(
        const ApiError(
          message: 'network',
          kind: ApiErrorKind.network,
          uncertainWrite: true,
        ),
      );
      await write;
      expect(c.writeOutcomeUncertain, isTrue);
      await c.saveScore(0, 0);
      expect(r.commands, ['score:0:0']);
      final check = c.load();
      r.reads.last.complete(detail(status: 'ongoing'));
      await check;
      expect(c.writeOutcomeUncertain, isFalse);
      c.dispose();
    },
  );
  test(
    'detail old read cannot overwrite mutation and disposal prevents update',
    () async {
      final r = FakeMatchRepository();
      final c = MatchDetailController(repository: r, id: 'match-1');
      final load = c.load();
      r.reads.single.complete(detail());
      await load;
      final old = c.load();
      final write = c.changeStatus('ongoing');
      r.writes.single.complete(detail(status: 'ongoing'));
      await write;
      r.reads.last.complete(detail());
      await old;
      expect(c.state.data!.match.status, 'ongoing');
      final score = c.saveScore(1, 2);
      c.dispose();
      r.writes.last.complete(detail(status: 'ended'));
      await score;
      expect(c.state.data!.match.status, 'ongoing');
    },
  );
  test('delete requires super-admin and locks repeated deletion', () async {
    final r = FakeMatchRepository();
    final denied = MatchDetailController(repository: r, id: 'match-1');
    final load = denied.load();
    r.reads.single.complete(detail());
    await load;
    await denied.delete();
    expect(r.commands, isEmpty);
    denied.dispose();
    final c = MatchDetailController(
      repository: r,
      id: 'match-1',
      isSuperAdmin: true,
    );
    final read = c.load();
    r.reads.last.complete(detail());
    await read;
    final removal = c.delete();
    await c.delete();
    expect(r.commands, ['delete:match-1']);
    r.deletes.single.complete();
    await removal;
    expect(c.deleted, isTrue);
    expect(c.writeSucceeded, isTrue);
    await c.delete();
    await c.load();
    expect(r.commands.length, 1);
    expect(r.reads.length, 2);
    c.dispose();
  });
  test(
    'only an uncertain delete plus confirmed404 resolves as deleted',
    () async {
      final r = FakeMatchRepository();
      final c = MatchDetailController(
        repository: r,
        id: 'match-1',
        isSuperAdmin: true,
      );
      final read = c.load();
      r.reads.single.complete(detail());
      await read;
      final removal = c.delete();
      r.deletes.single.completeError(
        const ApiError(
          message: 'offline',
          kind: ApiErrorKind.network,
          uncertainWrite: true,
        ),
      );
      await removal;
      final check = c.load();
      r.reads.last.completeError(
        const ApiError(
          message: 'missing',
          kind: ApiErrorKind.business,
          httpStatus: 404,
          code: 404,
        ),
      );
      await check;
      expect(c.deleted, isTrue);
      expect(c.writeSucceeded, isTrue);
      expect(c.writeOutcomeUncertain, isFalse);
      expect(c.writeError, isNull);
      c.dispose();
      final ordinary = MatchDetailController(
        repository: r,
        id: 'match-1',
        isSuperAdmin: true,
      );
      final missing = ordinary.load();
      r.reads.last.completeError(
        const ApiError(
          message: 'missing',
          kind: ApiErrorKind.business,
          httpStatus: 404,
          code: 404,
        ),
      );
      await missing;
      expect(ordinary.deleted, isFalse);
      expect(ordinary.state.error, isA<ApiError>());
      expect(ordinary.writeSucceeded, isFalse);
      ordinary.dispose();
    },
  );
  test('twenty unique matches remain after overlapping pages', () async {
    final r = FakeMatchRepository();
    final c = MatchListController(repository: r);
    final first = c.refresh();
    r.lists.last.result.complete(
      page(1, List.generate(10, (i) => '${i + 1}'), total: 40),
    );
    await first;
    final more = c.loadMore();
    r.lists.last.result.complete(
      page(2, List.generate(11, (i) => '${i + 10}'), total: 40),
    );
    await more;
    expect(c.state.data!.items.map((x) => x.id).toSet().length, 20);
    expect(c.hasMore, isFalse);
    await c.loadMore();
    expect(r.lists.length, 2);
    c.dispose();
  });
}
