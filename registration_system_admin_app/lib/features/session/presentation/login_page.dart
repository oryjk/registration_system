import 'package:flutter/material.dart';
import '../../../design_system/tokens/component_tokens.dart';
import '../../../design_system/tokens/semantic_tokens.dart';
import '../../../design_system/widgets/submit_bar.dart';
import '../application/session_controller.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.controller});
  final SessionController controller;
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _form = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  void _submit() {
    if (widget.controller.state.submitting || !_form.currentState!.validate()) {
      return;
    }
    FocusScope.of(context).unfocus();
    widget.controller.login(_username.text.trim(), _password.text);
  }

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AdminSpacing.panel),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxWidth: AdminComponents.formMaxWidth,
            ),
            child: ListenableBuilder(
              listenable: widget.controller,
              builder: (context, _) {
                final state = widget.controller.state;
                final enabled =
                    state.phase == SessionPhase.signedOut && !state.submitting;
                return Form(
                  key: _form,
                  child: AutofillGroup(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          '赛事管理',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: AdminSpacing.label),
                        Text(
                          '使用管理员账号登录',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: AdminSpacing.section),
                        TextFormField(
                          key: const Key('login.username'),
                          controller: _username,
                          enabled: enabled,
                          autofillHints: const [AutofillHints.username],
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(labelText: '用户名'),
                          validator: (value) =>
                              value == null || value.trim().isEmpty
                              ? '请输入用户名'
                              : null,
                        ),
                        const SizedBox(height: AdminSpacing.field),
                        TextFormField(
                          key: const Key('login.password'),
                          controller: _password,
                          enabled: enabled,
                          obscureText: _obscure,
                          autocorrect: false,
                          enableSuggestions: false,
                          autofillHints: const [AutofillHints.password],
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) {
                            if (enabled) _submit();
                          },
                          decoration: InputDecoration(
                            labelText: '密码',
                            suffixIcon: IconButton(
                              tooltip: _obscure ? '显示密码' : '隐藏密码',
                              onPressed: enabled
                                  ? () => setState(() => _obscure = !_obscure)
                                  : null,
                              icon: Icon(
                                _obscure
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                            ),
                          ),
                          validator: (value) =>
                              value == null || value.isEmpty ? '请输入密码' : null,
                        ),
                        if (state.error != null)
                          Padding(
                            padding: const EdgeInsets.only(
                              top: AdminSpacing.field,
                            ),
                            child: Semantics(
                              liveRegion: true,
                              child: Text(
                                state.error.toString(),
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.error,
                                    ),
                              ),
                            ),
                          ),
                        SubmitBar(
                          submitting: state.submitting,
                          onSubmit: enabled ? _submit : null,
                          label: '登录',
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    ),
  );
}
