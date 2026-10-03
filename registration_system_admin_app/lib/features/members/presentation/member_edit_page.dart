import 'dart:async';
import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../application/member_controller.dart';
import '../domain/member_models.dart';
import 'member_labels.dart';
import 'member_write_feedback.dart';

enum MemberEditMode { membership, profile }

/// Two explicit form modes each submit one endpoint. A confirmed save disables
/// replay even if the subsequent member-list read fails. Controller is borrowed.
class MemberEditPage extends StatefulWidget {
  const MemberEditPage({
    super.key,
    required this.controller,
    required this.userId,
    required this.mode,
    this.onSaved,
  });
  final MemberController controller;
  final int userId;
  final MemberEditMode mode;
  final VoidCallback? onSaved;
  @override
  State<MemberEditPage> createState() => _MemberEditPageState();
}

class _MemberEditPageState extends State<MemberEditPage> {
  final _name = TextEditingController(), _phone = TextEditingController();
  String? _role, _status;
  String _initialName = '', _initialPhone = '';
  String? _initialRole, _initialStatus;
  bool _initialized = false, _completed = false, _attempted = false;
  bool get _profile => widget.mode == MemberEditMode.profile;
  bool get _dirty =>
      !_completed &&
      (_profile
          ? (_name.text != _initialName || _phone.text != _initialPhone)
          : (_role != _initialRole || _status != _initialStatus));
  void _initialize(Member m) {
    if (_initialized) return;
    _initialized = true;
    _name.text = _initialName = m.realName ?? '';
    _phone.text = _initialPhone = m.phoneNumber ?? '';
    _role = _initialRole = m.role;
    _status = _initialStatus = m.status;
  }

  Future<void> _save(Member m) async {
    final c = widget.controller;
    if (_completed) return;
    if (_profile) {
      _attempted = true;
      await c.saveProfile(m, _name.text, _phone.text);
    } else {
      final confirmed = await confirmAction(
        context,
        title: '更新成员角色与状态？',
        message:
            '${m.displayName}（用户 ${m.userId}）：${memberRoleLabel(m.role)} / ${memberStatusLabel(m.status)} → ${memberRoleLabel(_role!)} / ${memberStatusLabel(_status!)}。此操作不修改球员资料、队长任免或付费会员标记。',
      );
      if (!mounted || !confirmed) return;
      _attempted = true;
      await c.updateMember(m, _role!, _status!);
    }
    if (!mounted) return;
    final action = _profile
        ? MemberWriteAction.profile
        : MemberWriteAction.update;
    if (c.writeSucceeded && c.writeAction == action) {
      setState(() => _completed = true);
      widget.onSaved?.call();
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final c = widget.controller, m = c.memberById(widget.userId);
      if (m != null) _initialize(m);
      final action = _profile
          ? MemberWriteAction.profile
          : MemberWriteAction.update;
      if (_attempted &&
          c.writeSucceeded &&
          c.writeAction == action &&
          c.lastResult?.userId == widget.userId) {
        _completed = true;
      }
      final permitted = m != null && (_profile ? c.canManage(m) : c.canEdit(m));
      return UnsavedGuard(
        dirty: _dirty,
        blocked: c.submitting,
        child: AdminScaffold(
          title: _profile ? '编辑球员资料' : '编辑角色与状态',
          bottomBar: m == null
              ? null
              : SubmitBar(
                  submitting: c.submitting,
                  onSubmit: permitted && !_completed && _dirty
                      ? () => unawaited(_save(m))
                      : null,
                  label: _completed
                      ? '本项已保存'
                      : _profile
                      ? '保存球员资料'
                      : '保存角色与状态',
                ),
          body: LayoutBuilder(
            builder: (context, constraints) => Column(
              children: [
                MemberFeedbackArea(
                  controller: c,
                  height: constraints.maxHeight,
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(AdminSpacing.field),
                    children: [
                      if (m == null) ...[
                        const Text('成员不存在或尚未加载，请刷新后返回成员列表。'),
                        TextButton(
                          onPressed: c.submitting
                              ? null
                              : () => unawaited(c.load()),
                          child: const Text('刷新成员'),
                        ),
                      ] else
                        FormSection(
                          title: m.displayName,
                          description: _profile
                              ? '更新此球员的姓名和电话，将影响其他球队展示。空白输入会清空对应资料。'
                              : '只保存本队成员角色与状态，队长需通过独立任免操作管理。',
                          children: [
                            Text('用户 ${m.userId} · ${c.state.data!.team.name}'),
                            if (!permitted && !_completed)
                              const Text('当前成员或球队状态不支持此操作，请刷新核实。'),
                            if (_profile) ...[
                              TextFormField(
                                controller: _name,
                                enabled: permitted && !_completed,
                                decoration: InputDecoration(
                                  labelText: '姓名',
                                  helperText: '最多 120 个字符；可留空',
                                  errorText: c.fieldErrors['realName'],
                                ),
                                onChanged: (_) => setState(() {}),
                              ),
                              TextFormField(
                                controller: _phone,
                                enabled: permitted && !_completed,
                                keyboardType: TextInputType.phone,
                                decoration: InputDecoration(
                                  labelText: '电话',
                                  helperText: '最多 32 个字符；可留空',
                                  errorText: c.fieldErrors['phone'],
                                ),
                                onChanged: (_) => setState(() {}),
                              ),
                            ] else ...[
                              DropdownButtonFormField<String>(
                                initialValue:
                                    Member.assignableRoles.contains(_role)
                                    ? _role
                                    : null,
                                isExpanded: true,
                                decoration: const InputDecoration(
                                  labelText: '成员角色',
                                ),
                                items: [
                                  for (final role in Member.assignableRoles)
                                    DropdownMenuItem(
                                      value: role,
                                      child: Text(memberRoleLabel(role)),
                                    ),
                                ],
                                onChanged: permitted && !_completed
                                    ? (value) => setState(() => _role = value)
                                    : null,
                              ),
                              DropdownButtonFormField<String>(
                                initialValue: Member.statuses.contains(_status)
                                    ? _status
                                    : null,
                                isExpanded: true,
                                decoration: const InputDecoration(
                                  labelText: '成员状态',
                                ),
                                items: [
                                  for (final status in Member.statuses)
                                    DropdownMenuItem(
                                      value: status,
                                      child: Text(memberStatusLabel(status)),
                                    ),
                                ],
                                onChanged: permitted && !_completed
                                    ? (value) => setState(() => _status = value)
                                    : null,
                              ),
                            ],
                            if (c.state.error != null) ...[
                              const Text('成员读取失败，请刷新读取；已成功的保存无需重复。'),
                              TextButton(
                                onPressed: c.submitting
                                    ? null
                                    : () => unawaited(c.load()),
                                child: const Text('刷新读取'),
                              ),
                            ],
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
