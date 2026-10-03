import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/money/money.dart';
import '../../../core/time/beijing_time.dart';
import '../../../design_system/design_system.dart';
import '../application/fund_controller.dart';
import '../domain/fund_models.dart';

String fundActionLabel(FundAction action) => switch (action) {
  FundAction.credit => '收款登记',
  FundAction.consume => '消费扣费',
  FundAction.reversal => '流水冲正',
};
String fundInstant(DateTime instant) {
  final b = BeijingClock.fromInstant(instant);
  return '${b.dateKey} ${b.hour.toString().padLeft(2, '0')}:${b.minute.toString().padLeft(2, '0')}';
}

String fundBalance(int cents) =>
    cents < 0 ? '欠款 ¥${formatCents(-cents)}' : '余额 ¥${formatCents(cents)}';

/// Inline recoverable feedback, bounded by callers to keep inputs reachable.
class FundFeedback extends StatelessWidget {
  const FundFeedback({super.key, required this.controller, this.onConfirmed});
  final FundController controller;
  final VoidCallback? onConfirmed;
  Future<void> _retry() async {
    await controller.retryPending();
    if (controller.phase == FundPhase.confirmed && controller.pending == null) {
      onConfirmed?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = controller, p = c.pending, r = c.result;
    return Semantics(
      liveRegion: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (r != null) ...[
            Text(
              '记账已确认${r.duplicated ? '（原请求已记账）' : ''} · 流水 #${r.transactionId}',
            ),
            Text(fundBalance(c.balanceCents ?? r.balanceCents)),
          ],
          if (p != null) ...[
            Text(r == null ? '有一笔记账结果待确认' : '记账已确认，待确认记录清理失败'),
            Text(
              '${fundActionLabel(p.draft.action)} · ${p.draft.action == FundAction.reversal ? '原流水 #${p.draft.originalTransactionId}' : '¥${formatCents(p.draft.amountCents)}'}',
            ),
            if (p.draft.receivedOn != null) Text('收款日期 ${p.draft.receivedOn}'),
            if (p.draft.note.isNotEmpty) Text('备注：${p.draft.note}'),
            const Text('原记录已保存。请勿修改金额或另起记账；只可用原请求重试。退出登录不会删除记录，重新登录原账号后可恢复。'),
            FilledButton(
              onPressed: c.submitting ? null : () => unawaited(_retry()),
              child: const Text('重试原请求'),
            ),
          ],
          if (c.error != null)
            Text(
              '${c.error}',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          if (!c.ready && p == null && !c.submitting && r == null)
            TextButton(
              onPressed: () => unawaited(c.restore()),
              child: const Text('重新读取待确认记录'),
            ),
          if (r != null && c.transactionsError != null) ...[
            const Text('记账成功，流水刷新失败。请只刷新读取，勿重复记账。'),
            TextButton(
              onPressed: c.loadingTransactions
                  ? null
                  : () => unawaited(c.refreshTransactions()),
              child: const Text('重试读取流水'),
            ),
          ],
        ],
      ),
    );
  }
}

class FundFeedbackArea extends StatelessWidget {
  const FundFeedbackArea({
    super.key,
    required this.controller,
    required this.height,
    this.onConfirmed,
  });
  final FundController controller;
  final double height;
  final VoidCallback? onConfirmed;
  @override
  Widget build(BuildContext context) =>
      controller.pending == null &&
          controller.result == null &&
          controller.error == null
      ? const SizedBox.shrink()
      : ConstrainedBox(
          constraints: BoxConstraints(maxHeight: height / 3),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AdminSpacing.field),
            child: FundFeedback(
              controller: controller,
              onConfirmed: onConfirmed,
            ),
          ),
        );
}
