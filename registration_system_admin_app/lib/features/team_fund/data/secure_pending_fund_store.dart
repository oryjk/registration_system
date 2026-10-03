import 'dart:convert';
import '../../../core/storage/secure_store.dart';
import '../../../core/time/beijing_time.dart';
import '../domain/fund_models.dart';
import '../domain/fund_repository.dart';

/// AppDependencies owns one shared instance. Serializes only each fund scope,
/// including compare/delete, so an old cleanup cannot erase a newer action.
class SecurePendingFundStore implements PendingFundStore {
  SecurePendingFundStore(this.storage);
  final SecureStore storage;
  final _tails = <FundScope, Future<void>>{};

  Future<T> _serial<T>(FundScope scope, Future<T> Function() operation) {
    final previous = _tails[scope] ?? Future<void>.value();
    final result = previous.then((_) => operation());
    final tail = result.then<void>(
      (_) {},
      onError: (Object _, StackTrace _) {},
    );
    _tails[scope] = tail;
    tail.then((_) {
      if (identical(_tails[scope], tail)) _tails.remove(scope);
    });
    return result;
  }

  String _storageKey(FundScope scope) =>
      'admin_app.fund.pending.v1.${base64Url.encode(utf8.encode(jsonEncode([scope.environment.toString(), scope.adminId, scope.teamId, scope.userId])))}';

  @override
  Future<PendingFundAction?> read(FundScope scope) =>
      _serial(scope, () => _read(scope));

  Future<PendingFundAction?> _read(FundScope scope) async {
    final raw = await storage.read(_storageKey(scope));
    if (raw == null) return null;
    try {
      final root = jsonDecode(raw);
      if (root is! Map<String, dynamic> ||
          root['schema'] is! int ||
          root['schema'] != 1) {
        throw const FormatException();
      }
      final savedScope = root['scope'];
      if (savedScope is! List ||
          savedScope.length != 4 ||
          savedScope[0] is! String ||
          savedScope[1] is! int ||
          savedScope[2] is! int ||
          savedScope[3] is! int ||
          savedScope[0] != scope.environment.toString() ||
          savedScope[1] != scope.adminId ||
          savedScope[2] != scope.teamId ||
          savedScope[3] != scope.userId) {
        throw const FormatException();
      }
      final data = root['draft'];
      if (data is! Map<String, dynamic> ||
          data['action'] is! String ||
          data['amountCents'] is! int ||
          data['note'] is! String ||
          (data['receivedOn'] != null && data['receivedOn'] is! String) ||
          (data['originalTransactionId'] != null &&
              data['originalTransactionId'] is! int)) {
        throw const FormatException();
      }
      final draft = FundDraft(
        action: FundAction.values.byName(data['action']),
        amountCents: data['amountCents'],
        note: data['note'],
        receivedOn: data['receivedOn'],
        originalTransactionId: data['originalTransactionId'],
      );
      final key = root['key'];
      if (draft.validate().isNotEmpty ||
          key is! String ||
          key.trim().isEmpty ||
          utf8.encode(key).length > 64 ||
          root['createdAt'] is! String) {
        throw const FormatException();
      }
      return PendingFundAction(
        scope: scope,
        draft: draft,
        key: key,
        createdAt: BeijingTime.parseInstant(root['createdAt']),
      );
    } on Object {
      throw StateError('待确认记账记录无法读取，请核查安全存储后再操作；原记录已保留');
    }
  }

  @override
  Future<void> save(PendingFundAction action) =>
      _serial(action.scope, () async {
        final existing = await _read(action.scope);
        if (existing != null) {
          if (existing.key != action.key ||
              existing.draft != action.draft ||
              existing.createdAt != action.createdAt) {
            throw StateError('此成员已有另一笔待确认记账，请先处理原记录');
          }
          return;
        }
        if (action.scope.adminId <= 0 ||
            action.scope.teamId <= 0 ||
            action.scope.userId <= 0 ||
            action.draft.validate().isNotEmpty ||
            action.key.trim().isEmpty ||
            utf8.encode(action.key).length > 64) {
          throw StateError('记账记录无效');
        }
        await storage.write(
          _storageKey(action.scope),
          jsonEncode({
            'schema': 1,
            'scope': [
              action.scope.environment.toString(),
              action.scope.adminId,
              action.scope.teamId,
              action.scope.userId,
            ],
            'draft': {
              'action': action.draft.action.name,
              'amountCents': action.draft.amountCents,
              'note': action.draft.note,
              'receivedOn': action.draft.receivedOn,
              'originalTransactionId': action.draft.originalTransactionId,
            },
            'key': action.key,
            'createdAt': action.createdAt.toUtc().toIso8601String(),
          }),
        );
      });

  @override
  Future<void> remove(FundScope scope, {String? expectedKey}) =>
      _serial(scope, () async {
        final existing = await _read(scope);
        if (existing == null) return;
        if (expectedKey != null && existing.key != expectedKey) {
          throw StateError('已有新的待确认记录，不能清理另一笔记账');
        }
        await storage.delete(_storageKey(scope));
      });
}
