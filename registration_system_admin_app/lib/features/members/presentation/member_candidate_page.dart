import 'dart:async';
import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../application/member_controller.dart';
import '../domain/member_models.dart';
import 'member_labels.dart';
import 'member_write_feedback.dart';

/// Borrows the controller; selected identity must still belong to the latest
/// real result objects when the operator confirms the addition.
class MemberCandidatePage extends StatefulWidget {
  const MemberCandidatePage({
    super.key,
    required this.controller,
    this.onAdded,
    this.loadOnStart = true,
  });
  final MemberController controller;
  final VoidCallback? onAdded;
  final bool loadOnStart;
  @override
  State<MemberCandidatePage> createState() => _MemberCandidatePageState();
}

class _MemberCandidatePageState extends State<MemberCandidatePage> {
  final _search = TextEditingController();
  MemberCandidate? _selected;
  String _role = 'member';
  bool _completed = false, _attempted = false;
  @override
  void initState() {
    super.initState();
    _search.text = widget.controller.query;
    if (widget.loadOnStart) unawaited(_start());
  }

  Future<void> _start() async {
    final c = widget.controller;
    if (c.state.data == null) await c.load();
    if (mounted) await c.searchCandidates(_search.text);
  }

  bool get _selectionCurrent =>
      _selected != null &&
      (widget.controller.candidateState.data?.any(
            (x) => identical(x, _selected),
          ) ??
          false);
  Future<void> _add() async {
    final selected = _selected;
    if (selected == null || !_selectionCurrent) return;
    final confirmed = await confirmAction(
      context,
      title: '添加球队成员？',
      message:
          '将 ${selected.displayName}（用户 ${selected.userId}）添加到“${widget.controller.state.data!.team.name}”，角色为${memberRoleLabel(_role)}。',
    );
    if (!mounted || !confirmed) return;
    final c = widget.controller;
    _attempted = true;
    await c.addCandidate(selected, _role);
    if (!mounted) return;
    if (c.writeSucceeded && c.writeAction == MemberWriteAction.add) {
      setState(() => _completed = true);
      widget.onAdded?.call();
    }
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final c = widget.controller;
      if (_attempted &&
          c.writeSucceeded &&
          c.writeAction == MemberWriteAction.add &&
          c.lastResult?.userId == _selected?.userId) {
        _completed = true;
      }
      return UnsavedGuard(
        dirty: !_completed && _selected != null,
        blocked: c.submitting,
        child: AdminScaffold(
          title: '添加成员',
          actions: [
            IconButton(
              tooltip: '重新查询候选',
              onPressed: c.submitting || _completed
                  ? null
                  : () => unawaited(c.searchCandidates(_search.text)),
              icon: const Icon(Icons.refresh),
            ),
          ],
          bottomBar: _completed
              ? null
              : SubmitBar(
                  submitting: c.submitting,
                  onSubmit: c.canManageTeam && _selectionCurrent
                      ? () => unawaited(_add())
                      : null,
                  label: '添加选中球员',
                ),
          body: LayoutBuilder(
            builder: (context, constraints) => Column(
              children: [
                MemberFeedbackArea(
                  controller: c,
                  height: constraints.maxHeight,
                ),
                if (_completed)
                  const Expanded(child: Center(child: Text('成员已添加，请返回列表')))
                else
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.all(AdminSpacing.field),
                      children: [
                        FormSection(
                          title: '查找真实球员',
                          description:
                              '按昵称、姓名、电话或用户编号查询，最多返回 50 人。已有成员不在候选名单中。',
                          children: [
                            TextField(
                              controller: _search,
                              enabled: !c.locked,
                              decoration: const InputDecoration(
                                labelText: '查询球员',
                              ),
                              onChanged: (value) {
                                setState(() => _selected = null);
                                unawaited(c.searchCandidates(value));
                              },
                            ),
                            DropdownButtonFormField<String>(
                              initialValue: _role,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: '添加角色',
                              ),
                              items: [
                                for (final role in Member.assignableRoles)
                                  DropdownMenuItem(
                                    value: role,
                                    child: Text(memberRoleLabel(role)),
                                  ),
                              ],
                              onChanged: c.locked
                                  ? null
                                  : (value) => setState(() => _role = value!),
                            ),
                            if (_selectionCurrent)
                              Text(
                                '已选择：${_selected!.displayName}（用户 ${_selected!.userId}）',
                              ),
                          ],
                        ),
                        const SizedBox(height: AdminSpacing.field),
                        if (c.candidateState.loading)
                          const Center(child: CircularProgressIndicator()),
                        if (c.candidateState.error != null) ...[
                          Text('候选查询失败：${c.candidateState.error}'),
                          TextButton(
                            onPressed: c.locked
                                ? null
                                : () => unawaited(
                                    c.searchCandidates(_search.text),
                                  ),
                            child: const Text('重试查询'),
                          ),
                        ],
                        if (c.candidateState.data?.isEmpty == true)
                          const Text('没有可添加的球员，请换一个关键词。'),
                        for (final candidate
                            in c.candidateState.data ??
                                const <MemberCandidate>[])
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(AdminSpacing.field),
                              child: PersonRow(
                                name: candidate.displayName,
                                avatarUrl: candidate.avatarUrl,
                                subtitle:
                                    '用户 ${candidate.userId} · ${candidate.phoneNumber ?? '电话未提供'}',
                                onTap: c.locked
                                    ? null
                                    : () =>
                                          setState(() => _selected = candidate),
                                details: [
                                  if (identical(candidate, _selected))
                                    const StatusBadge(
                                      text: '已选中',
                                      tone: StatusTone.info,
                                    ),
                                ],
                              ),
                            ),
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
