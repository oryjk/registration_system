import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../application/team_controller.dart';
import '../domain/team_repository.dart';
import 'team_card.dart';
import 'team_write_feedback.dart';

/// Borrows a dedicated form controller (seed initialTeam for editing).
/// onSaved receives the real server Team; composition replaces creation with
/// its detail route or pops editing with that object. It owns controller disposal.
class TeamFormPage extends StatefulWidget {
  const TeamFormPage({
    super.key,
    required this.controller,
    required this.onSaved,
    this.initialTeam,
  });
  final TeamController controller;
  final Team? initialTeam;
  final ValueChanged<Team> onSaved;
  @override
  State<TeamFormPage> createState() => _TeamFormPageState();
}

class _TeamFormPageState extends State<TeamFormPage> {
  final _form = GlobalKey<FormState>();
  final _nameKey = GlobalKey();
  final _scroll = ScrollController();
  late final _name = TextEditingController(
    text: widget.initialTeam?.name ?? '',
  );
  late final _description = TextEditingController(
    text: widget.initialTeam?.description ?? '',
  );
  late String? _status = widget.initialTeam?.status;
  bool _completed = false;
  bool get _dirty =>
      !_completed &&
      (_name.text != (widget.initialTeam?.name ?? '') ||
          _description.text != (widget.initialTeam?.description ?? '') ||
          _status != widget.initialTeam?.status);
  TeamDraft get _draft => TeamDraft(
    name: _name.text,
    description: _description.text,
    status: _status,
  );
  @override
  void dispose() {
    _scroll.dispose();
    _name.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    if (!(_form.currentState?.validate() ?? false)) {
      final target = _nameKey.currentContext;
      if (target != null) await Scrollable.ensureVisible(target);
      return;
    }
    final oldStatus = widget.initialTeam?.status;
    if (oldStatus != null && oldStatus != _status) {
      final confirmed = await confirmAction(
        context,
        title: '变更球队状态？',
        message:
            '将“${_name.text.trim()}”从${teamStatusLabel(oldStatus)}改为${teamStatusLabel(_status!)}。冻结或解散后球队不能参与比赛，请确认该变更。',
      );
      if (!mounted || !confirmed) return;
    }
    await widget.controller.save(_draft, id: widget.initialTeam?.id);
    if (!mounted) return;
    if (!widget.controller.writeSucceeded && _scroll.hasClients) {
      _scroll.jumpTo(0);
    }
    final result = widget.controller.savedTeam;
    if (widget.controller.writeSucceeded && result != null) {
      setState(() => _completed = true);
      // Rebuild the guard before the caller pops/replaces this route.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onSaved(result);
      });
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final c = widget.controller;
      final locked =
          c.submitting ||
          c.writeOutcomeUncertain ||
          c.writeSucceeded ||
          (widget.initialTeam != null && !widget.initialTeam!.canManage);
      return UnsavedGuard(
        blocked: c.submitting,
        dirty: _dirty,
        child: AdminScaffold(
          title: widget.initialTeam == null ? '创建球队' : '编辑球队',
          bottomBar: SubmitBar(
            submitting: c.submitting,
            onSubmit: locked ? null : _save,
            label: '保存球队',
          ),
          body: SingleChildScrollView(
            controller: _scroll,
            padding: const EdgeInsets.all(AdminSpacing.field),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            child: Form(
              key: _form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TeamWriteFeedback(controller: c),
                  if (c.fieldErrors['team'] != null)
                    Text(c.fieldErrors['team']!),
                  if (c.fieldErrors['status'] != null)
                    Text(c.fieldErrors['status']!),
                  const SizedBox(height: AdminSpacing.field),
                  FormSection(
                    title: '基本信息',
                    description: widget.initialTeam == null
                        ? '新球队创建后默认启用。'
                        : '修改名称、介绍和运营状态。',
                    children: [
                      TextFormField(
                        key: _nameKey,
                        controller: _name,
                        enabled: !locked,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: '球队名称',
                          helperText: '最多 120 个字符',
                          helperMaxLines: 2,
                        ),
                        validator: (_) => _draft.validate()['name'],
                        onChanged: (_) => setState(() {}),
                      ),
                      TextFormField(
                        controller: _description,
                        enabled: !locked,
                        minLines: 3,
                        maxLines: null,
                        decoration: const InputDecoration(
                          labelText: '球队介绍（选填）',
                        ),
                        keyboardType: TextInputType.multiline,
                        onChanged: (_) => setState(() {}),
                      ),
                      if (widget.initialTeam != null) ...[
                        const Text('球队状态'),
                        if (!Team.editableStatuses.contains(_status))
                          Text(teamStatusLabel(_status ?? '')),
                        for (final status in Team.editableStatuses)
                          SizedBox(
                            width: double.infinity,
                            child: TextButton(
                              onPressed: locked
                                  ? null
                                  : () => setState(() => _status = status),
                              style: TextButton.styleFrom(
                                alignment: Alignment.centerLeft,
                              ),
                              child: Wrap(
                                spacing: AdminSpacing.label,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Icon(
                                    _status == status
                                        ? Icons.radio_button_checked
                                        : Icons.radio_button_off,
                                  ),
                                  Text(teamStatusLabel(status)),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    },
  );
}
