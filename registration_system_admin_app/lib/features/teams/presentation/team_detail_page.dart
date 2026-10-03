import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/time/beijing_time.dart';
import '../../../design_system/design_system.dart';
import '../application/team_controller.dart';
import '../domain/team.dart';
import 'team_card.dart';
import 'team_join_password_panel.dart';
import 'team_write_feedback.dart';

/// Borrows controller. Composition supplies real navigation callbacks only;
/// absent members/fund/related callbacks render no unavailable feature buttons.
class TeamDetailPage extends StatefulWidget {
  const TeamDetailPage({
    super.key,
    required this.controller,
    required this.id,
    required this.onEdit,
    this.onMembers,
    this.onFund,
    this.onRelated,
    this.onDeleted,
    this.loadOnStart = true,
  });
  final TeamController controller;
  final int id;
  final ValueChanged<Team> onEdit;
  final ValueChanged<Team>? onMembers, onFund, onRelated;
  final VoidCallback? onDeleted;
  final bool loadOnStart;
  @override
  State<TeamDetailPage> createState() => _TeamDetailPageState();
}

class _TeamDetailPageState extends State<TeamDetailPage> {
  bool _passwordDirty = false;
  @override
  void initState() {
    super.initState();
    if (widget.loadOnStart) unawaited(widget.controller.load(widget.id));
  }

  Future<void> _delete(Team team) async {
    final confirmed = await confirmAction(
      context,
      title: '删除球队？',
      message:
          '删除“${team.name}”（编号 ${team.id}）后，该球队将从管理列表移除。有比赛或申请记录的球队需先解散；已有历史记录会保留。此操作无法从本页面撤销。',
    );
    if (!mounted || !confirmed) return;
    await widget.controller.delete(team.id);
    if (!mounted) return;
    if (widget.controller.writeSucceeded &&
        widget.controller.deletedId == team.id) {
      widget.onDeleted?.call();
    }
  }

  String _instant(DateTime date) {
    final b = BeijingClock.fromInstant(date);
    return '${b.dateKey} ${b.hour.toString().padLeft(2, '0')}:${b.minute.toString().padLeft(2, '0')}（北京时间）';
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final c = widget.controller;
      final team = c.detailState.data;
      final enabled = c.canManage(widget.id);
      return UnsavedGuard(
        blocked: c.submitting,
        dirty: _passwordDirty && !c.missing && c.deletedId != widget.id,
        child: AdminScaffold(
          title: '球队详情',
          actions: [
            IconButton(
              onPressed: c.submitting
                  ? null
                  : () => unawaited(c.load(widget.id)),
              tooltip: '刷新球队详情',
              icon: const Icon(Icons.refresh),
            ),
            if (team != null && team.canManage)
              PopupMenuButton<String>(
                tooltip: '更多球队操作',
                enabled: enabled,
                onSelected: (_) => unawaited(_delete(team)),
                itemBuilder: (_) => [
                  const PopupMenuItem(value: 'delete', child: Text('删除球队')),
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
                      child: TeamWriteFeedback(controller: c),
                    ),
                  ),
                Expanded(
                  child: c.deletedId == widget.id
                      ? Center(
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.all(AdminSpacing.field),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text('球队已删除'),
                                TextButton(
                                  onPressed: () =>
                                      Navigator.of(context).maybePop(),
                                  child: const Text('返回球队列表'),
                                ),
                              ],
                            ),
                          ),
                        )
                      : c.missing
                      ? Center(
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.all(AdminSpacing.field),
                            child: Column(
                              children: [
                                const Text('球队不存在或已删除，请返回列表刷新。'),
                                TextButton(
                                  onPressed: () =>
                                      Navigator.of(context).maybePop(),
                                  child: const Text('返回球队列表'),
                                ),
                              ],
                            ),
                          ),
                        )
                      : AsyncContent<Team>(
                          state: c.detailState,
                          retry: () => unawaited(c.load(widget.id)),
                          builder: (context, team) => RefreshIndicator(
                            onRefresh: () => c.load(widget.id),
                            child: ListView(
                              padding: const EdgeInsets.all(AdminSpacing.field),
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: [
                                FormSection(
                                  title: '球队资料',
                                  children: [
                                    if (c.detailState.error != null)
                                      const Text('详情刷新失败，当前显示上次加载的数据。'),
                                    TeamLogo(team: team),
                                    Text(
                                      team.name,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.headlineSmall,
                                    ),
                                    Align(
                                      alignment: Alignment.centerLeft,
                                      child: StatusBadge(
                                        text: teamStatusLabel(team.status),
                                        tone: teamStatusTone(team.status),
                                      ),
                                    ),
                                    Text(
                                      team.description?.isNotEmpty == true
                                          ? team.description!
                                          : '暂无球队介绍',
                                    ),
                                    Text(
                                      '队长：${team.captain?.realName?.trim().isNotEmpty == true ? team.captain!.realName! : team.captain?.nickname ?? (team.captainId == null ? '未任命' : '资料未提供')}',
                                    ),
                                    if (team.memberCount != null)
                                      Text(
                                        '${team.memberCount} 位成员（含停用，不含已移除）',
                                      ),
                                    Text(
                                      '编号：${team.id}',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                    Text(
                                      '创建：${_instant(team.createdAt)}',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                    Text(
                                      '更新：${_instant(team.updatedAt)}',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                    if (!team.canManage)
                                      const Text('当前状态仅供查看，不能修改、删除或设置密码。'),
                                    if (team.canManage)
                                      FilledButton(
                                        onPressed: enabled
                                            ? () => widget.onEdit(team)
                                            : null,
                                        child: const Text('编辑球队'),
                                      ),
                                    if (widget.onMembers != null)
                                      TextButton(
                                        onPressed: c.submitting
                                            ? null
                                            : () => widget.onMembers!(team),
                                        child: const Text('成员管理'),
                                      ),
                                    if (widget.onFund != null)
                                      TextButton(
                                        onPressed: c.submitting
                                            ? null
                                            : () => widget.onFund!(team),
                                        child: const Text('球队队费'),
                                      ),
                                    if (widget.onRelated != null)
                                      TextButton(
                                        onPressed: c.submitting
                                            ? null
                                            : () => widget.onRelated!(team),
                                        child: const Text('相关比赛'),
                                      ),
                                  ],
                                ),
                                if (team.canManage) ...[
                                  const SizedBox(height: AdminSpacing.section),
                                  TeamJoinPasswordPanel(
                                    controller: c,
                                    team: team,
                                    onDirtyChanged: (dirty) =>
                                        setState(() => _passwordDirty = dirty),
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
