import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../application/team_controller.dart';
import '../domain/team.dart';

/// Password lives only in this form; never returned or persisted.
class TeamJoinPasswordPanel extends StatefulWidget {
  const TeamJoinPasswordPanel({
    super.key,
    required this.controller,
    required this.team,
    required this.onDirtyChanged,
  });
  final TeamController controller;
  final Team team;
  final ValueChanged<bool> onDirtyChanged;
  @override
  State<TeamJoinPasswordPanel> createState() => _TeamJoinPasswordPanelState();
}

class _TeamJoinPasswordPanelState extends State<TeamJoinPasswordPanel> {
  final _password = TextEditingController();
  bool _hidden = true;
  String? _error;
  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit({bool clear = false}) async {
    if (!clear && _password.text.trim().isEmpty) {
      setState(() => _error = '请输入新密码；开放加入请使用清除按钮');
      return;
    }
    final confirmed = await confirmAction(
      context,
      title: clear ? '清除入队密码？' : '更新入队密码？',
      message: clear
          ? '清除“${widget.team.name}”的入队密码后，球员加入该球队时无需密码。'
          : '更新“${widget.team.name}”的入队密码后，原密码失效，新加入的球员需要新密码。',
    );
    if (!mounted || !confirmed) return;
    await widget.controller.setJoinPassword(
      widget.team.id,
      clear ? '' : _password.text,
    );
    if (!mounted) return;
    if (widget.controller.writeSucceeded) {
      _password.clear();
      widget.onDirtyChanged(false);
      setState(() => _error = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.controller.canManage(widget.team.id);
    return FormSection(
      title: '入队密码',
      description: '服务器不返回现有密码，可设置新密码或清除后开放加入。',
      children: [
        TextField(
          key: const ValueKey('team-password'),
          controller: _password,
          obscureText: _hidden,
          enabled: enabled,
          autocorrect: false,
          enableSuggestions: false,
          textInputAction: TextInputAction.done,
          onChanged: (value) {
            widget.onDirtyChanged(value.isNotEmpty);
            if (_error != null) setState(() => _error = null);
          },
          decoration: InputDecoration(
            labelText: '新入队密码',
            errorText: _error,
            suffixIcon: IconButton(
              onPressed: enabled
                  ? () => setState(() => _hidden = !_hidden)
                  : null,
              tooltip: _hidden ? '显示入队密码' : '隐藏入队密码',
              icon: Icon(
                _hidden
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
              ),
            ),
          ),
        ),
        FilledButton(
          onPressed: enabled ? _submit : null,
          child: const Text('设置新密码'),
        ),
        TextButton(
          onPressed: enabled ? () => _submit(clear: true) : null,
          child: const Text('清除密码，开放加入'),
        ),
      ],
    );
  }
}
