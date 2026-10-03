import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:registration_system_admin_app/app/admin_navigation.dart';
import 'package:registration_system_admin_app/app/admin_shell.dart';
import 'package:registration_system_admin_app/app/app_dependencies.dart';
import 'package:registration_system_admin_app/app/protected_workspace.dart';
import 'package:registration_system_admin_app/design_system/design_system.dart';
import 'package:registration_system_admin_app/features/session/presentation/login_page.dart';
import 'package:registration_system_admin_app/features/teams/presentation/team_list_page.dart';
import 'package:registration_system_admin_app/features/members/presentation/member_candidate_page.dart';
import 'package:registration_system_admin_app/features/members/presentation/member_edit_page.dart';
import 'package:registration_system_admin_app/features/team_fund/domain/fund_models.dart';
import '../support/fake_storage.dart';
import '../support/workspace_transport.dart';

/// Independent offline native entrypoint. Production main never imports this.
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const NativeSceneHarness());
}

class NativeSceneHarness extends StatefulWidget {
  const NativeSceneHarness({super.key});
  @override
  State<NativeSceneHarness> createState() => _NativeSceneHarnessState();
}

class _NativeSceneHarnessState extends State<NativeSceneHarness> {
  static const scenes = [
    'shell',
    'login',
    'match-list',
    'match-detail',
    'match-create',
    'match-edit',
    'team-list',
    'team-detail',
    'team-create',
    'team-edit',
    'members',
    'member-detail',
    'member-candidates',
    'member-edit',
    'member-profile',
    'fund-history',
    'fund-credit',
    'fund-consume',
    'fund-reversal',
    'pending',
    'empty',
    'error',
    'long',
    'loading',
  ];
  static const initial = String.fromEnvironment(
    'HARNESS_SCENE',
    defaultValue: 'shell',
  );
  static const initialDark = bool.fromEnvironment(
    'HARNESS_DARK',
    defaultValue: true,
  );
  static const initialScale = String.fromEnvironment(
    'HARNESS_TEXT_SCALE',
    defaultValue: '1',
  );
  static const initialWidth = String.fromEnvironment(
    'HARNESS_WIDTH',
    defaultValue: '0',
  );
  final transport = WorkspaceTransport();
  bool buildInfoFailure = false;
  late final dependencies = AppDependencies(
    baseUrl: Uri.parse(
      const bool.fromEnvironment('HARNESS_LONG_ACCOUNT')
          ? 'https://offline-mobile-acceptance.environment.fixture.invalid'
          : 'https://fixture.invalid',
    ),
    transport: transport,
    buildVersionReader: () async {
      if (buildInfoFailure) throw StateError('离线构建版本读取失败，请重试');
      return '离线验收fixture (1)';
    },
    storage: FakeSecureStore(),
    preferences: FakePreferencesStore(dark: initialDark),
  );
  ProtectedWorkspace? workspace;
  bool ready = false;
  bool dark = initialDark;
  double scale = double.parse(initialScale), width = double.parse(initialWidth);
  String? error;
  @override
  void initState() {
    super.initState();
    unawaited(_prepare());
    if (const bool.fromEnvironment('HARNESS_CONTROL')) {
      developer.registerExtension('ext.adminAcceptance.configure', _configure);
    }
  }

