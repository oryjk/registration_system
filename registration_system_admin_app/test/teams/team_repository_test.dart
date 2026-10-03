import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:registration_system_admin_app/core/network/api_client.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/core/network/session_access.dart';
import 'package:registration_system_admin_app/features/teams/data/http_team_repository.dart';
import 'package:registration_system_admin_app/features/teams/data/team_response_mapper.dart';
import 'package:registration_system_admin_app/features/teams/domain/team_draft.dart';
import 'fixtures.dart';

class _Session implements SessionAccess {
  @override
  String? get token => 'fixture';
  @override
  int get generation => 1;
  @override
  Future<void> unauthorized(int requestGeneration) async {}
}

void main() {
  test(
    'Go array nullable captain unknown status and optional count are preserved',
    () {
      final t = TeamResponseMapper.fromJson(teamJson(status: 'future'));
      expect(t.captain, isNull);
      expect(t.logoUrl, isNull);
      expect(t.status, 'future');
      expect(t.canManage, isFalse);
      expect(t.memberCount, 12);
      expect(t.createdAt.isUtc, isTrue);
      expect(
        TeamResponseMapper.fromJson(teamJson(list: false)).memberCount,
        isNull,
      );
      final json = teamJson()
        ..['captain_id'] = 7
        ..['captain'] = {
          'user_id': 7,
          'nickname': '队长',
          'avatar_url': null,
          'real_name': '示例姓名',
        };
      expect(TeamResponseMapper.fromJson(json).captain!.userId, 7);
      expect(TeamResponseMapper.fromJson(json).captain!.realName, '示例姓名');
    },
  );
  test('malformed wire fields and timestamps reject protocol', () {
    for (final entry in {
      'id': '42',
      'member_count': 1.5,
      'status': 4,
      'created_at': '2026-10-03',
    }.entries) {
      expect(
        () =>
            TeamResponseMapper.fromJson(teamJson()..[entry.key] = entry.value),
        throwsA(isA<ApiError>()),
      );
    }
  });
  test(
    'real paths status-only query create/edit payload and password clear',
    () async {
      final requests = <http.Request>[];
      final api = ApiClient(
        baseUrl: Uri.parse('https://example.test/regist-v3'),
        session: _Session(),
        transport: MockClient((r) async {
          requests.add(r);
          final Object data = r.method == 'GET' && r.url.path.endsWith('/teams')
              ? [teamJson()]
              : r.method == 'DELETE'
              ? {'id': 42}
              : r.method == 'PUT'
              ? {}
              : teamJson(list: false);
          return http.Response(
            jsonEncode({'code': 0, 'message': 'ok', 'data': data}),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }),
      );
      final r = HttpTeamRepository(api);
      expect((await r.list(status: 'active')).single.name, '星河队');
      await r.get(42);
      await r.create(const TeamDraft(name: '  新队  ', description: '   '));
      await r.update(
        42,
        const TeamDraft(name: '改名', description: '  介绍 ', status: 'frozen'),
      );
      await r.setJoinPassword(42, '  保留空格  ');
      await r.setJoinPassword(42, '');
      await r.delete(42);
      expect(requests.first.url.queryParameters, {'status': 'active'});
      expect(requests.map((x) => x.method), [
        'GET',
        'GET',
        'POST',
        'PATCH',
        'PUT',
        'PUT',
        'DELETE',
      ]);
      expect(requests[1].url.path, '/regist-v3/api/v1/admin/teams/42');
      expect(jsonDecode(requests[2].body), {'name': '新队', 'description': null});
      expect(jsonDecode(requests[3].body), {
        'name': '改名',
        'description': '介绍',
        'status': 'frozen',
      });
      expect(jsonDecode(requests[4].body), {'join_password': '  保留空格  '});
      expect(jsonDecode(requests[5].body), {'join_password': ''});
      api.close();
    },
  );
  test('success with malformed created DTO remains uncertain write', () async {
    final api = ApiClient(
      baseUrl: Uri.parse('https://example.test'),
      session: _Session(),
      transport: MockClient(
        (_) async => http.Response('{"code":0,"message":"ok","data":{}}', 200),
      ),
    );
    await expectLater(
      HttpTeamRepository(api).create(const TeamDraft(name: '新队')),
      throwsA(
        isA<ApiError>().having((x) => x.uncertainWrite, 'uncertain', true),
      ),
    );
    api.close();
  });
  test('draft Unicode rune limit and unknown status validation', () {
    expect(const TeamDraft(name: '  ').validate(), contains('name'));
    expect(TeamDraft(name: '😀' * 120).validate(), isEmpty);
    expect(TeamDraft(name: '😀' * 121).validate(), contains('name'));
    expect(
      const TeamDraft(name: '队', status: 'future').validate(),
      contains('status'),
    );
  });
}
