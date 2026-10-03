import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:registration_system_admin_app/core/network/api_client.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/core/network/session_access.dart';
import 'package:registration_system_admin_app/features/matches/data/http_match_repository.dart';
import 'package:registration_system_admin_app/features/matches/data/match_response_mapper.dart';
import 'package:registration_system_admin_app/features/matches/domain/match_repository.dart';
import 'fixtures.dart';

class _Session implements SessionAccess {
  @override
  String? get token => 'fake';
  @override
  int get generation => 1;
  @override
  Future<void> unauthorized(int requestGeneration) async {}
}

void main() {
  test(
    'real Go DTO retains nullable teams scores money counts paid and unknown enum',
    () {
      final d = MatchResponseMapper.detail(
        detailJson(mode: 'online_pickup', status: 'future'),
      );
      expect(d.match.hostTeamId, isNull);
      expect(d.match.awayTeamId, isNull);
      expect(d.match.hostScore, isNull);
      expect(d.match.awayScore, isNull);
      expect(d.match.status, 'future');
      expect(d.match.canRecordScore, isFalse);
      expect(d.match.feePerPersonCents, 500);
      expect(d.groups.single.registrations.single.registrationCount, 3);
      expect(d.groups.single.registrations.single.paid, isTrue);
      expect(d.groups.single.registrations.single.status, 'future_status');
      expect(d.match.startTime.isUtc, isTrue);
      expect(d.match.startTime.hour, 1);
    },
  );
  test('strict wire types reject malformed count fee and instant', () {
    for (final entry in {
      'players_per_team': '5',
      'is_free': 0,
      'start_time': '2026-10-04',
      'fee_per_person_cents': 5.5,
    }.entries) {
      final m = matchJson()..[entry.key] = entry.value;
      expect(() => MatchResponseMapper.item(m), throwsA(isA<ApiError>()));
    }
  });
  test('repository sends real paths methods query and update DTO', () async {
    final requests = <http.Request>[];
    final api = ApiClient(
      baseUrl: Uri.parse('https://example.test/regist-v3'),
      transport: MockClient((r) async {
        requests.add(r);
        final Object data = r.method == 'DELETE'
            ? {'id': 'match-1'}
            : r.url.path.endsWith('/matches') && r.method == 'GET'
            ? {
                'items': [matchJson()],
                'total': 1,
                'page': 2,
                'page_size': 20,
              }
            : detailJson();
        return http.Response(
          jsonEncode({'code': 0, 'message': 'ok', 'data': data}),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
      session: _Session(),
    );
    final r = HttpMatchRepository(api);
    final p = await r.list(
      const MatchQuery(search: '测试 &', status: 'ongoing', page: 2),
    );
    expect(p.page, 2);
    expect(requests.last.url.queryParameters, {
      'search': '测试 &',
      'status': 'ongoing',
      'page': '2',
      'page_size': '20',
    });
    await r.get('match-1');
    await r.create(MatchDraft.fromDetail(detail()));
    await r.update('match-1', MatchDraft.fromDetail(detail()));
    await r.setStatus('match-1', 'ongoing');
    await r.setScore('match-1', 0, 0);
    await r.delete('match-1');
    expect(requests.map((x) => x.method), [
      'GET',
      'GET',
      'POST',
      'PATCH',
      'PATCH',
      'PATCH',
      'DELETE',
    ]);
    expect(
      requests[4].url.path,
      '/regist-v3/api/v1/admin/matches/match-1/status',
    );
    expect(jsonDecode(requests[5].body), {'host_score': 0, 'away_score': 0});
    expect(jsonDecode(requests[3].body), isNot(contains('publication_mode')));
    api.close();
  });
  test('unknown payment or fee rules do not permit dangerous mutations', () {
    for (final field in [
      'publication_mode',
      'opponent_state',
      'payment_mode',
      'fee_type',
    ]) {
      final json = detailJson(status: 'ongoing');
      (json['match'] as Map<String, Object?>)[field] = 'future_value';
      final m = MatchResponseMapper.detail(json).match;
      expect(m.canEdit, isFalse);
      expect(m.canRecordScore, isFalse);
      expect(m.allowedNextStatuses, isEmpty);
      expect(m.canDelete, isFalse);
    }
  });
  test(
    'malformed pagination is rejected rather than enabling endless loadMore',
    () {
      for (final pair in {'page': 0, 'page_size': 0, 'total': -1}.entries) {
        final json = <String, Object?>{
          'items': [],
          'total': 0,
          'page': 1,
          'page_size': 20,
        }..[pair.key] = pair.value;
        expect(() => MatchResponseMapper.page(json), throwsA(isA<ApiError>()));
      }
    },
  );
  test('success malformed write DTO is uncertain and never retried', () async {
    var count = 0;
    final api = ApiClient(
      baseUrl: Uri.parse('https://example.test'),
      transport: MockClient((_) async {
        count++;
        return http.Response('{"code":0,"message":"ok","data":{}}', 200);
      }),
      session: _Session(),
    );
    await expectLater(
      HttpMatchRepository(api).setStatus('match-1', 'ongoing'),
      throwsA(
        isA<ApiError>().having((x) => x.uncertainWrite, 'uncertain', true),
      ),
    );
    expect(count, 1);
    api.close();
  });
  test(
    'legacy empty fee type preserves supported existing match capabilities',
    () {
      final json = matchJson(status: 'ongoing')..['fee_type'] = '';
      expect(MatchResponseMapper.item(json).canRecordScore, isTrue);
      json.remove('fee_type');
      expect(MatchResponseMapper.item(json).canEdit, isTrue);
    },
  );
}
