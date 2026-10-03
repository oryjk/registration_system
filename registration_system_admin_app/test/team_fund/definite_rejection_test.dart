import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:registration_system_admin_app/core/network/api_client.dart';
import 'package:registration_system_admin_app/core/network/session_access.dart';
import 'package:registration_system_admin_app/features/team_fund/application/fund_controller.dart';
import 'package:registration_system_admin_app/features/team_fund/data/http_fund_repository.dart';
import 'package:registration_system_admin_app/features/team_fund/data/secure_pending_fund_store.dart';
import 'package:registration_system_admin_app/features/team_fund/domain/fund_models.dart';
import 'fixtures.dart';

class NoSession implements SessionAccess {
  @override
  String? get token => null;
  @override
  int get generation => 0;
  @override
  Future<void> unauthorized(int generation) async {}
}

const valid = FundDraft(action: FundAction.credit, amountCents: 100);
http.Response response(int status, String body) => http.Response(
  body,
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

class ReplaceBeforeCleanup extends SecurePendingFundStore {
  ReplaceBeforeCleanup(super.storage);
  String? removedKey;
  @override
  Future<void> remove(FundScope target, {String? expectedKey}) async {
    removedKey = expectedKey;
    await super.remove(target);
    await save(action(key: 'new-key', value: valid));
    await super.remove(target, expectedKey: expectedKey);
  }
}

void main() {
  test(
    '422 expected-key cleanup cannot remove a different newer action',
    () async {
      final store = ReplaceBeforeCleanup(MemorySecureStore());
      final api = ApiClient(
        baseUrl: scope.environment,
        transport: MockClient(
          (_) async =>
              response(422, '{"code":422,"message":"rejected","data":null}'),
        ),
        session: NoSession(),
      );
      final c = FundController(
        scope: scope,
        repository: HttpFundRepository(api),
        store: store,
      );
      await c.restore();
      await c.submit(valid);
      expect(store.removedKey, c.pending!.key);
      expect(store.removedKey, isNot('new-key'));
      expect((await store.read(scope))!.key, 'new-key');
      expect(c.ready, isFalse);
      c.dispose();
      api.close();
    },
  );
  test(
    'new future receipt is rejected before persistence or HTTP, correction can proceed',
    () async {
      final store = SecurePendingFundStore(MemorySecureStore());
      var calls = 0;
      final api = ApiClient(
        baseUrl: scope.environment,
        transport: MockClient((_) async {
          calls++;
          return response(422, '{"code":422,"message":"rejected","data":null}');
        }),
        session: NoSession(),
      );
      final c = FundController(
        scope: scope,
        repository: HttpFundRepository(api),
        store: store,
        now: () => DateTime.utc(2026, 10, 2, 16, 1),
      );
      await c.restore();
      await c.submit(
        const FundDraft(
          action: FundAction.credit,
          amountCents: 100,
          receivedOn: '2026-10-04',
        ),
      );
      expect(c.fieldErrors['date'], contains('不能晚于今天'));
      expect(calls, 0);
      expect(await store.read(scope), isNull);
      expect(c.ready, isTrue);
      await c.submit(
        const FundDraft(
          action: FundAction.credit,
          amountCents: 100,
          receivedOn: '2026-10-03',
        ),
      );
      expect(calls, 1);
      expect(c.ready, isTrue);
      c.dispose();
      api.close();
    },
  );
  test(
    'legacy future receipt remains readable then clears on actual authoritative rejection',
    () async {
      final store = SecurePendingFundStore(MemorySecureStore());
      await store.save(
        action(
          value: const FundDraft(
            action: FundAction.credit,
            amountCents: 100,
            receivedOn: '9999-12-31',
          ),
        ),
      );
      var calls = 0;
      final api = ApiClient(
        baseUrl: scope.environment,
        transport: MockClient((_) async {
          calls++;
          return response(
            422,
            '{"code":422,"message":"收款日期不能晚于今天","data":null}',
          );
        }),
        session: NoSession(),
      );
      final c = FundController(
        scope: scope,
        repository: HttpFundRepository(api),
        store: store,
      );
      await c.restore();
      expect(c.pending, isNotNull);
      await c.retryPending();
      expect(calls, 1);
      expect(c.pending, isNull);
      expect(await store.read(scope), isNull);
      expect(c.ready, isTrue);
      c.dispose();
      api.close();
    },
  );
  for (final retry in [false, true]) {
    for (final failCleanup in [false, true]) {
      test(
        'authoritative 422 retry=$retry cleanup failure=$failCleanup',
        () async {
          final storage = MemorySecureStore()..failDelete = failCleanup;
          final store = SecurePendingFundStore(storage);
          final api = ApiClient(
            baseUrl: scope.environment,
            transport: MockClient(
              (_) async => response(
                422,
                '{"code":422,"message":"该用户不是该球队的正式成员","data":null}',
              ),
            ),
            session: NoSession(),
          );
          final c = FundController(
            scope: scope,
            repository: HttpFundRepository(api),
            store: store,
          );
          if (retry) await store.save(action(value: valid));
          await c.restore();
          if (retry) {
            await c.retryPending();
          } else {
            await c.submit(valid);
          }
          if (failCleanup) {
            expect(c.pending, isNotNull);
            expect(c.ready, isFalse);
            expect((await store.read(scope))!.key, c.pending!.key);
            storage.failDelete = false;
            await c.retryPending();
          }
          expect(c.pending, isNull);
          expect(await store.read(scope), isNull);
          expect(c.ready, isTrue);
          expect(c.error.toString(), contains('正式成员'));
          c.dispose();
          api.close();
        },
      );
    }
  }
  final cases = <String, (int, String)>{
    '401': (401, '{"code":401,"message":"expired","data":null}'),
    '5xx': (503, '{"code":503,"message":"down","data":null}'),
    'malformed success': (200, '{"code":0,"message":"ok","data":{}}'),
    '409': (409, '{"code":409,"message":"conflicting key","data":null}'),
    'malformed 422': (422, 'not-json'),
    'inconsistent 422': (422, '{"code":0,"message":"ok","data":null}'),
    'business-only 422': (200, '{"code":422,"message":"rejected","data":null}'),
  };
  for (final entry in cases.entries) {
    test(
      '${entry.key} retains original key and payload on submit and retry',
      () async {
        final store = SecurePendingFundStore(MemorySecureStore());
        final api = ApiClient(
          baseUrl: scope.environment,
          transport: MockClient(
            (_) async => response(entry.value.$1, entry.value.$2),
          ),
          session: NoSession(),
        );
        final c = FundController(
          scope: scope,
          repository: HttpFundRepository(api),
          store: store,
        );
        await c.restore();
        await c.submit(valid);
        final key = c.pending!.key;
        await c.retryPending();
        expect(c.pending!.key, key);
        expect(c.pending!.draft, valid);
        expect((await store.read(scope))!.key, key);
        expect(c.ready, isFalse);
        c.dispose();
        api.close();
      },
    );
  }
  for (final timeout in [false, true]) {
    test('timeout=$timeout retains original pending', () async {
      final store = SecurePendingFundStore(MemorySecureStore());
      final api = ApiClient(
        baseUrl: scope.environment,
        timeout: const Duration(milliseconds: 1),
        transport: MockClient((_) async {
          if (timeout) {
            await Future<void>.delayed(const Duration(milliseconds: 10));
            return response(200, '{}');
          }
          throw http.ClientException('offline');
        }),
        session: NoSession(),
      );
      final c = FundController(
        scope: scope,
        repository: HttpFundRepository(api),
        store: store,
      );
      await c.restore();
      await c.submit(valid);
      final key = c.pending!.key;
      await c.retryPending();
      expect(c.pending!.key, key);
      expect(c.pending!.draft, valid);
      expect((await store.read(scope))!.key, key);
      c.dispose();
      api.close();
    });
  }
}
