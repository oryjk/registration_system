import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:registration_system_admin_app/core/network/api_client.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/features/team_fund/data/http_fund_repository.dart';
import 'package:registration_system_admin_app/features/team_fund/domain/fund_models.dart';
import '../members/member_repository_test.dart' show Session;
import 'fixtures.dart';

void main() {
  test(
    'Go routes integer cents dates duplicate and reversal payload',
    () async {
      final requests = <http.Request>[];
      final api = ApiClient(
        baseUrl: scope.environment,
        session: Session(),
        transport: MockClient((r) async {
          requests.add(r);
          final data = r.method == 'GET'
              ? [
                  {
                    'id': 21,
                    'team_id': 42,
                    'amount_cents': -120,
                    'balance_after_cents': -150,
                    'source': 'future_source',
                    'description': '历史',
                    'created_at': '2026-10-03T02:00:00Z',
                    'received_on': null,
                    'reversed_by_transaction_id': null,
                    'created_by_admin_id': null,
                    'created_by_user_id': null,
                    'match_name': null,
                  },
                ]
              : {
                  'balance_cents': -150,
                  'transaction_id': 99,
                  'duplicated': true,
                };
          return http.Response(
            jsonEncode({'code': 0, 'message': 'ok', 'data': data}),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }),
      );
      final r = HttpFundRepository(api);
      expect((await r.execute(action())).duplicated, true);
      await r.execute(
        action(
          value: const FundDraft(
            action: FundAction.consume,
            amountCents: 29,
            note: '消费',
          ),
        ),
      );
      await r.execute(
        action(
          value: const FundDraft(
            action: FundAction.reversal,
            note: '纠错',
            originalTransactionId: 21,
          ),
        ),
      );
      final t = (await r.transactions(42, 7, beforeId: 25, limit: 30)).single;
      expect(t.source, 'future_source');
      expect(t.canReverse, false);
      expect(t.balanceAfterCents, -150);
      expect(requests.map((r) => r.url.path), [
        '/regist-v3/api/v1/admin/team-fund/credits',
        '/regist-v3/api/v1/admin/team-fund/consumptions',
        '/regist-v3/api/v1/admin/team-fund/reversals',
        '/regist-v3/api/v1/admin/teams/42/members/7/fund-transactions',
      ]);
      expect(jsonDecode(requests.first.body), {
        'team_id': 42,
        'user_id': 7,
        'amount_cents': 2900,
        'note': '线下款',
        'received_on': '2026-10-03',
        'idempotency_key': 'original',
      });
      expect(jsonDecode(requests[2].body), {
        'team_id': 42,
        'user_id': 7,
        'original_transaction_id': 21,
        'note': '纠错',
        'idempotency_key': 'original',
      });
      expect(requests.last.url.queryParameters, {
        'before_id': '25',
        'limit': '30',
      });
      api.close();
    },
  );
  test(
    'UTF8 byte limits exact cap and required consume/reversal notes before HTTP',
    () async {
      var calls = 0;
      final api = ApiClient(
        baseUrl: scope.environment,
        session: Session(),
        transport: MockClient((_) async {
          calls++;
          return http.Response(
            '{"code":0,"message":"ok","data":{"balance_cents":0,"transaction_id":1,"duplicated":false}}',
            200,
          );
        }),
      );
      final r = HttpFundRepository(api);
      for (final d in [
        FundDraft(action: FundAction.credit, amountCents: 100, note: '汉' * 41),
        const FundDraft(action: FundAction.credit, amountCents: 1000001),
        const FundDraft(action: FundAction.consume, amountCents: 100),
        const FundDraft(action: FundAction.reversal, originalTransactionId: 1),
        const FundDraft(
          action: FundAction.credit,
          amountCents: 100,
          receivedOn: '2026-02-30',
        ),
      ]) {
        await expectLater(
          r.execute(action(value: d)),
          throwsA(isA<ApiError>()),
        );
      }
      expect(calls, 0);
      await r.execute(
        action(
          value: FundDraft(
            action: FundAction.credit,
            amountCents: 1000000,
            note: '汉' * 40,
          ),
        ),
      );
      expect(calls, 1);
      api.close();
    },
  );
  test('malformed code0 preserves write uncertainty', () async {
    final api = ApiClient(
      baseUrl: scope.environment,
      session: Session(),
      transport: MockClient(
        (_) async => http.Response(
          '{"code":0,"message":"ok","data":{"balance_cents":"2900","transaction_id":99,"duplicated":false}}',
          200,
        ),
      ),
    );
    await expectLater(
      HttpFundRepository(api).execute(action()),
      throwsA(
        isA<ApiError>().having((e) => e.uncertainWrite, 'uncertain', true),
      ),
    );
    api.close();
  });
  test('reversal source whitelist and already reversed status', () {
    for (final source in [
      'admin_credit',
      'manual_consume',
      'manual_adjustment',
    ]) {
      expect(transaction(1, source: source).canReverse, true);
      expect(transaction(1, source: source, reversed: 2).canReverse, false);
    }
    for (final source in [
      'manual_reversal',
      'match_settlement',
      'wechat_payment',
      'future',
    ]) {
      expect(transaction(1, source: source).canReverse, false);
    }
  });
  test(
    'raw credit UTF8 whitespace boundary matches Go while consume reversal trim first',
    () async {
      final requests = <http.Request>[];
      final api = ApiClient(
        baseUrl: scope.environment,
        session: Session(),
        transport: MockClient((r) async {
          requests.add(r);
          return http.Response(
            '{"code":0,"message":"ok","data":{"balance_cents":0,"transaction_id":1,"duplicated":false}}',
            200,
          );
        }),
      );
      final repository = HttpFundRepository(api);
      final rawTooLong = ' ${'汉' * 40} ';
      final rejected = FundDraft(
        action: FundAction.credit,
        amountCents: 100,
        note: rawTooLong,
      );
      expect(rejected.validate()['note'], isNotNull);
      await expectLater(
        repository.execute(action(value: rejected)),
        throwsA(
          isA<ApiError>().having(
            (e) => e.kind,
            'kind',
            ApiErrorKind.validation,
          ),
        ),
      );
      expect(requests, isEmpty);
      final exactBoundary = ' ${'汉' * 39}  ';
      await repository.execute(
        action(
          value: FundDraft(
            action: FundAction.credit,
            amountCents: 100,
            note: exactBoundary,
          ),
        ),
      );
      expect(jsonDecode(requests.single.body)['note'], exactBoundary);
      for (final operation in [FundAction.consume, FundAction.reversal]) {
        final d = FundDraft(
          action: operation,
          amountCents: operation == FundAction.consume ? 100 : 0,
          originalTransactionId: operation == FundAction.reversal ? 9 : null,
          note: rawTooLong,
        );
        expect(d.validate(), isEmpty);
        await repository.execute(action(value: d));
        expect(jsonDecode(requests.last.body)['note'], rawTooLong);
      }
      expect(requests.length, 3);
      api.close();
    },
  );
}
