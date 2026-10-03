import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/money/money.dart';
import '../../../core/network/api_error.dart';
import '../../../core/state/resource_changes.dart';
import '../../../design_system/design_system.dart';
import '../application/match_detail_controller.dart';
import '../domain/match_models.dart';
import 'match_card.dart';
import 'match_score_panel.dart';
import 'registration_roster.dart';

/// Borrows a detail controller. Optional callbacks are real composition routes.
class MatchDetailPage extends StatefulWidget {
  const MatchDetailPage({
    super.key,
    required this.controller,
    required this.onEdit,
    this.onDeleted,
    this.onReturnToList,
    this.changes,
    this.loadOnStart = true,
  });
  final MatchDetailController controller;
  final ValueChanged<MatchDetail> onEdit;
  final VoidCallback? onDeleted, onReturnToList;
  final ResourceChanges? changes;
  final bool loadOnStart;
  @override
  State<MatchDetailPage> createState() => _MatchDetailPageState();
}

class _MatchDetailPageState extends State<MatchDetailPage> {
  StreamSubscription<ResourceChange>? _subscription;
  bool _scoreDirty = false, _deletedReported = false;
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_checkDeleted);
    if (widget.loadOnStart) unawaited(widget.controller.load());
    _subscription = widget.changes?.stream.listen((e) {
      if (e.kind == ResourceKind.matches) unawaited(widget.controller.load());
    });
  }

  void _checkDeleted() {
    if (widget.controller.deleted && !_deletedReported) {
      _deletedReported = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onDeleted?.call();
      });
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_checkDeleted);
    _subscription?.cancel();
    super.dispose();
  }

  void _return() {
    if (widget.onReturnToList != null) {
      widget.onReturnToList!();
    } else {
      Navigator.of(context).maybePop();
    }
  }

  Future<void> _status(MatchItem m, String target) async {
    final yes = await confirmAction(
      context,
      title: '${_actionLabel(target)}？',
      message:
          '将“${m.name}”（编号 ${m.id}）从${m.statusLabel}改为${matchStatusLabel(target)}。${target == 'cancelled' ? '取消后不能从此页面恢复，请确认通知安排。' : ''}',
    );
    if (mounted && yes) await widget.controller.changeStatus(target);
  }

  Future<void> _delete(MatchItem m) async {
    final yes = await confirmAction(
      context,
      title: '删除比赛？',
      message: '删除“${m.name}”（编号 ${m.id}）及相关报名信息。此操作无法从本页面撤销。',
    );
    if (mounted && yes) await widget.controller.delete();
  }

  String _actionLabel(String s) => switch (s) {
    'ongoing' => '开始比赛',
    'ended' => '结束比赛',
    'cancelled' => '取消比赛',
    _ => matchStatusLabel(s),
  };
  bool _missing(Object? error) =>
      error is ApiError &&
      (error.httpStatus == 404 ||
          (error.httpStatus != null &&
              error.httpStatus! >= 200 &&
              error.httpStatus! < 300 &&
              error.code == 404));
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final c = widget.controller;
      final detail = c.state.data;
      final missing = _missing(c.state.error);
      final locked =
          c.submitting ||
          c.writeOutcomeUncertain ||
          c.deleted ||
          missing ||
          (c.writeSucceeded && c.state.error != null);
      return UnsavedGuard(
        blocked: c.submitting,
        dirty: _scoreDirty && !c.deleted && !missing,
        child: AdminScaffold(
          title: '比赛详情',
          actions: [
            IconButton(
              onPressed: c.submitting || c.deleted
                  ? null
                  : () => unawaited(c.load()),
              tooltip: '刷新比赛详情',
              icon: const Icon(Icons.refresh),
            ),
            if (!missing && c.canDelete)
              PopupMenuButton<String>(
                tooltip: '更多比赛操作',
                enabled: !locked,
                onSelected: (_) => unawaited(_delete(detail!.match)),
                itemBuilder: (_) => [
                  const PopupMenuItem(value: 'delete', child: Text('删除比赛')),
                ],
              ),
          ],
          body: LayoutBuilder(
            builder: (context, constraints) => Column(
              children: [
                if (c.writeSucceeded ||
                    c.writeError != null ||
                    c.writeOutcomeUncertain)
                  ConstrainedBox(
                    constraints: BoxConstraints(
                      maxHeight: constraints.maxHeight / 3,
                    ),
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(AdminSpacing.field),
                      child: Semantics(
                        liveRegion: true,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (c.writeSucceeded)
                              Text(
                                c.state.error != null
                                    ? '操作成功，数据刷新失败。请重试读取，勿重复操作。'
                                    : '操作成功',
                              ),
                            if (c.writeOutcomeUncertain)
                              const Text(
                                MatchDetailController.uncertainGuidance,
                              )
                            else if (c.writeError != null)
                              Text('操作失败：${c.writeError}'),
                            if (c.writeOutcomeUncertain ||
                                (c.writeSucceeded && c.state.error != null))
                              TextButton(
                                onPressed: c.submitting
                                    ? null
                                    : () => unawaited(c.load()),
                                child: const Text('重试读取详情'),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                Expanded(
                  child: c.deleted || missing
                      ? Center(
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.all(AdminSpacing.field),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  c.deleted ? '比赛已删除' : '比赛不存在或已删除，请返回列表刷新。',
                                ),
                                TextButton(
                                  onPressed: _return,
                                  child: const Text('返回比赛列表'),
                                ),
                                if (missing)
                                  TextButton(
                                    onPressed: () => unawaited(c.load()),
                                    child: const Text('重试读取详情'),
                                  ),
                              ],
                            ),
                          ),
                        )
                      : AsyncContent<MatchDetail>(
                          state: c.state,
                          retry: () => unawaited(c.load()),
                          builder: (context, d) => RefreshIndicator(
                            onRefresh: c.load,
                            child: ListView(
                              padding: const EdgeInsets.all(AdminSpacing.field),
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: [
                                FormSection(
                                  title: '比赛信息',
                                  children: [
                                    Text(
                                      d.match.name,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.headlineSmall,
                                    ),
                                    Wrap(
                                      spacing: AdminSpacing.label,
                                      runSpacing: AdminSpacing.label,
                                      children: [
                                        StatusBadge(
                                          text: d.match.statusLabel,
                                          tone: matchStatusTone(d.match.status),
                                        ),
                                        StatusBadge(
                                          text: d.match.publicationModeLabel,
                                        ),
                                      ],
                                    ),
                                    Text(matchTeams(d.match)),
                                    Text(
                                      matchScore(d.match),
                                      style: Theme.of(
                                        context,
                                      ).textTheme.headlineSmall,
                                    ),
                                    Text(
                                      '开始：${matchInstant(d.match.startTime)}',
                                    ),
                                    Text('结束：${matchInstant(d.match.endTime)}'),
                                    Text('场地：${d.match.location}'),
                                    Text('每队 ${d.match.playersPerTeam} 人'),
                                    Text('对手：${d.match.opponentStateLabel}'),
                                    if (d.match.description?.isNotEmpty == true)
                                      Text(d.match.description!),
                                    Text(
                                      '编号：${d.match.id}',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                    if (!d.match.hasKnownRules)
                                      const Text('当前状态或规则尚未支持，仅供查看。'),
                                    if (d.match.canEdit)
                                      FilledButton(
                                        onPressed: locked
                                            ? null
                                            : () => widget.onEdit(d),
                                        child: const Text('编辑比赛'),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: AdminSpacing.section),
                                FormSection(
                                  title: '报名与收费',
                                  description: '收费设置仅展示，编辑保留原值。',
                                  children: [
                                    Text(
                                      '报名开始：${d.match.registrationStartAt == null ? '未设置' : matchInstant(d.match.registrationStartAt!)}',
                                    ),
                                    Text(
                                      '报名截止：${d.match.registrationEndAt == null ? '未设置' : matchInstant(d.match.registrationEndAt!)}',
                                    ),
                                    Text(
                                      '收费方式：${enumLabel(d.match.feeType ?? '', const {'': '未指定', 'free': '免费', 'offline_aa': '线下 AA', 'fixed_amount': '固定金额', 'team_fund': '球队队费'})}',
                                    ),
                                    Text(
                                      '支付模式：${enumLabel(d.match.paymentMode, const {'prepaid': '预付', 'postpaid': '后付'})}',
                                    ),
                                    Text(
                                      '每人费用：¥${formatCents(d.match.feePerPersonCents)}',
                                    ),
                                    Text(d.match.isFree ? '免费比赛' : '非免费比赛'),
                                  ],
                                ),
                                for (final group in d.groups) ...[
                                  const SizedBox(height: AdminSpacing.section),
                                  RegistrationRoster(group: group),
                                ],
                                if (d.groups.isEmpty) ...[
                                  const SizedBox(height: AdminSpacing.field),
                                  const Text('暂无报名分组'),
                                ],
                                if (d.match.canRecordScore) ...[
                                  const SizedBox(height: AdminSpacing.section),
                                  MatchScorePanel(
                                    key: ValueKey('score-${d.match.id}'),
                                    match: d.match,
                                    enabled: !locked,
                                    onSave: c.saveScore,
                                    onDirtyChanged: (dirty) =>
                                        setState(() => _scoreDirty = dirty),
                                  ),
                                ],
                                if (d.match.allowedNextStatuses.isNotEmpty) ...[
                                  const SizedBox(height: AdminSpacing.section),
                                  FormSection(
                                    title: '比赛状态',
                                    children: [
                                      for (final s
                                          in d.match.allowedNextStatuses)
                                        TextButton(
                                          onPressed: locked
                                              ? null
                                              : () => unawaited(
                                                  _status(d.match, s),
                                                ),
                                          child: Text(_actionLabel(s)),
                                        ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
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
