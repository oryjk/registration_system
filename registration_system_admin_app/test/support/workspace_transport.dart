import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

/// Offline Go-envelope fixture; never connects to a server.
class WorkspaceTransport extends http.BaseClient {
  bool unauthorized = false,
      failRead = false,
      uncertainFund = false,
      uncertainMatch = false;
  int detailStatus = 200;
  String readErrorMessage = '读取暂时失败，请重试';
  Completer<void>? detailBarrier, currentBarrier, readBarrier;
  final requests = <http.BaseRequest>[];
  final fundBodies = <Map<String, dynamic>>[];
  final Map<String, Map<String, Object?>> _results = {};
  int adminId = 9001;
  String username = '测试运营员';
  static const instant = '2026-10-03T08:00:00Z';
  final teams = <Map<String, dynamic>>[
    {
      'id': 42,
      'name': '示例星河队',
      'status': 'active',
      'description': '每周相聚，一起踢球',
      'created_at': instant,
      'updated_at': instant,
      'member_count': 1,
    },
  ];
  final members = <Map<String, dynamic>>[
    {
      'id': 1,
      'user_id': 7,
      'nickname': '小林',
      'real_name': '林同学',
      'phone_number': '',
      'role': 'member',
      'status': 'active',
      'joined_at': instant,
      'balance_cents': 2500,
      'is_paid_member': false,
    },
  ];
  final matches = <Map<String, dynamic>>[match('fixture-match', '周末友谊赛')];
  final transactions = <Map<String, dynamic>>[];
  static Map<String, dynamic> match(String id, String name) => {
    'id': id,
    'name': name,
    'publication_mode': 'online_individual',
    'opponent_state': 'recruiting',
    'status': 'registering',
    'host_team_id': 42,
    'host_team_name': '示例星河队',
    'players_per_team': 5,
    'start_time': instant,
    'end_time': '2026-10-03T10:00:00Z',
    'location': '星河体育公园 · 一号场',
    'is_free': false,
    'payment_mode': 'postpaid',
    'fee_per_person_cents': 0,
    'created_at': instant,
    'updated_at': instant,
  };
  Map<String, dynamic> get admin => {
    'id': adminId,
    'username': username,
    'role': 'admin',
    'status': 'active',
    'is_super_admin': true,
    'created_at': instant,
  };
  Map<String, dynamic> detail(Map<String, dynamic> match) => {
    'match': match,
    'groups': [
      {
        'id': 'group-host',
        'kind': 'host_team',
        'team_id': match['host_team_id'],
        'min_players': 1,
        'max_players': 10,
        'status': 'open',
        'registrations': [
          for (final member in members)
            {
              'user_id': member['user_id'],
              'nickname': member['nickname'],
              'real_name': member['real_name'],
              'member_role': member['role'],
              'status': 'attending',
              'registration_count': 1,
              'paid': false,
            },
        ],
      },
    ],
  };
  Map<String, dynamic> management(int id) => {
    'team': teams.firstWhere((team) => team['id'] == id),
    'members': members,
  };
  http.StreamedResponse envelope(
    Object? data, {
    int code = 0,
    String message = 'ok',
    int status = 200,
  }) => http.StreamedResponse(
    Stream.value(
      utf8.encode(jsonEncode({'code': code, 'message': message, 'data': data})),
    ),
    status,
    headers: {'content-type': 'application/json'},
  );
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    requests.add(request);
    final path = request.url.path.replaceFirst('/api/v1/admin', '');
    final body = request is http.Request && request.body.isNotEmpty
        ? jsonDecode(request.body) as Map<String, dynamic>
        : <String, dynamic>{};
    if (path == '/health') return envelope({'status': 'ok'});
    if (path == '/auth/login') {
      username = body['username'] as String;
      return envelope({'access_token': 'fixture-token', 'admin': admin});
    }
    if (unauthorized) {
      return envelope(null, code: 401, message: '登录失效', status: 401);
    }
    if (path == '/auth/me') {
      await currentBarrier?.future;
      return envelope(admin);
    }
    if (request.method == 'GET') await readBarrier?.future;
    if (failRead && request.method == 'GET') {
      return envelope(null, code: 503, message: readErrorMessage, status: 503);
    }
    if (path == '/teams') {
      if (request.method == 'POST') {
        final team = {...teams.first, ...body, 'id': teams.length + 100};
        teams.add(team);
        return envelope(team);
      }
      return envelope(
        teams
            .where(
              (team) =>
                  request.url.queryParameters['status'] == null ||
                  team['status'] == request.url.queryParameters['status'],
            )
            .toList(),
      );
    }
    final segments = path.split('/');
    if (segments.length >= 3 && segments[1] == 'teams') {
      final id = int.parse(segments[2]);
      if (segments.length == 3) {
        final team = teams.firstWhere((team) => team['id'] == id);
        if (request.method == 'PATCH') team.addAll(body);
        return envelope(team);
      }
      if (segments[3] == 'member-candidates') {
        return envelope([
          {'user_id': 8, 'nickname': '新队员小周', 'real_name': '周同学'},
        ]);
      }
      if (segments.last == 'fund-transactions') {
        return envelope(transactions.reversed.toList());
      }
      if (segments[3] == 'members') {
        if (request.method == 'POST') {
          members.add({
            ...members.first,
            'id': 2,
            'user_id': body['user_id'],
            'nickname': '新队员小周',
            'real_name': '周同学',
            'role': body['role'],
          });
        }
        if (request.method == 'PATCH') {
          members
              .firstWhere(
                (member) => member['user_id'].toString() == segments[4],
              )
              .addAll(body);
        }
        return envelope(management(id));
      }
    }
    if (path == '/matches') {
      if (request.method == 'POST') {
        if (uncertainMatch) {
          return envelope(null, code: 503, status: 503, message: '比赛提交待核实');
        }
        final item = {
          ...matches.first,
          ...body,
          'id': 'created-${matches.length}',
        };
        matches.add(item);
        return envelope(detail(item));
      }
      final search = request.url.queryParameters['search'] ?? '';
      final status = request.url.queryParameters['status'];
      final items = matches
          .where(
            (m) =>
                (m['name'] as String).contains(search) &&
                (status == null || m['status'] == status),
          )
          .toList();
      return envelope({
        'items': items,
        'total': items.length,
        'page': 1,
        'page_size': int.parse(
          request.url.queryParameters['page_size'] ?? '20',
        ),
      });
    }
    if (segments.length >= 3 && segments[1] == 'matches') {
      final item = matches.firstWhere((m) => m['id'] == segments[2]);
      if (request.method == 'GET') {
        final snapshot = jsonDecode(jsonEncode(detail(item)));
        final status = detailStatus;
        await detailBarrier?.future;
        return status == 401
            ? envelope(null, code: 401, status: 401)
            : envelope(snapshot);
      }
      item.addAll(body);
      return envelope(detail(item));
    }
    if (segments.length == 3 && segments[1] == 'team-fund') {
      fundBodies.add(body);
      final key = body['idempotency_key'] as String;
      if (_results.containsKey(key)) {
        return envelope({..._results[key]!, 'duplicated': true});
      }
      final member = members.firstWhere((m) => m['user_id'] == body['user_id']);
      final int amount;
      if (segments[2] == 'reversals') {
        final original = transactions.firstWhere(
          (t) => t['id'] == body['original_transaction_id'],
        );
        amount = -(original['amount_cents'] as int);
        original['reversed_by_transaction_id'] = transactions.length + 1;
      } else {
        amount =
            (body['amount_cents'] as int) *
            (segments[2] == 'consumptions' ? -1 : 1);
      }
      member['balance_cents'] = (member['balance_cents'] as int) + amount;
      final id = transactions.length + 1;
      transactions.add({
        'id': id,
        'team_id': body['team_id'],
        'amount_cents': amount,
        'balance_after_cents': member['balance_cents'],
        'source': segments[2] == 'credits'
            ? 'admin_credit'
            : segments[2] == 'consumptions'
            ? 'manual_consume'
            : 'manual_reversal',
        'description': body['note'],
        'created_at': instant,
        'received_on': body['received_on'],
      });
      final result = {
        'balance_cents': member['balance_cents'],
        'transaction_id': id,
        'duplicated': false,
      };
      _results[key] = result;
      if (uncertainFund) {
        return envelope(null, code: 503, message: '记账结果待确认', status: 503);
      }
      return envelope(result);
    }
    return envelope(
      null,
      code: 404,
      message: 'Fixture route missing: $path',
      status: 404,
    );
  }
}
