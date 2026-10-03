import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../../teams/domain/team_repository.dart';
import '../application/match_form_controller.dart';
import '../domain/match_repository.dart';
import 'active_team_field.dart';
import 'beijing_time_field.dart';
import 'match_card.dart';

/// Borrows a dedicated form controller and team repository. Editing always starts
/// from the complete detail. Composition owns disposal and outcome-check routes.
class MatchFormPage extends StatefulWidget {
  const MatchFormPage({
    super.key,
    required this.controller,
    required this.teamRepository,
    required this.onSaved,
    required this.onCheckOutcome,
    this.initialDetail,
  });
  final MatchFormController controller;
  final TeamRepository teamRepository;
  final MatchDetail? initialDetail;
  final ValueChanged<MatchDetail> onSaved;

  /// Open actual list/detail and return after the operator has checked it. Merely
  /// returning never acknowledges uncertainty: the operator must confirm below.
  final Future<void> Function() onCheckOutcome;
  @override
  State<MatchFormPage> createState() => _MatchFormPageState();
}

class _MatchFormPageState extends State<MatchFormPage> {
  late final _draft = widget.initialDetail == null
      ? MatchDraft()
      : MatchDraft.fromDetail(widget.initialDetail!);
  final _form = GlobalKey<FormState>();
  final _scroll = ScrollController();
  final _fields = <String, TextEditingController>{};
  final _keys = <String, GlobalKey>{};
  final _originalFields = <String, String>{};
  late final _originalMode = _draft.publicationMode;
  late final _originalHost = _draft.hostTeamId;
  late final _originalFree = _draft.isFree;
  late final _originalStart = _draft.startTime?.toUtc();
  late final _originalRegStart = _draft.registrationStartAt?.toUtc();
  late final _originalRegEnd = _draft.registrationEndAt?.toUtc();
  Map<String, String> _errors = {};
  bool _completed = false, _outcomeViewed = false, _checking = false;
  String? _checkError;
  bool get _dirty =>
      !_completed &&
      (_fields.entries.any((e) => e.value.text != _originalFields[e.key]) ||
          _draft.publicationMode != _originalMode ||
          _draft.hostTeamId != _originalHost ||
          _draft.isFree != _originalFree ||
          _draft.startTime?.toUtc() != _originalStart ||
          _draft.registrationStartAt?.toUtc() != _originalRegStart ||
          _draft.registrationEndAt?.toUtc() != _originalRegEnd);
  @override
  void initState() {
    super.initState();
    final values = <String, String>{
      'name': _draft.name,
      'location': _draft.location,
      'opponent_name': _draft.opponentName ?? '',
      'players_per_team': '${_draft.playersPerTeam}',
      'host_capacity_limit': _draft.hostCapacityLimit?.toString() ?? '',
      'duration_minutes': '${_draft.durationMinutes}',
      'description': _draft.description ?? '',
      'location_latitude': _draft.locationLatitude?.toString() ?? '',
      'location_longitude': _draft.locationLongitude?.toString() ?? '',
      'host_color': _draft.hostColor ?? '',
      'away_color': _draft.awayColor ?? '',
    };
    for (final e in values.entries) {
      _fields[e.key] = TextEditingController(text: e.value);
      _originalFields[e.key] = e.value;
      _keys[e.key] = GlobalKey();
    }
    for (final key in [
      'host_team_id',
      'start_time',
      'registration_start_at',
      'registration_end_at',
    ]) {
      _keys[key] = GlobalKey();
    }
  }

  @override
  void dispose() {
    for (final field in _fields.values) {
      field.dispose();
    }
    _scroll.dispose();
    super.dispose();
  }

