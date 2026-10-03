import 'dart:async';
import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../application/member_controller.dart';
import '../domain/member_models.dart';
import 'member_labels.dart';
import 'member_write_feedback.dart';

/// Borrowed controller; reads current membership by user ID after each refresh.
/// Fund is shown only when composition supplies its real destination.
class MemberDetailPage extends StatefulWidget {
  const MemberDetailPage({
    super.key,
    required this.controller,
    required this.userId,
    required this.onEditMember,
    required this.onEditProfile,
    this.onFund,
    this.onRemoved,
  });
  final MemberController controller;
  final int userId;
  final ValueChanged<Member> onEditMember, onEditProfile;
  final ValueChanged<Member>? onFund;
  final VoidCallback? onRemoved;
  @override
  State<MemberDetailPage> createState() => _MemberDetailPageState();
}

class _MemberDetailPageState extends State<MemberDetailPage> {
  Future<void> _confirm(Member member, MemberWriteAction action) async {
    final c = widget.controller;
    final team = c.state.data!.team;
    final captain = c.isCaptain(member);
    final title = switch (action) {
      MemberWriteAction.remove => '移除成员？',
      MemberWriteAction.captain => captain ? '取消队长？' : '任命队长？',
      _ => member.isPaidMember ? '取消付费会员标记？' : '设为付费会员？',
    };
    final effect = switch (action) {
      MemberWriteAction.remove => '此操作会取消该成员在本队未开始且未支付的比赛报名；进行中、已结束及已支付的报名保留。',
      MemberWriteAction.captain =>
        captain ? '将取消当前队长，恢复普通队员角色。' : '将替换当前队长；原队长恢复普通队员角色。',
      _ => '此操作只调整会员标记，不修改余额或最近充值时间。',
    };
    final confirmed = await confirmAction(
      context,
      title: title,
      message:
          '${member.displayName}（用户 ${member.userId}），球队“${team.name}”。$effect',
    );
    if (!mounted || !confirmed) return;
    if (action == MemberWriteAction.captain &&
        (c.state.data?.team.captainId != team.captainId ||
            c.isCaptain(member) != captain)) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('队长已变更，请刷新后重新确认')));
      return;
    }
    switch (action) {
      case MemberWriteAction.remove:
        await c.removeMember(member);
      case MemberWriteAction.captain:
        await c.assignCaptain(captain ? null : member.userId);
      case MemberWriteAction.paid:
        await c.setPaid(member, !member.isPaidMember);
      default:
        return;
    }
    if (mounted &&
        action == MemberWriteAction.remove &&
        c.writeSucceeded &&
        c.writeAction == action) {
      widget.onRemoved?.call();
    }
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
          title: '成员详情',
          actions: [
            IconButton(
              tooltip: '刷新成员',
              onPressed: c.submitting ? null : () => unawaited(c.load()),
              icon: const Icon(Icons.refresh),
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
                      final m = c.memberById(widget.userId);
                      if (m == null) {
                        return const Center(child: Text('成员已移除或不存在，请返回成员列表。'));
                      }
                      final manageable = c.canManage(m),
                          editable = c.canEdit(m),
                          captain = c.isCaptain(m);
                      return ListView(
                        padding: const EdgeInsets.all(AdminSpacing.field),
                        children: [
                          FormSection(
                            title: '${data.team.name} · 成员',
                            children: [
                              PersonRow(
                                name: m.displayName,
                                avatarUrl: m.avatarUrl,
                                subtitle: '昵称：${m.nickname} · 用户 ${m.userId}',
                              ),
                              Wrap(
                                spacing: AdminSpacing.label,
                                runSpacing: AdminSpacing.label,
                                children: [
                                  StatusBadge(text: memberRoleLabel(m.role)),
                                  StatusBadge(
                                    text: memberStatusLabel(m.status),
                                    tone: memberStatusTone(m.status),
                                  ),
                                  StatusBadge(
                                    text: m.isPaidMember ? '付费会员' : '非付费会员',
                                  ),
                                ],
                              ),
                              Text(
                                memberBalance(m.balanceCents),
                                style: TextStyle(
                                  color: m.balanceCents < 0
                                      ? Theme.of(context).colorScheme.error
                                      : null,
                                ),
                              ),
                              Text('电话：${m.phoneNumber ?? '未提供'}'),
                              Text('入队：${memberInstant(m.joinedAt)}'),
                              Text(
                                m.lastRechargeAt == null
                                    ? '最近充值：未记录'
                                    : '最近充值：${memberInstant(m.lastRechargeAt!)}',
                              ),
                              if (!m.known)
                                const Text('未知角色或状态，已关闭修改操作，请先刷新核实。'),
                              if (captain)
                                const Text('当前队长的角色与状态不能普通编辑或移除；请先取消或更换队长。'),
                              FilledButton(
                                onPressed: editable
                                    ? () => widget.onEditMember(m)
                                    : null,
                                child: const Text('编辑角色与状态'),
                              ),
                              OutlinedButton(
                                onPressed: manageable
                                    ? () => widget.onEditProfile(m)
                                    : null,
                                child: const Text('编辑球员资料'),
                              ),
                              if (widget.onFund != null)
                                OutlinedButton(
                                  onPressed: c.submitting
                                      ? null
                                      : () => widget.onFund!(m),
                                  child: const Text('成员队费记录'),
                                ),
                            ],
                          ),
                          const SizedBox(height: AdminSpacing.section),
                          FormSection(
                            title: '独立管理操作',
                            description: '每项单独提交并报告结果，资料修改与成员角色互不合并。',
                            children: [
                              OutlinedButton(
                                onPressed: manageable
                                    ? () => unawaited(
                                        _confirm(m, MemberWriteAction.paid),
                                      )
                                    : null,
                                child: Text(
                                  m.isPaidMember ? '取消付费会员标记' : '设为付费会员',
                                ),
                              ),
                              OutlinedButton(
                                onPressed: captain
                                    ? (c.canRevokeCaptain(m)
                                          ? () => unawaited(
                                              _confirm(
                                                m,
                                                MemberWriteAction.captain,
                                              ),
                                            )
                                          : null)
                                    : (c.canAssignCaptain(m)
                                          ? () => unawaited(
                                              _confirm(
                                                m,
                                                MemberWriteAction.captain,
                                              ),
                                            )
                                          : null),
                                child: Text(captain ? '取消队长' : '任命为队长'),
                              ),
                              TextButton(
                                onPressed: editable
                                    ? () => unawaited(
                                        _confirm(m, MemberWriteAction.remove),
                                      )
                                    : null,
                                child: const Text('移除成员'),
                              ),
                            ],
                          ),
                        ],
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
