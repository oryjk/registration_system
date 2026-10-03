import 'dart:convert';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_error.dart';
import '../../../core/network/json_value.dart';
import '../../../core/time/beijing_time.dart';
import '../domain/fund_models.dart';
import '../domain/fund_repository.dart';

class HttpFundRepository implements FundRepository {
  HttpFundRepository(this.api);
  final ApiClient api;
  @override
  Future<FundResult> execute(PendingFundAction action) async {
    final d = action.draft,
        scope = action.scope,
        errors = action.draft.validate();
    if (errors.isNotEmpty ||
        scope.teamId <= 0 ||
        scope.userId <= 0 ||
        scope.adminId <= 0 ||
        action.key.trim().isEmpty ||
        utf8.encode(action.key).length > 64) {
      throw ApiError(
        message: errors.isEmpty ? '记账记录无效' : errors.values.first,
        kind: ApiErrorKind.validation,
      );
    }
    final route = switch (d.action) {
      FundAction.credit => 'credits',
      FundAction.consume => 'consumptions',
      FundAction.reversal => 'reversals',
    };
    final Object? raw;
    try {
      raw = await api.request(
        'POST',
        '/team-fund/$route',
        body: {
          'team_id': scope.teamId,
          'user_id': scope.userId,
          'note': d.note,
          'idempotency_key': action.key,
          if (d.action != FundAction.reversal) 'amount_cents': d.amountCents,
          if (d.action == FundAction.credit && d.receivedOn != null)
            'received_on': d.receivedOn,
          if (d.action == FundAction.reversal)
            'original_transaction_id': d.originalTransactionId,
        },
      );
    } on ApiError catch (error) {
      if (error.authoritativeValidation) throw FundRejected(error.message);
      rethrow;
    }
    return JsonValue.decode(raw, (value) {
      final j = JsonValue.object(value),
          id = JsonValue.integer(JsonValue.object(value)['transaction_id']);
      if (id <= 0) throw const FormatException();
      return FundResult(
        balanceCents: JsonValue.integer(j['balance_cents']),
        transactionId: id,
        duplicated: JsonValue.boolean(j['duplicated']),
      );
    }, uncertainWrite: true);
  }

  @override
  Future<List<FundTransaction>> transactions(
    int teamId,
    int userId, {
    int beforeId = 0,
    int limit = 30,
  }) async {
    if (teamId <= 0 ||
        userId <= 0 ||
        beforeId < 0 ||
        limit < 1 ||
        limit > 100) {
      throw const ApiError(message: '流水查询参数无效', kind: ApiErrorKind.validation);
    }
    final raw = await api.request(
      'GET',
      '/teams/$teamId/members/$userId/fund-transactions',
      query: {'before_id': '$beforeId', 'limit': '$limit'},
    );
    return JsonValue.decode(
      raw,
      (value) => JsonValue.array(value).map((row) {
        final j = JsonValue.object(row),
            date = JsonValue.nullable(j['received_on'], JsonValue.string);
        if (date != null) BeijingClock.fromDateKey(date);
        final id = JsonValue.integer(j['id']),
            mappedTeam = JsonValue.integer(j['team_id']);
        if (id <= 0 || mappedTeam != teamId) throw const FormatException();
        return FundTransaction(
          id: id,
          teamId: mappedTeam,
          amountCents: JsonValue.integer(j['amount_cents']),
          balanceAfterCents: JsonValue.integer(j['balance_after_cents']),
          source: JsonValue.string(j['source']),
          description: JsonValue.string(j['description']),
          createdAt: BeijingTime.parseInstant(
            JsonValue.string(j['created_at']),
          ),
          receivedOn: date,
          reversedByTransactionId: JsonValue.nullable(
            j['reversed_by_transaction_id'],
            JsonValue.integer,
          ),
          createdByUserId: JsonValue.nullable(
            j['created_by_user_id'],
            JsonValue.integer,
          ),
          createdByAdminId: JsonValue.nullable(
            j['created_by_admin_id'],
            JsonValue.integer,
          ),
          matchName: JsonValue.nullable(j['match_name'], JsonValue.string),
        );
      }).toList(),
    );
  }
}
