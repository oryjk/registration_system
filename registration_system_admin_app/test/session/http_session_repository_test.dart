import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:registration_system_admin_app/core/network/api_client.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/core/network/session_access.dart';
import 'package:registration_system_admin_app/features/session/data/http_session_repository.dart';

class Access implements SessionAccess {
  @override
  String? get token => 'saved';
  @override
  int get generation => 1;
  @override
  Future<void> unauthorized(int requestGeneration) async {}
}

const adminJson = {
  'id': 7,
  'username': 'operator',
  'role': 'admin',
  'status': 'active',
  'is_super_admin': false,
  'created_at': '2026-10-03T01:02:03Z',
};
void main() {
  test(
    'repository sends actual login contract without Bearer and maps Go fields',
    () async {
      final client = ApiClient(
        baseUrl: Uri.parse('https://example.test/regist-v3'),
        session: Access(),
        transport: MockClient((request) async {
          expect(request.url.path, '/regist-v3/api/v1/admin/auth/login');
          expect(request.method, 'POST');
          expect(request.headers['authorization'], isNull);
          expect(jsonDecode(request.body), {
            'username': '运营',
            'password': 'fixture',
          });
          return http.Response(
            jsonEncode({
              'code': 0,
              'message': 'ok',
              'data': {
                'access_token': 'new',
                'token_type': 'Bearer',
                'admin': adminJson,
              },
            }),
            200,
          );
        }),
      );
      addTearDown(client.close);
      final session = await HttpSessionRepository(
        client: client,
      ).login('运营', 'fixture');
      expect(session.accessToken, 'new');
      expect(session.admin.username, 'operator');
      expect(session.admin.createdAt, DateTime.utc(2026, 10, 3, 1, 2, 3));
    },
  );
  test(
    'current admin uses authenticated me and legacy timestamp is UTC',
    () async {
      final client = ApiClient(
        baseUrl: Uri.parse('https://example.test'),
        session: Access(),
        transport: MockClient((request) async {
          expect(request.url.path, '/api/v1/admin/auth/me');
          expect(request.headers['authorization'], 'Bearer saved');
          return http.Response(
            jsonEncode({
              'code': 0,
              'message': 'ok',
              'data': {...adminJson, 'created_at': '2026-10-03T01:02:03'},
            }),
            200,
          );
        }),
      );
      addTearDown(client.close);
      final admin = await HttpSessionRepository(client: client).current();
      expect(admin.createdAt, DateTime.utc(2026, 10, 3, 1, 2, 3));
    },
  );
  test('malformed admin and blank tokens are protocol failures', () async {
    for (final data in [
      {'access_token': '', 'admin': adminJson},
      {
        'access_token': 'new',
        'admin': {...adminJson, 'id': '7'},
      },
    ]) {
      final client = ApiClient(
        baseUrl: Uri.parse('https://example.test'),
        session: Access(),
        transport: MockClient(
          (_) async => http.Response(
            jsonEncode({'code': 0, 'message': 'ok', 'data': data}),
            200,
          ),
        ),
      );
      await expectLater(
        HttpSessionRepository(client: client).login('operator', 'fixture'),
        throwsA(
          isA<ApiError>().having(
            (error) => error.kind,
            'kind',
            ApiErrorKind.protocol,
          ),
        ),
      );
      client.close();
    }
  });
}
