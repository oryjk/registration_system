import 'dart:convert';
import '../../../core/network/environment_identity.dart';
import '../../../core/time/beijing_time.dart';

enum FundAction { credit, consume, reversal }

class FundScope {
  FundScope(Uri environment, this.adminId, this.teamId, this.userId)
    : environment = Uri.parse(normalizeEnvironment(environment));
  final Uri environment;
  final int adminId, teamId, userId;
  @override
  bool operator ==(Object other) =>
      other is FundScope &&
      environment == other.environment &&
      adminId == other.adminId &&
      teamId == other.teamId &&
      userId == other.userId;
  @override
  int get hashCode => Object.hash(environment, adminId, teamId, userId);
}

class FundDraft {
  const FundDraft({
    required this.action,
    this.amountCents = 0,
    this.note = '',
    this.receivedOn,
    this.originalTransactionId,
  });
  final FundAction action;
  final int amountCents;
  final String note;
  final String? receivedOn;
  final int? originalTransactionId;
  Map<String, String> validate() {
    final errors = <String, String>{};
    if (action != FundAction.reversal &&
        (amountCents < 1 || amountCents > 1000000)) {
      errors['amount'] = '请输入 0.01 至 10000.00 元';
    }
    if (action != FundAction.credit && note.trim().isEmpty) {
      errors['note'] = '请填写原因';
    }
    // Go validates credit before trimming; consume/reversal trim first.
    final validatedNote = action == FundAction.credit ? note : note.trim();
    if (utf8.encode(validatedNote).length > 120) {
      errors['note'] = '备注最多 120 字节（通常 40 个汉字）';
    }
    if (action == FundAction.reversal &&
        (originalTransactionId == null ||
            originalTransactionId! <= 0 ||
            amountCents != 0 ||
            receivedOn != null)) {
      errors['original'] = '原流水无效';
    }
    if (action != FundAction.reversal && originalTransactionId != null) {
      errors['original'] = '此操作不能关联原流水';
    }
    if (action != FundAction.credit && receivedOn != null) {
      errors['date'] = '只有收款可填写收款日期';
    }
    if (receivedOn != null) {
      try {
        BeijingClock.fromDateKey(receivedOn!);
      } on Object {
        errors['date'] = '请输入有效的 YYYY-MM-DD 日期';
      }
    }
    return errors;
  }

  @override
  bool operator ==(Object other) =>
      other is FundDraft &&
      action == other.action &&
      amountCents == other.amountCents &&
      note == other.note &&
      receivedOn == other.receivedOn &&
      originalTransactionId == other.originalTransactionId;
  @override
  int get hashCode =>
      Object.hash(action, amountCents, note, receivedOn, originalTransactionId);
}

class PendingFundAction {
  const PendingFundAction({
    required this.scope,
    required this.draft,
    required this.key,
    required this.createdAt,
  });
  final FundScope scope;
  final FundDraft draft;
  final String key;
  final DateTime createdAt;
}

class FundResult {
  const FundResult({
    required this.balanceCents,
    required this.transactionId,
    required this.duplicated,
  });
  final int balanceCents, transactionId;
  final bool duplicated;
}

class FundTransaction {
  const FundTransaction({
    required this.id,
    required this.teamId,
    required this.amountCents,
    required this.balanceAfterCents,
    required this.source,
    required this.description,
    required this.createdAt,
    this.receivedOn,
    this.reversedByTransactionId,
    this.createdByUserId,
    this.createdByAdminId,
    this.matchName,
  });
  final int id, teamId, amountCents, balanceAfterCents;
  final String source, description;
  final DateTime createdAt;
  final String? receivedOn, matchName;
  final int? reversedByTransactionId, createdByUserId, createdByAdminId;
  bool get canReverse =>
      reversedByTransactionId == null &&
      const {
        'admin_credit',
        'manual_consume',
        'manual_adjustment',
      }.contains(source);
}
