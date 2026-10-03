import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../design_system/design_system.dart';
import '../features/session/application/session_controller.dart';
import 'app_dependencies.dart';
import 'session_gate.dart';

/// Production bootstrap has no fixture mode. The caller owns initial dependencies.
class AdminApp extends StatefulWidget {
  const AdminApp({
    super.key,
    required this.dependencies,
    this.environmentFactory,
  });
  final AppDependencies dependencies;

  /// Factories must forward the supplied app-lifetime stores. A different
  /// identity is rejected before initialize or protected controllers can run.
  final AppDependencies Function(Uri, AppStores)? environmentFactory;
  @override
  State<AdminApp> createState() => _AdminAppState();
}

class _AdminAppState extends State<AdminApp> {
  late AppDependencies _dependencies = widget.dependencies;
  bool _switching = false;
  String? _environmentError;
  bool _ownsDependencies = false;
  @override
  void initState() {
    super.initState();
    unawaited(_dependencies.initialize());
  }

  Future<void> _switchEnvironment(Uri environment) async {
    if (!kDebugMode ||
        _switching ||
        SessionController.normalizeEnvironment(environment) ==
            SessionController.normalizeEnvironment(_dependencies.baseUrl)) {
      return;
    }
    _switching = true;
    setState(() => _environmentError = null);
    final old = _dependencies;
    await old.session.logout();
    if (!mounted || old.session.state.phase != SessionPhase.signedOut) {
      _switching = false;
      return;
    }
    // Deletion must succeed before another environment can expose a login form.
    AppDependencies next;
    try {
      next =
          widget.environmentFactory?.call(environment, old.stores) ??
          old.forEnvironment(environment);
    } catch (_) {
      _rejectEnvironment();
      return;
    }
    if (!identical(next.stores, old.stores)) {
      next.dispose();
      _rejectEnvironment();
      return;
    }
    setState(() {
      _dependencies = next;
      _ownsDependencies = true;
    });
    // Gate removal disposes all borrowed controllers before closing transports.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      old.dispose();
    });
    unawaited(next.initialize());
    _switching = false;
  }

  void _rejectEnvironment() {
    _switching = false;
    if (mounted) setState(() => _environmentError = '环境切换未完成，请重试或继续当前环境');
  }

  @override
  void dispose() {
    if (_ownsDependencies) _dependencies.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _dependencies.theme,
    builder: (context, _) => MaterialApp(
      title: '赛事管理',
      debugShowCheckedModeBanner: false,
      theme: AdminTheme.build(dark: _dependencies.theme.dark),
      locale: AdminLocalizations.locale,
      supportedLocales: AdminLocalizations.supportedLocales,
      localizationsDelegates: AdminLocalizations.delegates,
      home: Column(
        children: [
          if (_environmentError != null)
            SafeArea(
              bottom: false,
              child: MaterialBanner(
                content: Text(_environmentError!),
                actions: [
                  TextButton(
                    onPressed: () => setState(() => _environmentError = null),
                    child: const Text("关闭"),
                  ),
                ],
              ),
            ),
          Expanded(
            child: SessionGate(
              key: ObjectKey(_dependencies),
              dependencies: _dependencies,
              onEnvironment: _switchEnvironment,
            ),
          ),
        ],
      ),
    ),
  );
}
