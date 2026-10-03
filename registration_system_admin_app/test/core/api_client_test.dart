import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:registration_system_admin_app/core/network/api_client.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/core/network/json_value.dart';
import 'package:registration_system_admin_app/core/network/session_access.dart';

class FakeSession implements SessionAccess {
  @override
  String? token = 'fixture-token';
  @override
  int generation = 7;
  final unauthorizedGenerations = <int>[];

  @override
  Future<void> unauthorized(int requestGeneration) async {
    unauthorizedGenerations.add(requestGeneration);
  }
}

http.Response envelope(Object? data, {int status = 200, int code = 0}) =>
    http.Response(
      jsonEncode({
        'code': code,
        'message': code == 0 ? 'ok' : '拒绝请求',
        'data': data,
      }),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

Matcher apiError(
  ApiErrorKind kind, {
  bool uncertain = false,
  int? status,
  int? code,
}) => isA<ApiError>()
    .having((e) => e.kind, 'kind', kind)
    .having((e) => e.uncertainWrite, 'uncertainWrite', uncertain)
    .having((e) => e.httpStatus, 'httpStatus', status)
    .having((e) => e.code, 'code', code);

void main() {
  late FakeSession session;
  late ApiClient client;
  setUp(() => session = FakeSession());
  tearDown(() => client.close());

  ApiClient create(
    Future<http.Response> Function(http.Request) handler, {
    Duration timeout = const Duration(seconds: 20),
    String base = 'https://example.test/regist-v3',
  }) {
    return client = ApiClient(
      baseUrl: Uri.parse(base),
      transport: MockClient(handler),
      session: session,
      timeout: timeout,
    );
  }

  test(
    'admin request retains proxy base and sends Bearer with encoded query',
    () async {
      create((request) async {
        expect(request.url.path, '/regist-v3/api/v1/admin/matches');
        expect(request.url.queryParameters, {'name': '上海 + A&B', 'page': '2'});
        expect(request.headers['Authorization'], 'Bearer fixture-token');
        return envelope([
          {'id': 12},
        ]);
      }, base: 'https://example.test/regist-v3/');
      expect(
        await client.request(
          'GET',
          '/matches',
          query: {'name': '上海 + A&B', 'page': '2'},
        ),
        [
          {'id': 12},
        ],
      );
    },
  );

  test('login omits token and preserves Unicode JSON body', () async {
    create((request) async {
      expect(request.url.path, '/regist-v3/api/v1/admin/auth/login');
      expect(request.headers.containsKey('Authorization'), isFalse);
      expect(jsonDecode(utf8.decode(request.bodyBytes)), {
        'username': '管理员🐱',
        'password': 'fixture-password',
      });
      expect(request.headers['Content-Type'], contains('application/json'));
      return envelope({'token': 'new-fixture'});
    });
    expect(
      await client.request(
        'POST',
        '/auth/login',
        authenticated: false,
        body: {'username': '管理员🐱', 'password': 'fixture-password'},
      ),
      {'token': 'new-fixture'},
    );
  });

  test('health skips admin prefix and accepts null success data', () async {
    create((request) async {
      expect(request.url.path, '/regist-v3/health');
      expect(request.headers.containsKey('Authorization'), isFalse);
      return envelope(null);
    });
    expect(
      await client.request(
        'GET',
        '/health',
        adminPrefix: false,
        authenticated: false,
      ),
      isNull,
    );
  });

  test('empty session does not send an empty Bearer token', () async {
    session.token = null;
    create((request) async {
      expect(request.headers.containsKey('Authorization'), isFalse);
      return envelope('healthy');
    });
    expect(await client.request('GET', '/matches'), 'healthy');
  });

  for (final item in [
    (401, ApiErrorKind.unauthorized),
    (403, ApiErrorKind.forbidden),
    (422, ApiErrorKind.validation),
    (409, ApiErrorKind.conflict),
    (500, ApiErrorKind.server),
  ]) {
    test('HTTP ${item.$1} preserves status and business code', () async {
      create((_) async => envelope(null, status: item.$1, code: item.$1));
      await expectLater(
        client.request('POST', '/teams', body: {'name': 'A'}),
        throwsA(
          apiError(
            item.$2,
            uncertain: item.$1 == 500,
            status: item.$1,
            code: item.$1,
          ),
        ),
      );
      expect(session.unauthorizedGenerations, item.$1 == 401 ? [7] : isEmpty);
    });
  }

  test('business rejection retains independent HTTP status', () async {
    create((_) async => envelope(null, code: 9123));
    await expectLater(
      client.request('POST', '/teams'),
      throwsA(apiError(ApiErrorKind.business, status: 200, code: 9123)),
    );
  });

  test(
    'HTTP status remains authoritative when business code differs',
    () async {
      create((_) async => envelope(null, status: 422, code: 9123));
      await expectLater(
        client.request('POST', '/teams'),
        throwsA(apiError(ApiErrorKind.validation, status: 422, code: 9123)),
      );
    },
  );

  test(
    'non JSON write response is uncertain with no automatic replay',
    () async {
      var calls = 0;
      create((_) async {
        calls++;
        return http.Response('<html>proxy error</html>', 200);
      });
      await expectLater(
        client.request('POST', '/teams'),
        throwsA(apiError(ApiErrorKind.protocol, uncertain: true, status: 200)),
      );
      expect(calls, 1);
    },
  );

  test(
    'non JSON 401 still informs session and is a definite rejection',
    () async {
      create((_) async => http.Response('unauthorized', 401));
      await expectLater(
        client.request('POST', '/teams'),
        throwsA(apiError(ApiErrorKind.unauthorized, status: 401)),
      );
      expect(session.unauthorizedGenerations, [7]);
    },
  );

  test('non JSON server response marks writes uncertain', () async {
    create((_) async => http.Response('bad gateway', 502));
    await expectLater(
      client.request('DELETE', '/teams/12'),
      throwsA(apiError(ApiErrorKind.server, uncertain: true, status: 502)),
    );
  });

  test('read failures never mark an uncertain write', () async {
    create((_) async => envelope(null, status: 500, code: 500));
    await expectLater(
      client.request('GET', '/teams'),
      throwsA(apiError(ApiErrorKind.server, status: 500, code: 500)),
    );
  });

  for (final item in [
    ('[]', null),
    ('{"message":"ok","data":[]}', null),
    ('{"code":"0","message":"ok","data":[]}', null),
    ('{"code":0.0,"message":"ok","data":[]}', null),
    ('{"code":0,"message":null,"data":[]}', 0),
    ('{"code":0,"message":"ok"}', 0),
  ]) {
    test('malformed envelope is a protocol failure: ${item.$1}', () async {
      create((_) async => http.Response(item.$1, 200));
      await expectLater(
        client.request('GET', '/teams'),
        throwsA(apiError(ApiErrorKind.protocol, status: 200, code: item.$2)),
      );
    });
  }

  test('timeout marks write uncertain without retrying', () async {
    var calls = 0;
    create((_) {
      calls++;
      return Completer<http.Response>().future;
    }, timeout: const Duration(milliseconds: 10));
    await expectLater(
      client.request('PATCH', '/teams/12'),
      throwsA(apiError(ApiErrorKind.timeout, uncertain: true)),
    );
    expect(calls, 1);
  });

  test(
    'transport failure normalizes without leaking underlying details',
    () async {
      create(
        (_) async => throw http.ClientException('sensitive fixture error'),
      );
      await expectLater(
        client.request('POST', '/teams'),
        throwsA(apiError(ApiErrorKind.network, uncertain: true)),
      );
      try {
        await client.request('GET', '/teams');
      } on ApiError catch (e) {
        expect(e.message, isNot(contains('sensitive fixture')));
      }
    },
  );

  test(
    'local body encoding failure never dispatches an uncertain write',
    () async {
      var calls = 0;
      create((_) async {
        calls++;
        return envelope(null);
      });
      await expectLater(
        client.request('POST', '/teams', body: {'unsupported': Object()}),
        throwsA(apiError(ApiErrorKind.protocol)),
      );
      expect(calls, 0);
    },
  );

  test('timeout also covers a stalled response body', () async {
    final body = StreamController<List<int>>();
    addTearDown(body.close);
    client = ApiClient(
      baseUrl: Uri.parse('https://example.test/regist-v3'),
      transport: MockClient.streaming(
        (_, _) async => http.StreamedResponse(body.stream, 200),
      ),
      session: session,
      timeout: const Duration(milliseconds: 10),
    );
    await expectLater(
      client.request('POST', '/teams'),
      throwsA(apiError(ApiErrorKind.timeout, uncertain: true)),
    );
  });

  test(
    'business unauthorized code on HTTP success reports session generation',
    () async {
      create((_) async => envelope(null, code: 401));
      await expectLater(
        client.request('GET', '/teams'),
        throwsA(apiError(ApiErrorKind.unauthorized, status: 200, code: 401)),
      );
      expect(session.unauthorizedGenerations, [7]);
    },
  );

  test(
    'old 401 reports dispatch generation after account generation changes',
    () async {
      final response = Completer<http.Response>();
      final dispatched = Completer<void>();
      create((request) {
        expect(request.headers['Authorization'], 'Bearer fixture-token');
        dispatched.complete();
        return response.future;
      });
      final pending = client.request('GET', '/teams');
      final assertion = expectLater(
        pending,
        throwsA(apiError(ApiErrorKind.unauthorized, status: 401, code: 401)),
      );
      await dispatched.future.timeout(const Duration(seconds: 1));
      session.generation = 8;
      session.token = 'different-fixture-token';
      response.complete(envelope(null, status: 401, code: 401));
      await assertion;
      expect(session.unauthorizedGenerations, [7]);
    },
  );

  test('login 401 never clears an authenticated session', () async {
    create((_) async => envelope(null, status: 401, code: 401));
    await expectLater(
      client.request('POST', '/auth/login', authenticated: false),
      throwsA(apiError(ApiErrorKind.unauthorized, status: 401, code: 401)),
    );
    expect(session.unauthorizedGenerations, isEmpty);
  });

  group('strict repository decoding', () {
    setUp(() => create((_) async => envelope(null)));

    test('decodes objects arrays primitives and nullable values', () {
      expect(JsonValue.object({'id': 12}), {'id': 12});
      expect(JsonValue.array([12, null]), [12, null]);
      expect(JsonValue.number(12.5), 12.5);
      expect(JsonValue.integer(12), 12);
      expect(JsonValue.string('球队'), '球队');
      expect(JsonValue.boolean(true), isTrue);
      expect(JsonValue.nullable<String>(null, JsonValue.string), isNull);
      expect(JsonValue.nullable<String>('A', JsonValue.string), 'A');
    });

    test('rejects wrong types without coercion', () {
      for (final decode in <Object? Function()>[
        () => JsonValue.object([]),
        () => JsonValue.object({1: 'wrong key'}),
        () => JsonValue.array({}),
        () => JsonValue.number('12'),
        () => JsonValue.number(double.nan),
        () => JsonValue.integer(12.0),
        () => JsonValue.string(12),
        () => JsonValue.boolean('true'),
      ]) {
        expect(decode, throwsA(apiError(ApiErrorKind.protocol)));
      }
    });

    test('repository conversion errors become protocol errors', () {
      expect(
        () => JsonValue.decode<int>('wrong', (value) => value as int),
        throwsA(apiError(ApiErrorKind.protocol)),
      );
      expect(
        () => JsonValue.decode<DateTime>(
          'bad date',
          (value) => DateTime.parse(JsonValue.string(value)),
        ),
        throwsA(apiError(ApiErrorKind.protocol)),
      );
      final existing = ApiError(
        message: 'denied',
        kind: ApiErrorKind.forbidden,
        httpStatus: 403,
        code: 403,
      );
      expect(
        () => JsonValue.decode<int>(null, (_) => throw existing),
        throwsA(same(existing)),
      );
    });

    test('write repository decoding preserves uncertain execution', () {
      expect(
        () => JsonValue.decode<int>(
          'wrong',
          (value) => value as int,
          uncertainWrite: true,
        ),
        throwsA(apiError(ApiErrorKind.protocol, uncertain: true)),
      );
      expect(
        () => JsonValue.decode<int>(
          'wrong',
          JsonValue.integer,
          uncertainWrite: true,
        ),
        throwsA(apiError(ApiErrorKind.protocol, uncertain: true)),
      );
    });
  });
}
