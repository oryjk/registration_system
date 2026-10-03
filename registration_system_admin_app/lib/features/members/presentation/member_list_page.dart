import 'dart:async';
import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../application/member_controller.dart';
import '../domain/member_models.dart';
import 'member_labels.dart';
import 'member_write_feedback.dart';

/// Borrows the account-scoped controller. Composition supplies real member and
/// candidate destinations, and owns disposal when the session changes.
class MemberListPage extends StatefulWidget {
  const MemberListPage({
    super.key,
    required this.controller,
    required this.onMember,
    required this.onAdd,
    this.loadOnStart = true,
  });
  final MemberController controller;
  final ValueChanged<Member> onMember;
  final VoidCallback onAdd;
  final bool loadOnStart;
  @override
  State<MemberListPage> createState() => _MemberListPageState();
}

class _MemberListPageState extends State<MemberListPage> {
  String _filter = '', _search = '';
  @override
  void initState() {
    super.initState();
    if (widget.loadOnStart) unawaited(widget.controller.load());
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final c = widget.controller;
      return UnsavedGuard(
        dirty: false,
        blocked: c.submitting,
        child: AdminScaffold(
          title: '成员管理',
          actions: [
            IconButton(
              tooltip: '刷新成员',
              onPressed: c.submitting ? null : () => unawaited(c.load()),
              icon: const Icon(Icons.refresh),
            ),
            IconButton(
              tooltip: '添加成员',
              onPressed: c.canManageTeam ? widget.onAdd : null,
              icon: const Icon(Icons.person_add_outlined),
            ),
          ],
          body: LayoutBuilder(
            builder: (context, constraints) => Column(
              children: [
                MemberFeedbackArea(
                  controller: c,
                  height: constraints.maxHeight,
                ),
                Expanded(
                  child: AsyncContent<MemberManagement>(
                    state: c.state,
                    retry: () => unawaited(c.load()),
                    builder: (context, data) {
                      final members = data.members
                          .where(
                            (m) =>
                                (_filter.isEmpty || m.status == _filter) &&
                                '${m.nickname} ${m.realName ?? ''} ${m.phoneNumber ?? ''} ${m.userId}'
                                    .toLowerCase()
                                    .contains(_search.toLowerCase()),
                          )
                          .toList();
                      return RefreshIndicator(
                        onRefresh: c.load,
                        child: ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(AdminSpacing.field),
                          children: [
                            Text(
                              data.team.name,
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                            const SizedBox(height: AdminSpacing.field),
                            TextField(
                              decoration: const InputDecoration(
                                labelText: '搜索已加载成员',
                                hintText: '姓名、昵称、电话或用户编号',
                              ),
                              onChanged: (s) =>
                                  setState(() => _search = s.trim()),
                            ),
                            const SizedBox(height: AdminSpacing.label),
                            Wrap(
                              spacing: AdminSpacing.label,
                              runSpacing: AdminSpacing.label,
                              children: [
                                for (final status in ['', ...Member.statuses])
                                  ChoiceChip(
                                    label: Text(
                                      status.isEmpty
                                          ? '全部'
                                          : memberStatusLabel(status),
                                    ),
                                    selected: _filter == status,
                                    onSelected: (_) =>
                                        setState(() => _filter = status),
                                    materialTapTargetSize:
                                        MaterialTapTargetSize.padded,
                                  ),
                              ],
                            ),
                            if (!data.team.canManage)
                              const Text('球队状态仅供查看，不能修改成员。'),
                            if (members.isEmpty)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: AdminSpacing.section,
                                ),
                                child: Text(
                                  data.members.isEmpty
                                      ? '暂无成员，可从真实球员查询中添加'
                                      : '当前筛选没有成员',
                                ),
                              ),
                            for (final m in members) ...[
                              const SizedBox(height: AdminSpacing.field),
                              Card(
                                child: Padding(
                                  padding: const EdgeInsets.all(
                                    AdminSpacing.field,
                                  ),
                                  child: PersonRow(
                                    name: m.displayName,
                                    avatarUrl: m.avatarUrl,
                                    subtitle:
                                        '用户 ${m.userId} · ${m.phoneNumber ?? '电话未提供'}',
                                    onTap: c.submitting
                                        ? null
                                        : () => widget.onMember(m),
                                    details: [
                                      Wrap(
                                        spacing: AdminSpacing.label,
                                        runSpacing: AdminSpacing.label,
                                        children: [
                                          StatusBadge(
                                            text: memberRoleLabel(m.role),
                                          ),
                                          StatusBadge(
                                            text: memberStatusLabel(m.status),
                                            tone: memberStatusTone(m.status),
                                          ),
                                          StatusBadge(
                                            text: m.isPaidMember
                                                ? '付费会员'
                                                : '非付费会员',
                                            tone: m.isPaidMember
                                                ? StatusTone.info
                                                : StatusTone.neutral,
                                          ),
                                        ],
                                      ),
                                      Text(
                                        memberBalance(m.balanceCents),
                                        style: TextStyle(
                                          color: m.balanceCents < 0
                                              ? Theme.of(
                                                  context,
                                                ).colorScheme.error
                                              : null,
                                        ),
                                      ),
                                      Text(
                                        m.lastRechargeAt == null
                                            ? '最近充值：未记录'
                                            : '最近充值：${memberInstant(m.lastRechargeAt!)}',
                                        style: Theme.of(
                                          context,
                                        ).textTheme.bodySmall,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    },
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