  void _changed(String key, String value) {
    switch (key) {
      case 'name':
        _draft.name = value;
      case 'location':
        _draft.location = value;
      case 'opponent_name':
        _draft.opponentName = value;
      case 'players_per_team':
        _draft.playersPerTeam = int.tryParse(value) ?? -1;
      case 'host_capacity_limit':
        _draft.hostCapacityLimit = value.trim().isEmpty
            ? null
            : int.tryParse(value) ?? -1;
      case 'duration_minutes':
        _draft.durationMinutes = int.tryParse(value) ?? -1;
      case 'description':
        _draft.description = value.isEmpty ? null : value;
      case 'location_latitude':
        _draft.locationLatitude = value.trim().isEmpty
            ? null
            : double.tryParse(value) ?? double.nan;
      case 'location_longitude':
        _draft.locationLongitude = value.trim().isEmpty
            ? null
            : double.tryParse(value) ?? double.nan;
      case 'host_color':
        _draft.hostColor = value;
      case 'away_color':
        _draft.awayColor = value;
    }
    setState(() {});
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    setState(() => _errors = _draft.validate());
    _form.currentState!.validate();
    if (_errors.isNotEmpty) {
      final context = _keys[_errors.keys.first]?.currentContext;
      if (context != null) await Scrollable.ensureVisible(context);
      return;
    }
    final saved = await widget.controller.save(_draft);
    if (!mounted) return;
    if (saved != null) {
      setState(() => _completed = true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onSaved(saved);
      });
    } else {
      setState(() => _errors = widget.controller.fieldErrors);
      if (_scroll.hasClients) _scroll.jumpTo(0);
    }
  }

  Future<void> _check() async {
    setState(() {
      _checking = true;
      _checkError = null;
    });
    try {
      await widget.onCheckOutcome();
      if (mounted) setState(() => _outcomeViewed = true);
    } catch (_) {
      if (mounted) setState(() => _checkError = '核实页面打开失败，请重试查看。');
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _unlock() async {
    final yes = await confirmAction(
      context,
      title: '已确认本次提交未生效？',
      message:
          '请确认已检查实际比赛列表或详情，“${_draft.name}”的本次提交没有生效。确认后仅解锁表单，不会自动重新提交；若已生效，请返回列表或详情。',
    );
    if (!mounted || !yes) return;
    widget.controller.acknowledgeOutcomeChecked();
    setState(() => _outcomeViewed = false);
  }

  Widget _text(
    String key,
    String label, {
    required bool locked,
    String? helper,
    bool numeric = false,
    bool decimal = false,
    bool multiline = false,
  }) => TextFormField(
    key: _keys[key],
    controller: _fields[key],
    enabled: !locked,
    decoration: InputDecoration(
      labelText: label,
      helperText: helper,
      helperMaxLines: 3,
    ),
    keyboardType: multiline
        ? TextInputType.multiline
        : numeric
        ? TextInputType.numberWithOptions(decimal: decimal, signed: decimal)
        : TextInputType.text,
    textInputAction: multiline ? TextInputAction.newline : TextInputAction.next,
    minLines: multiline ? 3 : 1,
    maxLines: multiline ? null : 1,
    validator: (_) => _errors[key],
    onChanged: (s) => _changed(key, s),
  );
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final c = widget.controller;
      final locked =
          c.submitting ||
          c.writeOutcomeUncertain ||
          c.writeSucceeded ||
          (widget.initialDetail != null &&
              !widget.initialDetail!.match.canEdit);
      return UnsavedGuard(
        dirty: _dirty,
        blocked: c.submitting || _checking,
        child: AdminScaffold(
          title: _draft.isEditing ? '编辑比赛' : '创建比赛',
          bottomBar: SubmitBar(
            submitting: c.submitting,
            onSubmit: locked || _checking ? null : _save,
            label: '保存比赛',
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
                  if (c.writeOutcomeUncertain) ...[
                    const Text(MatchFormController.uncertainGuidance),
                    if (_checkError != null) Text(_checkError!),
                    TextButton(
                      onPressed: _checking ? null : _check,
                      child: Text(_checking ? '正在核实…' : '查看列表或详情核实结果'),
                    ),
                    if (_outcomeViewed)
                      TextButton(
                        onPressed: _unlock,
                        child: const Text('已核实未生效，解锁提交'),
                      ),
                  ] else if (c.error != null)
                    Text('操作失败：${c.error}'),
                  for (final e in _errors.entries.where(
                    (e) => !_keys.containsKey(e.key),
                  ))
                    Text(e.value),
                  FormSection(
                    title: '基本信息',
                    children: [
                      _text('name', '比赛名称', locked: locked),
                      if (!_draft.isEditing) ...[
                        const Text('发布模式'),
                        for (final mode in [
                          'offline_confirmed',
                          'online_team',
                          'online_individual',
                        ])
                          TextButton(
                            onPressed: locked
                                ? null
                                : () => setState(() {
                                    _draft.publicationMode = mode;
                                    if (mode != 'offline_confirmed') {
                                      _draft.opponentName = null;
                                      _fields['opponent_name']!.clear();
                                    }
                                  }),
                            style: TextButton.styleFrom(
                              alignment: Alignment.centerLeft,
                            ),
                            child: Wrap(
                              spacing: AdminSpacing.label,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Icon(
                                  _draft.publicationMode == mode
                                      ? Icons.radio_button_checked
                                      : Icons.radio_button_off,
                                ),
                                Text(
                                  enumLabel(mode, const {
                                    'offline_confirmed': '线下已约',
                                    'online_team': '线上约队',
                                    'online_individual': '散人对手',
                                  }),
                                ),
                              ],
                            ),
                          ),
                        ActiveTeamField(
                          key: _keys['host_team_id'],
                          repository: widget.teamRepository,
                          value: _draft.hostTeamId,
                          enabled: !locked,
                          error: _errors['host_team_id'],
                          onChanged: (id) =>
                              setState(() => _draft.hostTeamId = id),
                        ),
                        _text(
                          'players_per_team',
                          '每队人数',
                          locked: locked,
                          numeric: true,
                        ),
                      ] else ...[
                        Text(
                          '发布模式：${widget.initialDetail!.match.publicationModeLabel}',
                        ),
                        Text(
                          '主队：${widget.initialDetail!.match.hostTeamName.isEmpty ? '无主队' : widget.initialDetail!.match.hostTeamName}',
                        ),
                        Text('每队 ${_draft.playersPerTeam} 人（不可修改）'),
                        const Text('费用设置保留原值；详细收费信息请查看比赛详情。'),
                      ],
                      if (_draft.publicationMode == 'offline_confirmed')
                        _text('opponent_name', '线下对手名称', locked: locked),
                    ],
                  ),
                  const SizedBox(height: AdminSpacing.section),
                  FormSection(
                    title: '赛程和报名',
                    description: '所有输入均为北京时间。',
                    children: [
                      BeijingTimeField(
                        key: _keys['start_time'],
                        label: '开始时间',
                        value: _draft.startTime,
                        enabled: !locked,
                        error: _errors['start_time'],
                        onChanged: (v) => setState(() => _draft.startTime = v),
                      ),
                      _text(
                        'duration_minutes',
                        '比赛时长（分钟）',
                        locked: locked,
                        numeric: true,
                      ),
                      if (_draft.endTime != null)
                        Text('预计结束：${matchInstant(_draft.endTime!)}'),
                      BeijingTimeField(
                        key: _keys['registration_start_at'],
                        label: '报名开始时间',
                        value: _draft.registrationStartAt,
                        enabled: !locked,
                        clearable: true,
                        error: _errors['registration_start_at'],
                        onChanged: (v) =>
                            setState(() => _draft.registrationStartAt = v),
                      ),
                      BeijingTimeField(
                        key: _keys['registration_end_at'],
                        label: '报名截止时间',
                        value: _draft.registrationEndAt,
                        enabled: !locked,
                        clearable: true,
                        error: _errors['registration_end_at'],
                        onChanged: (v) =>
                            setState(() => _draft.registrationEndAt = v),
                      ),
                      if (!_draft.isEditing ||
                          widget.initialDetail!.groups.any(
                            (g) => g.kind == 'host_team',
                          ))
                        _text(
                          'host_capacity_limit',
                          '主队报名上限（选填）',
                          locked: locked,
                          numeric: true,
                          helper: _draft.isEditing
                              ? '留空保留当前上限；此接口不支持清除。'
                              : '1 至 100 人；留空使用默认上限。',
                        )
                      else
                        const Text('当前比赛无主队报名组，散人组人数范围仅在详情查看。'),
                    ],
                  ),
                  const SizedBox(height: AdminSpacing.section),
                  FormSection(
                    title: '比赛场地',
                    children: [
                      _text('location', '场地名称', locked: locked),
                      _text(
                        'location_latitude',
                        '纬度（选填）',
                        locked: locked,
                        numeric: true,
                        decimal: true,
                      ),
                      _text(
                        'location_longitude',
                        '经度（选填）',
                        locked: locked,
                        numeric: true,
                        decimal: true,
                        helper: '经纬度同时填写；两项清空会清除坐标。',
                      ),
                    ],
                  ),
                  const SizedBox(height: AdminSpacing.section),
                  FormSection(
                    title: '其他选项',
                    children: [
                      _text(
                        'description',
                        '比赛说明（选填）',
                        locked: locked,
                        multiline: true,
                      ),
                      _text(
                        'host_color',
                        '主队球服颜色（选填）',
                        locked: locked,
                        helper: '#RRGGBB；清空会移除已设颜色。',
                      ),
                      _text(
                        'away_color',
                        '客队球服颜色（选填）',
                        locked: locked,
                        helper: '#RRGGBB；清空会移除已设颜色。',
                      ),
                      if (!_draft.isEditing)
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          value: _draft.isFree,
                          onChanged: locked
                              ? null
                              : (v) =>
                                    setState(() => _draft.isFree = v ?? false),
                          title: const Text('免费比赛'),
                          controlAffinity: ListTileControlAffinity.leading,
                        ),
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
