import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../../../app/build_info_controller.dart';
import '../../session/application/session_controller.dart';

class AccountPage extends StatelessWidget {
  const AccountPage({
    super.key,
    required this.session,
    required this.theme,
    required this.buildInfo,
    required this.environment,
    required this.onEnvironment,
  });
  final SessionController session;
  final ThemeController theme;
  final BuildInfoController buildInfo;
  final Uri environment;
  final Future<void> Function(Uri) onEnvironment;
  Future<void> _chooseEnvironment(BuildContext context) async {
    final value = await showDialog<String>(
      context: context,
      useRootNavigator: false,
      builder: (_) => _EnvironmentDialog(environment: environment),
    );
    if (value == null || !context.mounted) return;
    final uri = Uri.tryParse(value);
    if (uri == null ||
        !uri.hasAuthority ||
        !const ['http', 'https'].contains(uri.scheme) ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入不含凭据、查询参数的 HTTP/HTTPS 地址')),
      );
      return;
    }
    await onEnvironment(uri);
  }

  @override
  Widget build(BuildContext context) => AdminScaffold(
    title: '我的',
    body: ListenableBuilder(
      listenable: Listenable.merge([theme, buildInfo]),
      builder: (context, _) => ListView(
        padding: const EdgeInsets.all(AdminSpacing.panel),
        children: [
          Text(
            session.state.admin?.username ?? '',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: AdminSpacing.field),
          Text(session.state.admin?.isSuperAdmin == true ? '超级管理员' : '管理员'),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('深色主题'),
            value: theme.dark,
            onChanged: theme.setDark,
          ),
          if (theme.error != null)
            Text(
              theme.error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('构建版本'),
            subtitle: Text(
              buildInfo.loading
                  ? '正在读取构建版本'
                  : buildInfo.version ?? buildInfo.error ?? '未获取构建版本',
            ),
            trailing: buildInfo.error == null
                ? null
                : IconButton(
                    tooltip: '重试读取版本',
                    onPressed: buildInfo.refresh,
                    icon: const Icon(Icons.refresh),
                  ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('当前环境'),
            subtitle: Text(environment.toString()),
          ),
          if (kDebugMode)
            OutlinedButton(
              onPressed: () => _chooseEnvironment(context),
              child: const Text('切换开发环境'),
            ),
          const SizedBox(height: AdminSpacing.section),
          FilledButton.tonal(
            onPressed: () async {
              if (await confirmAction(
                context,
                title: '退出登录？',
                message: '未确认的资金动作将保留，重新登录同一账号后可核实。',
              )) {
                await session.logout();
              }
            },
            child: const Text('退出登录'),
          ),
        ],
      ),
    ),
  );
}

class _EnvironmentDialog extends StatefulWidget {
  const _EnvironmentDialog({required this.environment});
  final Uri environment;
  @override
  State<_EnvironmentDialog> createState() => _EnvironmentDialogState();
}

class _EnvironmentDialogState extends State<_EnvironmentDialog> {
  late final input = TextEditingController(text: widget.environment.toString());
  @override
  void dispose() {
    input.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('开发环境'),
    content: SingleChildScrollView(
      child: TextField(
        controller: input,
        keyboardType: TextInputType.url,
        decoration: const InputDecoration(
          labelText: 'API Base URL',
          helperText: '切换后需重新登录',
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('取消'),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(context, input.text.trim()),
        child: const Text('切换'),
      ),
    ],
  );
}
