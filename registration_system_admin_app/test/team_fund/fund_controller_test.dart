import 'dart:async';
import 'package:registration_system_admin_app/core/state/resource_changes.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/features/team_fund/application/fund_controller.dart';
import 'package:registration_system_admin_app/features/team_fund/data/secure_pending_fund_store.dart';
import 'package:registration_system_admin_app/features/team_fund/domain/fund_models.dart';
import 'fixtures.dart';

void main() {
  test('persistence failure sends zero requests', () async {
    final storage = MemorySecureStore()..failWrite = true, r = FakeFunds();
    final c = FundController(
      scope: scope,
      repository: r,
      store: SecurePendingFundStore(storage),
    );
    await c.submit(draft);
    expect(r.calls, isEmpty);
    expect(c.phase, FundPhase.error);
    c.dispose();
  });
  test(
    'pending timeout restart explicit retry retains exact key/payload',
    () async {
      final s = SecurePendingFundStore(MemorySecureStore()),
          r = FakeFunds()
            ..failure = const ApiError(
              message: 'timeout',
              kind: ApiErrorKind.timeout,
              uncertainWrite: true,
            );
      final c = FundController(scope: scope, repository: r, store: s);
      await c.submit(draft);
      final original = c.pending!;
      expect(
        original.key,
        matches(
          RegExp(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
          ),
        ),
      );
      expect(c.phase, FundPhase.pending);
      c.dispose();
      final restored = FundController(scope: scope, repository: r, store: s);
      await restored.restore();
      expect(r.calls.length, 1);
      await restored.submit(
        const FundDraft(action: FundAction.credit, amountCents: 100),
      );
      expect(r.calls.length, 1);
      r.failure = null;
      await restored.retryPending();
      expect(r.calls.last.key, original.key);
      expect(r.calls.last.draft, draft);
      expect(restored.phase, FundPhase.confirmed);
      expect(restored.result!.duplicated, true);
      expect(await s.read(scope), isNull);
      restored.dispose();
    },
  );
  test('401 500 409 and malformed success retain original pending', () async {
    for (final kind in [
      ApiErrorKind.unauthorized,
      ApiErrorKind.server,
      ApiErrorKind.conflict,
      ApiErrorKind.protocol,
    ]) {
      final s = SecurePendingFundStore(MemorySecureStore()),
          r = FakeFunds()..failure = ApiError(message: 'failure', kind: kind);
      final c = FundController(scope: scope, repository: r, store: s);
      await c.submit(draft);
      final original = c.pending!;
      await c.retryPending();
      expect(r.calls.length, 2);
      expect(r.calls.last.key, original.key);
      expect((await s.read(scope))!.draft, draft);
      c.dispose();
    }
  });
  test(
    'double click dispatches once and cleanup failure retries original',
    () async {
      final storage = MemorySecureStore()..failDelete = true,
          r = FakeFunds()..executeGate = Completer<FundResult>();
      final s = SecurePendingFundStore(storage),
          c = FundController(
            scope: scope,
            repository: r,
            store: SecurePendingFundStore(storage),
          );
      final first = c.submit(draft);
      await Future<void>.delayed(Duration.zero);
      await c.submit(draft);
      expect(r.calls.length, 1);
      r.executeGate!.complete(
        const FundResult(balanceCents: 0, transactionId: 99, duplicated: false),
      );
      await first;
      expect(c.pending, isNotNull);
      expect(c.result!.transactionId, 99);
      storage.failDelete = false;
      r.executeGate = null;
      await c.retryPending();
      expect(r.calls.last.key, r.calls.first.key);
      expect(await s.read(scope), isNull);
      c.dispose();
    },
  );
  test(
    'dispose or account change while persisting prevents HTTP, preserves old record',
    () async {
      for (final dispose in [true, false]) {
        var current = true;
        final storage = MemorySecureStore()..writeGate = Completer<void>(),
            r = FakeFunds();
        final s = SecurePendingFundStore(storage),
            c = FundController(
              scope: scope,
              repository: r,
              store: SecurePendingFundStore(storage),
              isCurrent: () => current,
            );
        final write = c.submit(draft);
        await Future<void>.delayed(Duration.zero);
        if (dispose) {
          c.dispose();
        } else {
          current = false;
        }
        storage.writeGate!.complete();
        await write;
        expect(r.calls, isEmpty);
        expect(await s.read(scope), isNotNull);
        if (!dispose) c.dispose();
      }
    },
  );
  test(
    'controller cleanup recovery cannot overwrite or erase newer pending',
    () async {
      final storage = MemorySecureStore()
        ..partialDelete = true
        ..failDelete = true;
      final s = SecurePendingFundStore(storage), r = FakeFunds();
      final old = FundController(scope: scope, repository: r, store: s);
      await old.submit(draft);
      final oldKey = old.pending!.key;
      storage.failDelete = false;
      final newer = action(key: 'newer');
      await s.save(newer);
      await old.retryPending();
      expect(r.calls.length, 1);
      expect(old.pending!.key, oldKey);
      expect((await s.read(scope))!.key, 'newer');
      old.dispose();
    },
  );
  test(
    'restore failure locks UI; other admin cannot restore original action',
    () async {
      final storage = MemorySecureStore(),
          r = FakeFunds(),
          s = SecurePendingFundStore(MemorySecureStore());
      await s.save(action());
      final other = FundController(
        scope: FundScope(scope.environment, 2, 42, 7),
        repository: r,
        store: s,
      );
      await other.restore();
      expect(other.pending, isNull);
      expect(r.calls, isEmpty);
      storage.failRead = true;
      final c = FundController(
        scope: scope,
        repository: r,
        store: SecurePendingFundStore(storage),
      );
      await c.restore();
      expect(c.ready, false);
      await c.submit(draft);
      expect(r.calls, isEmpty);
      other.dispose();
      c.dispose();
    },
  );
  test(
    'write success plus read failure retries GET only with authoritative balance',
    () async {
      final r = FakeFunds()..readFailure = StateError('read failed');
      final c = FundController(
        scope: scope,
        repository: r,
        store: SecurePendingFundStore(MemorySecureStore()),
      );
      await c.submit(draft);
      expect(c.phase, FundPhase.confirmed);
      expect(c.result!.balanceCents, -120);
      expect(c.transactionsError, isNotNull);
      r.readFailure = null;
      await c.refreshTransactions();
      expect(r.calls.length, 1);
      expect(r.cursors, [0, 0]);
      c.dispose();
    },
  );
  test(
    'cursor advances by minimum id with duplicate rows and stale refresh suppression',
    () async {
      final r = FakeFunds(),
          c = FundController(
            scope: scope,
            repository: r,
            store: SecurePendingFundStore(MemorySecureStore()),
          );
      r.pages.add([for (var i = 60; i > 30; i--) transaction(i)]);
      await c.refreshTransactions();
      r.pages.add([
        transaction(31),
        transaction(30),
        transaction(30),
        transaction(29),
      ]);
      await c.loadMoreTransactions();
      expect(r.cursors, [0, 31]);
      expect(c.transactions.length, 32);
      expect(c.transactions.last.id, 29);
      expect(c.hasMoreTransactions, false);
      final old = Completer<List<FundTransaction>>(),
          fresh = Completer<List<FundTransaction>>();
      r.readGates.addAll([old, fresh]);
      final a = c.refreshTransactions(), b = c.refreshTransactions();
      fresh.complete([transaction(101)]);
      await b;
      old.complete([transaction(100)]);
      await a;
      expect(c.transactions.single.id, 101);
      c.dispose();
    },
  );
  test(
    'disposed network responses emit neither notifications nor resources',
    () async {
      final changes = ResourceChanges(), events = <ResourceChange>[];
      final subscription = changes.stream.listen(events.add);
      final r = FakeFunds()..executeGate = Completer<FundResult>(),
          storage = MemorySecureStore();
      final c = FundController(
        scope: scope,
        repository: r,
        store: SecurePendingFundStore(storage),
        changes: changes,
      );
      var notifications = 0;
      c.addListener(() => notifications++);
      final write = c.submit(draft);
      await Future<void>.delayed(Duration.zero);
      c.dispose();
      final before = notifications;
      r.executeGate!.complete(
        const FundResult(balanceCents: 0, transactionId: 99, duplicated: false),
      );
      await write;
      expect(notifications, before);
      expect(events, isEmpty);
      expect(storage.values, isNotEmpty);
      await subscription.cancel();
      changes.dispose();
    },
  );
  test(
    'account changes during secure read and original retry save send no HTTP',
    () async {
      var current = true;
      final storage = MemorySecureStore()..readGate = Completer<void>(),
          r = FakeFunds();
      final s = SecurePendingFundStore(storage),
          c = FundController(
            scope: scope,
            repository: r,
            store: s,
            isCurrent: () => current,
          );
      final write = c.submit(draft);
      current = false;
      storage.readGate!.complete();
      await write;
      expect(r.calls, isEmpty);
      expect(storage.values, isEmpty);
      c.dispose();
      current = true;
      storage.readGate = null;
      await s.save(action());
      final restored = FundController(
        scope: scope,
        repository: r,
        store: s,
        isCurrent: () => current,
      );
      await restored.restore();
      storage.readGate = Completer<void>();
      final retry = restored.retryPending();
      current = false;
      storage.readGate!.complete();
      await retry;
      expect(r.calls, isEmpty);
      expect(storage.values, isNotEmpty);
      restored.dispose();
    },
  );
  test(
    'partial persistence error sends zero requests locks edits then restores original',
    () async {
      final storage = MemorySecureStore()
            ..partialWrite = true
            ..failWrite = true,
          r = FakeFunds(),
          s = SecurePendingFundStore(MemorySecureStore());
      final shared = SecurePendingFundStore(storage),
          c = FundController(
            scope: scope,
            repository: r,
            store: SecurePendingFundStore(storage),
          );
      await c.submit(draft);
      expect(r.calls, isEmpty);
      expect(c.ready, false);
      final saved = (await shared.read(scope))!;
      storage.failWrite = false;
      await c.restore();
      expect(c.pending!.key, saved.key);
      expect(c.pending!.draft, draft);
      await c.retryPending();
      expect(r.calls.single.key, saved.key);
      expect(c.pending, isNull);
      expect(await s.read(scope), isNull);
      c.dispose();
    },
  );
  test(
    'newest read balance replaces service snapshot without deriving arithmetic',
    () async {
      final r = FakeFunds(),
          c = FundController(
            scope: scope,
            repository: r,
            store: SecurePendingFundStore(MemorySecureStore()),
          );
      await c.submit(draft);
      expect(c.balanceCents, -120);
      r.pages.add([transaction(101)]);
      await c.refreshTransactions();
      expect(c.balanceCents, 2900);
      expect(c.result!.balanceCents, -120);
      c.dispose();
    },
  );
  test(
    'busy-start pre-write GET cannot overwrite confirmed balance during cleanup',
    () async {
      final storage = MemorySecureStore()
        ..deleteGate = Completer<void>()
        ..deleteStarted = Completer<void>();
      final store = SecurePendingFundStore(storage),
          r = FakeFunds()..executeGate = Completer<FundResult>();
      await store.save(action());
      final c = FundController(scope: scope, repository: r, store: store);
      await c.restore();
      final retry = c.retryPending();
      await Future<void>.delayed(Duration.zero);
      expect(r.calls.length, 1);
      final oldRead = Completer<List<FundTransaction>>();
      r.readGates.add(oldRead);
      final read = c.refreshTransactions();
      expect(r.cursors, [0]);
      r.executeGate!.complete(
        const FundResult(
          balanceCents: 12400,
          transactionId: 99,
          duplicated: false,
        ),
      );
      await storage.deleteStarted!.future;
      expect(c.balanceCents, 12400);
      oldRead.complete([
        transaction(1),
      ]); // snapshot taken before POST committed
      await read;
      expect(c.balanceCents, 12400);
      r.readFailure = StateError('post-cleanup GET failed');
      storage.deleteGate!.complete();
      await retry;
      expect(c.phase, FundPhase.confirmed);
      expect(c.result!.balanceCents, 12400);
      expect(c.balanceCents, 12400);
      expect(c.transactionsError, isNotNull);
      expect(c.pending, isNull);
      expect(r.calls.length, 1);
      expect(r.calls.single.key, 'original');
      expect(r.cursors, [0, 0]);
      c.dispose();
    },
  );
}
