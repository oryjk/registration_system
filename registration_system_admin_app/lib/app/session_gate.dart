import 'package:flutter/material.dart';
import '../features/session/application/session_controller.dart';
import '../features/session/presentation/login_page.dart';
import 'admin_shell.dart';
import 'app_dependencies.dart';
import 'protected_workspace.dart';

class SessionGate extends StatefulWidget {
  const SessionGate({
    super.key,
    required this.dependencies,
    required this.onEnvironment,
  });
  final AppDependencies dependencies;
  final Future<void> Function(Uri) onEnvironment;
  @override
  State<SessionGate> createState() => _SessionGateState();
}

class _SessionGateState extends State<SessionGate> {
  ProtectedWorkspace? _workspace;
  @override
  void initState() {
    super.initState();
    widget.dependencies.session.addListener(_changed);
    _synchronize();
  }

  void _synchronize() {
    final session = widget.dependencies.session;
    if (_workspace != null &&
        (session.state.phase != SessionPhase.signedIn ||
            _workspace!.generation != session.generation)) {
      _workspace!.dispose();
      _workspace = null;
    }
    if (session.state.phase == SessionPhase.signedIn) {
      _workspace ??= ProtectedWorkspace(widget.dependencies);
    }
  }

  void _changed() {
    _synchronize();
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.dependencies.session.removeListener(_changed);
    _workspace?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.dependencies.session;
    final workspace = _workspace;
    if (session.state.phase == SessionPhase.signedIn && workspace != null) {
      return ScaffoldMessenger(
        key: workspace.messengerKey,
        child: NavigatorPopHandler<Object?>(
          onPopWithResult: (result) =>
              workspace.navigatorKey.currentState?.maybePop(result),
          child: Navigator(
            key: workspace.navigatorKey,
            onGenerateRoute: (_) => MaterialPageRoute<void>(
              settings: const RouteSettings(name: 'workspace'),
              builder: (_) => AdminShell(
                workspace: workspace,
                onEnvironment: widget.onEnvironment,
              ),
            ),
          ),
        ),
      );
    }
    if (session.state.phase == SessionPhase.signedOut) {
      return LoginPage(
        key: ValueKey(session.loginFormEpoch),
        controller: session,
      );
    }
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (session.state.phase == SessionPhase.bootstrapping) ...[
                  const CircularProgressIndicator(),
                  const SizedBox(height: 24),
                  const Text('正在恢复会话'),
                ] else ...[
                  Text(session.state.error.toString()),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: session.retry,
                    child: const Text('重试'),
                  ),
                  TextButton(
                    onPressed: session.logout,
                    child: const Text('清理会话并重新登录'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
