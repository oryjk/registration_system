import 'dart:async';
import 'package:registration_system_admin_app/core/storage/secure_store.dart';
import 'package:registration_system_admin_app/features/team_fund/domain/fund_models.dart';
import 'package:registration_system_admin_app/features/team_fund/domain/fund_repository.dart';

final scope = FundScope(Uri.parse('https://example.test/regist-v3'), 1, 42, 7);
const draft = FundDraft(
  action: FundAction.credit,
  amountCents: 2900,
  note: '线下款',
  receivedOn: '2026-10-03',
);
PendingFundAction action({
  String key = 'original',
  FundScope? target,
  FundDraft value = draft,
}) => PendingFundAction(
  scope: target ?? scope,
  draft: value,
  key: key,
  createdAt: DateTime.utc(2026, 10, 3),
);

class MemorySecureStore implements SecureStore {
  final values = <String, String>{};
  bool failWrite = false,
      failDelete = false,
      partialDelete = false,
      partialWrite = false;
  Completer<void>? writeGate, readGate;
  bool failRead = false;
  @override
  Future<String?> read(String key) async {
    if (readGate != null) await readGate!.future;
    if (failRead) throw StateError('storage read');
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    if (writeGate != null) await writeGate!.future;
    if (partialWrite) values[key] = value;
    if (failWrite) throw StateError('storage write');
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    if (partialDelete) values.remove(key);
    if (failDelete) throw StateError('storage delete');
    values.remove(key);
  }
}

class FakeFunds implements FundRepository {
  final calls = <PendingFundAction>[];
  final cursors = <int>[];
  Object? failure, readFailure;
  Completer<FundResult>? executeGate;
  final pages = <List<FundTransaction>>[];
  final readGates = <Completer<List<FundTransaction>>>[];
  @override
  Future<FundResult> execute(PendingFundAction action) async {
    calls.add(action);
    if (failure != null) throw failure!;
    if (executeGate != null) return executeGate!.future;
    return const FundResult(
      balanceCents: -120,
      transactionId: 99,
      duplicated: true,
    );
  }

  @override
  Future<List<FundTransaction>> transactions(
    int teamId,
    int userId, {
    int beforeId = 0,
    int limit = 30,
  }) async {
    cursors.add(beforeId);
    if (readFailure != null) throw readFailure!;
    if (readGates.isNotEmpty) return readGates.removeAt(0).future;
    return pages.isEmpty ? [] : pages.removeAt(0);
  }
}

FundTransaction transaction(
  int id, {
  String source = 'admin_credit',
  int? reversed,
}) => FundTransaction(
  id: id,
  teamId: 42,
  amountCents: 2900,
  balanceAfterCents: 2900,
  source: source,
  description: '收款',
  createdAt: DateTime.utc(2026, 10, 3),
  reversedByTransactionId: reversed,
);
