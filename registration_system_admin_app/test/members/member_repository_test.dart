import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:registration_system_admin_app/core/network/api_client.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/core/network/session_access.dart';
import 'package:registration_system_admin_app/features/members/data/http_member_repository.dart';
import '../teams/fixtures.dart';

class Session implements SessionAccess {
  @override
  String? get token => 'fixture';
  @override
  int get generation => 1;
  @override
  Future<void> unauthorized(int requestGeneration) async {}
}

Map<String, Object?> memberJson() => {
  'id': 1,
  'user_id': 7,
  'nickname': '球员',
  'real_name': null,
  'phone_number': null,
  'avatar_url': null,
  'role': 'future_role',
  'status': 'future_status',
  'joined_at': '2026-10-02T23:00:00Z',
  'balance_cents': -150,
  'is_paid_member': true,
  'last_recharge_at': null,
};
Map<String, Object?> managementJson() => {
  'team': teamJson(),
  'members': [memberJson()],
};
void main() {
  test('real Go routes payloads and unknown nullable member fields', () async {
    final requests = <http.Request>[];
    final api = ApiClient(
      baseUrl: Uri.parse('https://example.test/regist-v3'),
      session: Session(),
      transport: MockClient((r) async {
        requests.add(r);
        final Object data = r.url.path.endsWith('member-candidates')
            ? [
                {
                  'user_id': 8,
                  'nickname': '候选',
                  'avatar_url': null,
                  'real_name': null,
                  'phone_number': '123',
                },
              ]
            : r.url.path.endsWith('/profile')
            ? {
                'id': 7,
                'nickname': '球员',
                'avatar_url': null,
                'real_name': null,
                'phone_number': null,
                'status': 'active',
              }
            : managementJson();
        return http.Response(
          jsonEncode({'code': 0, 'message': 'ok', 'data': data}),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    final r = HttpMemberRepository(api);
    final m = (await r.list(42)).members.single;
    expect(m.role, 'future_role');
    expect(m.status, 'future_status');
    expect(m.known, isFalse);
    expect(m.realName, isNull);
    expect(m.balanceCents, -150);
    expect(m.isPaidMember, isTrue);
    expect(m.lastRechargeAt, isNull);
    expect(m.joinedAt.isUtc, isTrue);
    expect((await r.candidates(42, '  张  ')).single.phoneNumber, '123');
    await r.add(42, 8, 'member');
    await r.update(42, 7, 'leader', 'inactive');
    await r.setCaptain(42, 7);
    await r.setCaptain(42, null);
    await r.setPaid(42, 7, false);
    await r.updateProfile(7, realName: '  姓名  ', phone: '  ');
    await r.updateProfile(7);
    await r.remove(42, 7);
    expect(requests.map((r) => r.method), [
      'GET',
      'GET',
      'POST',
      'PATCH',
      'PATCH',
      'PATCH',
      'PUT',
      'PATCH',
      'PATCH',
      'DELETE',
    ]);
    expect(requests[1].url.queryParameters, {'search': '张'});
    expect(requests[2].url.path, '/regist-v3/api/v1/admin/teams/42/members');
    expect(jsonDecode(requests[2].body), {'user_id': 8, 'role': 'member'});
    expect(jsonDecode(requests[3].body), {
      'role': 'leader',
      'status': 'inactive',
    });
    expect(requests[4].url.path.endsWith('/captain'), isTrue);
    expect(jsonDecode(requests[5].body), {'user_id': null});
    expect(jsonDecode(requests[6].body), {'is_paid_member': false});
    expect(jsonDecode(requests[7].body), {
      'real_name': '姓名',
      'phone_number': null,
    });
    expect(jsonDecode(requests[8].body), {
      'real_name': null,
      'phone_number': null,
    });
    api.close();
  });
  test(
    'captain role and oversized Unicode profile rejected before request',
    () async {
      var calls = 0;
      final api = ApiClient(
        baseUrl: Uri.parse('https://example.test'),
        session: Session(),
        transport: MockClient((_) async {
          calls++;
          return http.Response('{}', 200);
        }),
      );
      final r = HttpMemberRepository(api);
      await expectLater(r.add(42, 7, 'captain'), throwsA(isA<ApiError>()));
      await expectLater(
        r.update(42, 7, 'captain', 'active'),
        throwsA(isA<ApiError>()),
      );
      await expectLater(
        r.updateProfile(7, realName: '😀' * 121),
        throwsA(isA<ApiError>()),
      );
      await expectLater(
        r.updateProfile(7, phone: '😀' * 33),
        throwsA(isA<ApiError>()),
      );
      expect(calls, 0);
      api.close();
    },
  );
  test('malformed successful write has uncertain outcome', () async {
    final api = ApiClient(
      baseUrl: Uri.parse('https://example.test'),
      session: Session(),
      transport: MockClient(
        (_) async => http.Response('{"code":0,"message":"ok","data":{}}', 200),
      ),
    );
    await expectLater(
      HttpMemberRepository(api).setPaid(42, 7, true),
      throwsA(
        isA<ApiError>().having((e) => e.uncertainWrite, 'uncertain', true),
      ),
    );
    api.close();
  });
}
