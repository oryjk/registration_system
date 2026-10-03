import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/money/money.dart';
import '../../../design_system/design_system.dart';
import '../application/fund_controller.dart';
import '../domain/fund_models.dart';
import 'fund_feedback.dart';

class FundTransactionsPage extends StatefulWidget {
  const FundTransactionsPage({
    super.key,
    required this.controller,
    required this.memberName,
    required this.teamName,
    required this.balanceCents,
    this.avatarUrl,
    this.onCredit,
    this.onConsume,
    this.onReverse,
    this.loadOnStart = true,
  });
  final FundController controller;
  final String memberName, teamName;
  final String? avatarUrl;
  final int balanceCents;
  final VoidCallback? onCredit, onConsume;
  final ValueChanged<FundTransaction>? onReverse;
  final bool loadOnStart;
  @override
  State<FundTransactionsPage> createState() => _FundTransactionsPageState();
}

class _FundTransactionsPageState extends State<FundTransactionsPage> {
  @override
  void initState() {
    super.initState();
    if (widget.loadOnStart) unawaited(_load());
  }

  Future<void> _load() async {
    await widget.controller.restore();
    if (mounted) await widget.controller.refreshTransactions();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final c = widget.controller;
      return AdminScaffold(
        title: '队费流水',
        body: LayoutBuilder(
          builder: (context, constraints) => Column(
            children: [
              FundFeedbackArea(controller: c, height: constraints.maxHeight),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: c.refreshTransactions,
                  child: ListView(
                    padding: const EdgeInsets.all(AdminSpacing.field),
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      FormSection(
                        title: '成员队费',
                        children: [
                          PersonRow(
                            name: widget.memberName,
                            avatarUrl: widget.avatarUrl,
                            subtitle:
                                '${widget.teamName} · 用户 ${c.scope.userId}',
                            details: [
                              Text(
                                fundBalance(
                                  c.balanceCents ?? widget.balanceCents,
                                ),
                              ),
                            ],
                          ),
                          if (widget.onCredit != null)
                            FilledButton(
                              onPressed: c.ready ? widget.onCredit : null,
                              child: const Text('登记收款'),
                            ),
                          if (widget.onConsume != null)
                            TextButton(
                              onPressed: c.ready ? widget.onConsume : null,
                              child: const Text('消费扣费'),
                            ),
                        ],
                      ),
                      const SizedBox(height: AdminSpacing.field),
                      if (c.transactionsError != null) ...[
                        Text('流水读取失败：${c.transactionsError}'),
                        TextButton(
                          onPressed: c.loadingTransactions
                              ? null
                              : () => unawaited(c.refreshTransactions()),
                          child: const Text('重试读取流水'),
                        ),
                      ],
                      if (c.transactions.isEmpty &&
                          !c.loadingTransactions &&
                          c.transactionsError == null)
                        const Text('暂无队费流水'),
                      for (final t in c.transactions)
                        Padding(
                          padding: const EdgeInsets.only(
                            bottom: AdminSpacing.field,
                          ),
                          child: FormSection(
                            title:
                                '${t.amountCents > 0 ? '+' : ''}¥${formatCents(t.amountCents)} · #${t.id}',
                            children: [
                              Text(
                                t.description.isEmpty ? '无备注' : t.description,
                              ),
                              Text(fundInstant(t.createdAt)),
                              if (t.receivedOn != null)
                                Text('收款日期 ${t.receivedOn}'),
                              Text('记账后${fundBalance(t.balanceAfterCents)}'),
                              Text('来源：${_sourceLabel(t.source)}'),
                              if (t.matchName != null)
                                Text('比赛：${t.matchName}'),
                              Text(
                                t.createdByAdminId != null
                                    ? '管理员 ${t.createdByAdminId}'
                                    : t.createdByUserId != null
                                    ? '用户 ${t.createdByUserId}'
                                    : '历史记录 · 操作人未记录',
                              ),
                              if (t.reversedByTransactionId != null)
                                Text(
                                  '已冲正 · 冲正流水 #${t.reversedByTransactionId}',
                                ),
                              if (t.canReverse && widget.onReverse != null)
                                TextButton(
                                  onPressed: c.canReverse(t)
                                      ? () => widget.onReverse!(t)
                                      : null,
                                  child: const Text('冲正此流水'),
                                ),
                            ],
                          ),
                        ),
                      if (c.loadingTransactions)
                        const Center(child: CircularProgressIndicator()),
                      if (c.hasMoreTransactions &&
                          !c.loadingTransactions &&
                          c.transactionsError == null)
                        TextButton(
                          onPressed: c.submitting
                              ? null
                              : () => unawaited(c.loadMoreTransactions()),
                          child: const Text('加载更多流水'),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

String _sourceLabel(String source) => switch (source) {
  'admin_credit' => '人工收款',
  'manual_consume' => '人工消费',
  'manual_adjustment' => '人工调整',
  'manual_reversal' => '人工冲正',
  'match_settlement' => '比赛结算',
  'settlement_reversal' => '结算冲正',
  _ => '其他（$source）',
};
