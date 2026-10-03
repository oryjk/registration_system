import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../domain/match_models.dart';

class MatchScorePanel extends StatefulWidget {
  const MatchScorePanel({
    super.key,
    required this.match,
    required this.enabled,
    required this.onSave,
    required this.onDirtyChanged,
  });
  final MatchItem match;
  final bool enabled;
  final Future<void> Function(int, int) onSave;
  final ValueChanged<bool> onDirtyChanged;
  @override
  State<MatchScorePanel> createState() => _MatchScorePanelState();
}

class _MatchScorePanelState extends State<MatchScorePanel>
    with AutomaticKeepAliveClientMixin {
  bool _dirty = false;
  @override
  bool get wantKeepAlive => true;
  final _form = GlobalKey<FormState>();
  late final _host = TextEditingController(
    text: widget.match.hostScore?.toString() ?? '',
  );
  late final _away = TextEditingController(
    text: widget.match.awayScore?.toString() ?? '',
  );
  @override
  void didUpdateWidget(covariant MatchScorePanel old) {
    super.didUpdateWidget(old);
    if (old.match != widget.match) {
      if (!_dirty) {
        _host.text = widget.match.hostScore?.toString() ?? '';
        _away.text = widget.match.awayScore?.toString() ?? '';
      }
      _dirty =
          _host.text != (widget.match.hostScore?.toString() ?? '') ||
          _away.text != (widget.match.awayScore?.toString() ?? '');
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onDirtyChanged(_dirty);
      });
    }
  }

  @override
  void dispose() {
    _host.dispose();
    _away.dispose();
    super.dispose();
  }

  String? _validate(String? s) {
    final n = int.tryParse(s ?? '');
    return n == null || n < 0 || n > 999 ? '请输入 0 到 999 的整数' : null;
  }

  void _changed(String _) {
    _dirty =
        _host.text != (widget.match.hostScore?.toString() ?? '') ||
        _away.text != (widget.match.awayScore?.toString() ?? '');
    widget.onDirtyChanged(_dirty);
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    if (!_form.currentState!.validate()) return;
    final hostScore = int.parse(_host.text);
    final awayScore = int.parse(_away.text);
    final yes = await confirmAction(
      context,
      title: '保存比分？',
      message: '将“${widget.match.name}”的比分设为 $hostScore : $awayScore。',
    );
    if (!mounted || !yes || !widget.enabled) return;
    await widget.onSave(hostScore, awayScore);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return FormSection(
      title: '录入比分',
      children: [
        Form(
          key: _form,
          child: Column(
            children: [
              TextFormField(
                controller: _host,
                enabled: widget.enabled,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(labelText: '主队比分'),
                validator: _validate,
                onChanged: _changed,
              ),
              const SizedBox(height: AdminSpacing.field),
              TextFormField(
                controller: _away,
                enabled: widget.enabled,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                decoration: const InputDecoration(labelText: '客队比分'),
                validator: _validate,
                onChanged: _changed,
              ),
              const SizedBox(height: AdminSpacing.field),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: widget.enabled ? _save : null,
                  child: const Text('保存比分'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
