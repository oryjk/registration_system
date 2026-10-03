import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/money/money.dart';
import '../../../core/time/beijing_time.dart';
import '../../../design_system/design_system.dart';
import '../application/fund_controller.dart';
import '../domain/fund_models.dart';
import 'fund_feedback.dart';

/// Whole-page credit/consume/reversal form. Controller is composition-owned;
/// pending payload is shown separately and never populated into editable fields.
class FundFormPage extends StatefulWidget {
  const FundFormPage({
    super.key,
    required this.controller,
    required this.action,
    required this.memberName,
    required this.teamName,
    required this.balanceCents,
    this.avatarUrl,
    this.original,
    this.onSaved,
    this.loadOnStart = true,
  });
  final FundController controller;
  final FundAction action;
  final String memberName, teamName;
  final String? avatarUrl;
  final int balanceCents;
  final FundTransaction? original;
  final VoidCallback? onSaved;
  final bool loadOnStart;
  @override
  State<FundFormPage> createState() => _FundFormPageState();
}

class _FundFormPageState extends State<FundFormPage> {
  final _amount = TextEditingController(), _note = TextEditingController();
  String? _date, _amountError;
  bool _completed = false, _confirming = false;
  bool get _dirty =>
      !_completed &&
      (_amount.text.isNotEmpty || _note.text.isNotEmpty || _date != null);
  @override
  void initState() {
    super.initState();
    if (widget.loadOnStart) unawaited(widget.controller.restore());
  }

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  void _finish() {
    if (!mounted) return;
    setState(() => _completed = true);
    widget.onSaved?.call();
  }

  Future<void> _chooseDate() async {
    final today = BeijingClock.fromInstant(DateTime.now());
    final b = _date == null ? today : BeijingClock.fromDateKey(_date!);
    final date = await showDatePicker(
      context: context,
      useRootNavigator: false,
      initialDate: DateTime(b.year, b.month, b.day),
      firstDate: DateTime(1900),
      lastDate: DateTime(today.year, today.month, today.day),
    );
    if (!mounted || date == null || !widget.controller.ready || _completed) {
      return;
    }
    setState(
      () => _date = BeijingClock(date.year, date.month, date.day, 0, 0).dateKey,
    );
  }

