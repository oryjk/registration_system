import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/features/team_fund/data/secure_pending_fund_store.dart';
import 'package:registration_system_admin_app/features/team_fund/domain/fund_models.dart';
import 'fixtures.dart';

void main() {
  test('schema1 strict roundtrip and environment/admin isolation', () async {
    final storage = MemorySecureStore(),
        store = SecurePendingFundStore(MemorySecureStore());
    final s = SecurePendingFundStore(storage);
    await s.save(action());
    expect((await s.read(scope))!.draft, draft);
    expect(storage.values.values.single, contains('"schema":1'));
    expect(await s.read(FundScope(scope.environment, 2, 42, 7)), isNull);
    expect(
      await s.read(FundScope(Uri.parse('https://else.test'), 1, 42, 7)),
      isNull,
    );
    storage.values.updateAll((_, _) => '{"schema":2}');
    await expectLater(s.read(scope), throwsA(isA<Object>()));
    expect(await store.read(scope), isNull);
  });
  test(
    'shared store serializes saves preserving first key and payload',
    () async {
      final s = SecurePendingFundStore(MemorySecureStore());
      final first = s.save(action());
      final second = s.save(action(key: 'new'));
      await first;
      await expectLater(second, throwsA(isA<StateError>()));
      expect((await s.read(scope))!.key, 'original');
      await expectLater(
        s.save(
          action(
            value: const FundDraft(action: FundAction.credit, amountCents: 100),
          ),
        ),
        throwsA(isA<StateError>()),
      );
    },
  );
  test(
    'partial delete error then new save cannot be deleted by old cleanup',
    () async {
      final storage = MemorySecureStore(), old = action();
      final s = SecurePendingFundStore(storage);
      await s.save(old);
      storage.failDelete = storage.partialDelete = true;
      await expectLater(
        s.remove(scope, expectedKey: old.key),
        throwsA(isA<StateError>()),
      );
      storage.failDelete = false;
      await s.save(action(key: 'new'));
      await expectLater(
        s.remove(scope, expectedKey: old.key),
        throwsA(isA<StateError>()),
      );
      expect((await s.read(scope))!.key, 'new');
    },
  );
  test('strict persisted types and normalized environment namespace', () async {
    final storage = MemorySecureStore(),
        s = SecurePendingFundStore(MemorySecureStore());
    final shared = SecurePendingFundStore(storage);
    await shared.save(action());
    final same = FundScope(
      Uri.parse('https://EXAMPLE.test/regist-v3/'),
      1,
      42,
      7,
    );
    expect((await shared.read(same))!.draft, draft);
    final key = storage.values.keys.single,
        valid = storage.values.values.single;
    for (final field in [
      'schema',
      'scope',
      'amount',
      'action',
      'date',
      'key',
      'createdAt',
    ]) {
      final j = jsonDecode(valid) as Map<String, dynamic>;
      switch (field) {
        case 'schema':
          j['schema'] = 1.0;
        case 'scope':
          j['scope'][1] = 1.0;
        case 'amount':
          j['draft']['amountCents'] = '2900';
        case 'action':
          j['draft']['action'] = 'unknown';
        case 'date':
          j['draft']['receivedOn'] = '2026-02-30';
        case 'key':
          j['key'] = '';
        case 'createdAt':
          j['createdAt'] = '2026-10-03';
      }
      storage.values[key] = jsonEncode(j);
      await expectLater(shared.read(scope), throwsA(isA<StateError>()));
      expect(storage.values.containsKey(key), true);
    }
    expect(await s.read(scope), isNull);
  });
}