  /// Debug VM service control, available only in this offline test entrypoint.
  Future<developer.ServiceExtensionResponse> _configure(
    String method,
    Map<String, String> params,
  ) async {
    final scene = params['scene'];
    if (params.containsKey('orientation')) {
      await SystemChrome.setPreferredOrientations(
        params['orientation'] == 'landscape'
            ? [
                DeviceOrientation.landscapeLeft,
                DeviceOrientation.landscapeRight,
              ]
            : [DeviceOrientation.portraitUp],
      );
    }
    if (params['retryPending'] == 'true') {
      await workspace?.funds(42, 7).retryPending();
    }
    if (params.containsKey('buildInfoError')) {
      buildInfoFailure = params['buildInfoError'] == 'true';
      await dependencies.buildInfo.refresh();
    }
    if (params.containsKey('longError')) {
      transport.readErrorMessage = params['longError'] == 'true'
          ? '离线验收读取失败：当前数据暂时无法加载，请核对网络连接，稍后重试；已有输入会保留，操作结果需要先核实，避免重复提交。'
          : '读取暂时失败，请重试';
    }
    if (!ready || (scene != null && !scenes.contains(scene))) {
      return developer.ServiceExtensionResponse.error(
        -32602,
        'Invalid scene or not ready',
      );
    }
    if (scene != null) {
      workspace?.navigatorKey.currentState?.popUntil((route) => route.isFirst);
    }
    if (scene != null) {
      transport.readBarrier?.complete();
      transport.readBarrier = null;
    }
    if (scene == 'loading') transport.readBarrier = Completer<void>();
    if (scene == 'login') await dependencies.session.logout();
    if (scene != null && scene != 'login' && !workspace!.isCurrent) {
      workspace!.dispose();
      await dependencies.session.login('离线验收运营员', 'offline-only');
      workspace = ProtectedWorkspace(dependencies);
    }
    setState(() {
      if (params.containsKey('dark')) dark = params['dark'] == 'true';
      if (params.containsKey('scale')) scale = double.parse(params['scale']!);
      if (params.containsKey('width')) width = double.parse(params['width']!);
    });
    await dependencies.theme.setDark(dark);
    if (scene != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (scene == 'login') {
          unawaited(_push(LoginPage(controller: dependencies.session)));
        } else {
          unawaited(_open(scene));
        }
      });
    }
    if (params['scroll'] == 'bottom' ||
        params['keyboard'] == 'show' ||
        params.containsKey('tab')) {
      var focused = false;
      void visit(Element element) {
        if (params.containsKey('tab') &&
            element.widget is NavigationBar &&
            ModalRoute.of(element)?.isCurrent == true) {
          (element.widget as NavigationBar).onDestinationSelected?.call(
            int.parse(params['tab']!),
          );
        }
        if (element is StatefulElement &&
            ModalRoute.of(element)?.isCurrent == true) {
          final state = element.state;
          if (params['scroll'] == 'bottom' &&
              state is ScrollableState &&
              state.position.hasContentDimensions) {
            state.position.jumpTo(state.position.maxScrollExtent);
          }
          if (!focused &&
              params['keyboard'] == 'show' &&
              state is EditableTextState &&
              !state.widget.readOnly) {
            focused = true;
            state.widget.focusNode.requestFocus();
            return;
          }
        }
        element.visitChildren(visit);
      }

      (context as Element).visitChildren(visit);
    }
    final view = View.of(context);
    final nativeWidth = view.physicalSize.width / view.devicePixelRatio;
    return developer.ServiceExtensionResponse.result(
      jsonEncode({
        'scene': scene,
        'dark': dark,
        'textScale': scale,
        'nativeLogicalWidth': nativeWidth,
        'layoutWidth': width > 0 ? width.clamp(0, nativeWidth) : nativeWidth,
        'nativeLogicalHeight': view.physicalSize.height / view.devicePixelRatio,
      }),
    );
  }

  Future<void> _prepare() async {
    if (!scenes.contains(initial)) {
      setState(() => error = 'Unknown HARNESS_SCENE: $initial');
      return;
    }
    if (initial == 'empty') transport.matches.clear();
    if (initial == 'long') {
      transport.matches.first['name'] = '星河赛事运营与球队管理长名称场景 · 周末联合友谊赛第十二轮';
      transport.teams.first['name'] = '星河社区足球俱乐部长名称代表队 · 联合训练组';
      transport.members.first['real_name'] = '长名称成员 · 运营验收场景';
    }
    await dependencies.initialize();
    if (initial != 'login') {
      await dependencies.session.login('离线验收运营员', 'offline-only');
    }
    if (initial == 'error') transport.failRead = true;
    if (initial != 'login') {
      workspace = ProtectedWorkspace(dependencies);
      if (initial == 'pending') {
        final fund = workspace!.funds(42, 7);
        await dependencies.pendingFunds.save(
          PendingFundAction(
            scope: fund.scope,
            draft: FundDraft(
              action: FundAction.credit,
              amountCents: 12345,
              receivedOn: '2026-10-03',
              note: '请核实这笔待确认充值；原金额与幂等键保持不变',
            ),
            key: 'offline-pending-key',
            createdAt: DateTime.utc(2026, 10, 3, 8),
          ),
        );
      }
    }
    if (!mounted) return;
    setState(() => ready = true);
    if (initial != 'login') {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => unawaited(_open(initial)),
      );
    }
  }

  Future<void> _open(String scene) async {
    final w = workspace;
    if (w == null) return;
    final nav = AdminNavigation(w);
    transport.failRead = scene == 'error';
    if (scene == 'empty') {
      transport.matches.clear();
    } else if (transport.matches.isEmpty) {
      transport.matches.add(WorkspaceTransport.match('fixture-match', '周末友谊赛'));
    }
    if (scene == 'long') {
      transport.matches.first['name'] = '星河赛事运营与球队管理长名称场景 · 周末联合友谊赛第十二轮';
      transport.teams.first['name'] = '星河社区足球俱乐部长名称代表队 · 联合训练组';
      transport.members.first['real_name'] = '长名称成员 · 运营验收场景';
    }
    switch (scene) {
      case 'shell':
        await _push(AdminShell(workspace: w, onEnvironment: (_) async {}));
        return;
      case 'team-list':
        await _push(
          TeamListPage(
            controller: w.teams,
            onOpenTeam: nav.openTeam,
            onCreate: nav.createTeam,
          ),
        );
        return;
      case 'match-list':
      case 'empty':
      case 'error':
      case 'long':
      case 'loading':
        await nav.openMatchQuery();
        return;
      case 'match-detail':
        await nav.openMatch('fixture-match');
        return;
      case 'match-create':
        await nav.createMatch();
        return;
      case 'match-edit':
        await nav.editMatch(await dependencies.matches.get('fixture-match'));
        return;
    }
    final team = await dependencies.teams.get(42);
    if (!mounted) return;
    switch (scene) {
      case 'team-detail':
        await nav.openTeam(team);
        return;
      case 'team-create':
        await nav.createTeam();
        return;
      case 'team-edit':
        await nav.editTeam(team);
        return;
    }
    final members = w.members(42);
    await members.load();
    final member = members.memberById(7)!;
    switch (scene) {
      case 'members':
        await nav.openMembers(team);
        return;
      case 'member-detail':
        await nav.openMember(team, 7);
        return;
      case 'member-candidates':
        await _push(MemberCandidatePage(controller: members));
        return;
      case 'member-edit':
        await _push(
          MemberEditPage(
            controller: members,
            userId: 7,
            mode: MemberEditMode.membership,
          ),
        );
        return;
      case 'member-profile':
        await _push(
          MemberEditPage(
            controller: members,
            userId: 7,
            mode: MemberEditMode.profile,
          ),
        );
        return;
      case 'fund-history':
        await nav.openFunds(team, member);
        return;
      case 'fund-credit':
      case 'pending':
        await nav.fundForm(team, member, FundAction.credit);
        return;
      case 'fund-consume':
        await nav.fundForm(team, member, FundAction.consume);
        return;
      case 'fund-reversal':
        final fund = w.funds(42, 7);
        await fund.restore();
        await fund.submit(
          FundDraft(
            action: FundAction.credit,
            amountCents: 10000,
            receivedOn: '2026-10-03',
            note: '线下充值示例',
          ),
        );
        await fund.refreshTransactions();
        await nav.fundForm(
          team,
          member,
          FundAction.reversal,
          original: fund.transactions.first,
        );
        return;
    }
  }

  Future<void> _push(Widget page) async {
    await workspace!.navigatorKey.currentState!.push<void>(
      MaterialPageRoute(builder: (_) => page),
    );
  }

  @override
  void dispose() {
    workspace?.dispose();
    dependencies.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: AdminTheme.build(dark: dark),
    locale: AdminLocalizations.locale,
    supportedLocales: AdminLocalizations.supportedLocales,
    localizationsDelegates: AdminLocalizations.delegates,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(textScaler: TextScaler.linear(scale)),
      child: Center(
        child: SizedBox(
          width: width > 0 ? width : double.infinity,
          child: child,
        ),
      ),
    ),
    home: error != null
        ? Scaffold(body: Center(child: Text(error!)))
        : !ready
        ? const Scaffold(body: Center(child: CircularProgressIndicator()))
        : initial == 'login'
        ? LoginPage(controller: dependencies.session)
        : ScaffoldMessenger(
            key: workspace!.messengerKey,
            child: NavigatorPopHandler<Object?>(
              onPopWithResult: (result) =>
                  workspace!.navigatorKey.currentState?.pop(result),
              child: Navigator(
                key: workspace!.navigatorKey,
                onGenerateRoute: (_) => MaterialPageRoute<void>(
                  builder: (context) => _HarnessMenu(
                    onScene: _open,
                    scenes: scenes.where((s) => s != 'login').toList(),
                    dark: dark,
                    onDark: (value) => setState(() => dark = value),
                    scale: scale,
                    onScale: (value) => setState(() => scale = value),
                    onWorkspace: () => _push(
                      AdminShell(
                        workspace: workspace!,
                        onEnvironment: (_) async {},
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
  );
}

class _HarnessMenu extends StatelessWidget {
  const _HarnessMenu({
    required this.onScene,
    required this.scenes,
    required this.dark,
    required this.onDark,
    required this.scale,
    required this.onScale,
    required this.onWorkspace,
  });
  final Future<void> Function(String) onScene;
  final List<String> scenes;
  final bool dark;
  final ValueChanged<bool> onDark;
  final double scale;
  final ValueChanged<double> onScale;
  final VoidCallback onWorkspace;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('离线原生场景验收')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('只使用虚构离线数据。打开场景后为实际产品页面；返回这里切换主题与文字大小。'),
        SwitchListTile(title: const Text('深色'), value: dark, onChanged: onDark),
        Text('文字大小：${scale.toStringAsFixed(1)} 倍'),
        Slider(
          value: scale.clamp(1, 2),
          min: 1,
          max: 2,
          divisions: 2,
          onChanged: onScale,
        ),
        FilledButton(onPressed: onWorkspace, child: const Text('打开完整工作区')),
        for (final scene in scenes.where((s) => s != 'shell'))
          ListTile(
            title: Text(scene),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => onScene(scene),
          ),
      ],
    ),
  );
}