  Future<void> _submit() async {
    final c = widget.controller;
    if (!c.ready || _completed || _confirming) return;
    int cents = 0;
    if (widget.action != FundAction.reversal) {
      try {
        cents = parseAmountCents(_amount.text);
      } on AmountValidationError {
        setState(() => _amountError = '请输入 0.01 至 10000.00 元，最多两位小数');
        return;
      }
    }
    setState(() => _amountError = null);
    final draft = FundDraft(
      action: widget.action,
      amountCents: cents,
      note: _note.text.trim(),
      receivedOn: _date,
      originalTransactionId: widget.original?.id,
    );
    final errors = draft.validate(
      today: BeijingClock.fromInstant(DateTime.now()),
    );
    if (errors.isNotEmpty) {
      await c.submit(draft);
      return;
    }
    final original = widget.original;
    _confirming = true;
    final confirmed = await confirmAction(
      context,
      title: '确认${fundActionLabel(widget.action)}？',
      message:
          '${widget.teamName} · ${widget.memberName}（用户 ${c.scope.userId}）\n'
          '${widget.action == FundAction.reversal && original != null ? '原流水 #${original.id} · ${fundInstant(original.createdAt)}\n${original.description}\n原金额 ¥${formatCents(original.amountCents)}，冲正将${original.amountCents > 0 ? '扣回' : '返还'} ¥${formatCents(original.amountCents.abs())}。历史流水仍保留。' : '${widget.action == FundAction.credit ? '已收到线下款项，登记增加' : '扣减队费'} ¥${formatCents(cents)}。${widget.action == FundAction.consume ? '允许扣成负数，负余额表示欠款。' : '此操作为记账，不发起支付。'}'}\n'
          '${_date == null ? '' : '收款日期 $_date\n'}原因/备注：${draft.note.isEmpty ? '无' : draft.note}',
    );
    _confirming = false;
    if (!mounted || !confirmed || !c.ready || _completed) return;
    if (widget.action == FundAction.reversal &&
        (original == null || !c.canReverse(original))) {
      return;
    }
    await c.submit(draft);
    if (!mounted) return;
    if (c.phase == FundPhase.confirmed && c.pending == null) _finish();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final c = widget.controller, original = widget.original;
      final enabled =
          c.ready &&
          !_completed &&
          (widget.action != FundAction.reversal ||
              (original != null && c.canReverse(original)));
      return UnsavedGuard(
        dirty: _dirty && c.pending == null,
        blocked: c.submitting,
        child: AdminScaffold(
          title: fundActionLabel(widget.action),
          bottomBar: SubmitBar(
            submitting: c.submitting,
            onSubmit: enabled ? () => unawaited(_submit()) : null,
            label: _completed
                ? '本项已完成'
                : c.pending != null
                ? '先处理待确认记账'
                : '确认${fundActionLabel(widget.action)}',
          ),
          body: LayoutBuilder(
            builder: (context, constraints) => Column(
              children: [
                FundFeedbackArea(
                  controller: c,
                  height: constraints.maxHeight,
                  onConfirmed: _finish,
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(AdminSpacing.field),
                    children: [
                      FormSection(
                        title: '记账对象',
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
                        ],
                      ),
                      const SizedBox(height: AdminSpacing.field),
                      if (widget.action == FundAction.reversal)
                        FormSection(
                          title: '原流水',
                          description: '冲正反向记账，保留原流水；不会修改会员标记。',
                          children: [
                            if (original == null)
                              const Text('缺少原流水，请返回流水列表重新选择。')
                            else ...[
                              Text(
                                '#${original.id} · ${fundInstant(original.createdAt)}',
                              ),
                              Text(original.description),
                              Text('原金额 ¥${formatCents(original.amountCents)}'),
                              Text(
                                '冲正影响：${original.amountCents > 0 ? '扣回' : '返还'} ¥${formatCents(original.amountCents.abs())}',
                              ),
                              if (!c.canReverse(original) &&
                                  c.pending == null &&
                                  !_completed)
                                const Text('原流水不存在、已冲正或不支持人工冲正，请刷新核实。'),
                              if (c.transactionsError != null)
                                Text('流水读取失败：${c.transactionsError}'),
                              if (!c.canReverse(original) &&
                                  c.pending == null &&
                                  !_completed)
                                TextButton(
                                  onPressed: c.loadingTransactions
                                      ? null
                                      : () =>
                                            unawaited(c.refreshTransactions()),
                                  child: const Text('刷新原流水'),
                                ),
                            ],
                          ],
                        ),
                      const SizedBox(height: AdminSpacing.field),
                      FormSection(
                        title: '${fundActionLabel(widget.action)}详情',
                        description: widget.action == FundAction.credit
                            ? '仅登记实际收到的线下款项。收款可更新会员及最近充值信息，以服务器结果为准。'
                            : widget.action == FundAction.consume
                            ? '允许负余额，欠款不会阻止扣费。'
                            : '填写冲正原因，便于核对原记录。',
                        children: [
                          if (widget.action != FundAction.reversal)
                            TextFormField(
                              key: const Key('fundAmount'),
                              controller: _amount,
                              enabled: enabled,
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                              decoration: InputDecoration(
                                labelText: '金额（元）',
                                helperText: '0.01 至 10000.00 元，最多两位小数',
                                errorText:
                                    _amountError ?? c.fieldErrors['amount'],
                              ),
                              onChanged: (_) => setState(() {}),
                            ),
                          if (widget.action == FundAction.credit) ...[
                            TextButton(
                              onPressed: enabled
                                  ? () => unawaited(_chooseDate())
                                  : null,
                              child: Text('收款日期：${_date ?? '按录入日期（北京时间）'}'),
                            ),
                            if (_date != null)
                              TextButton(
                                onPressed: enabled
                                    ? () => setState(() => _date = null)
                                    : null,
                                child: const Text('使用录入日期'),
                              ),
                          ],
                          TextFormField(
                            key: const Key('fundNote'),
                            controller: _note,
                            enabled: enabled,
                            minLines: 2,
                            maxLines: 4,
                            decoration: InputDecoration(
                              labelText: widget.action == FundAction.credit
                                  ? '备注（可选）'
                                  : '原因（必填）',
                              helperText: '最多 120 字节（通常 40 个汉字）',
                              errorText: c.fieldErrors['note'],
                            ),
                            onChanged: (_) => setState(() {}),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}
