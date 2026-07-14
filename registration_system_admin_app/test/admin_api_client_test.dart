import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:registration_system_admin_app/services/admin_api_client.dart';

void main() {
  test('login posts to admin auth endpoint and parses session', () async {
    late http.BaseRequest capturedRequest;

    final client = MockClient((request) async {
      capturedRequest = request;
      return http.Response(
        jsonEncode({
          'success': true,
          'message': 'ok',
          'data': {
            'access_token': 'token-123',
            'token_type': 'Bearer',
            'admin': {
              'id': 7,
              'username': 'admin',
              'nickname': '运营',
              'status': 1,
              'is_super_admin': true,
            },
          },
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    });

    final api = AdminApiClient(
      baseUrl: 'http://127.0.0.1:18080',
      client: client,
    );

    final session = await api.login(username: 'admin', password: 'secret');

    expect(
      capturedRequest.url.toString(),
      'http://127.0.0.1:18080/api/admin/auth/login',
    );
    expect(
      capturedRequest.headers['Content-Type'],
      contains('application/json'),
    );
    expect(
      jsonDecode((capturedRequest as http.Request).body)
          as Map<String, dynamic>,
      {'username': 'admin', 'password': 'secret'},
    );
    expect(session.accessToken, 'token-123');
    expect(session.admin.username, 'admin');
    expect(session.admin.isSuperAdmin, isTrue);
  });

  test(
    'createActivity posts to admin activities endpoint with bearer token',
    () async {
      late http.BaseRequest capturedRequest;

      final client = MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode({
            'success': true,
            'message': '活动创建成功',
            'data': {'id': 'activity-1', 'name': '春季联赛'},
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = AdminApiClient(
        baseUrl: 'http://127.0.0.1:18080',
        accessToken: 'token-123',
        client: client,
      );

      await api.createActivity(
        name: '春季联赛',
        location: '南区体育中心',
        holdingDate: '2026-06-18T19:00:00',
        startTime: '2026-06-17T19:30:00',
        endTime: '2026-06-17T21:00:00',
        matchKind: 'internal',
        description: '管理端创建测试',
      );

      expect(
        capturedRequest.url.toString(),
        'http://127.0.0.1:18080/api/admin/activities',
      );
      expect(capturedRequest.headers['Authorization'], 'Bearer token-123');
      final body =
          jsonDecode((capturedRequest as http.Request).body)
              as Map<String, dynamic>;
      expect(body['name'], '春季联赛');
      expect(body['location'], '南区体育中心');
      expect(body['match_kind'], 'internal');
    },
  );

  test(
    'createTeam posts to admin team endpoint with captain id when provided',
    () async {
      late http.BaseRequest capturedRequest;

      final client = MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode({
            'success': true,
            'message': '球队创建成功',
            'data': {'id': 99, 'name': '城南联队'},
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final api = AdminApiClient(
        baseUrl: 'http://127.0.0.1:18080',
        accessToken: 'token-123',
        client: client,
      );

      await api.createTeam(
        name: '城南联队',
        description: '管理端创建测试',
        joinPassword: '123456',
        captainId: 77,
      );

      expect(
        capturedRequest.url.toString(),
        'http://127.0.0.1:18080/api/admin/teams/admin',
      );
      expect(capturedRequest.headers['Authorization'], 'Bearer token-123');
      final body =
          jsonDecode((capturedRequest as http.Request).body)
              as Map<String, dynamic>;
      expect(body['name'], '城南联队');
      expect(body['join_password'], '123456');
      expect(body['captain_id'], 77);
    },
  );

  test('login surfaces transport failures as admin api exceptions', () async {
    final client = MockClient((_) async {
      throw http.ClientException('Cleartext HTTP traffic not permitted');
    });

    final api = AdminApiClient(
      baseUrl: 'http://10.0.2.2:18080',
      client: client,
    );

    expect(
      () => api.login(username: 'admin', password: 'secret'),
      throwsA(
        isA<AdminApiException>().having(
          (error) => error.message,
          'message',
          contains('网络请求失败'),
        ),
      ),
    );
  });
}
