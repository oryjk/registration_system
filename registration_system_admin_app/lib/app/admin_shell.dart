import 'package:flutter/material.dart';
import '../features/account/presentation/account_page.dart';
import '../features/dashboard/presentation/dashboard_page.dart';
import '../features/matches/presentation/match_list_page.dart';
import '../features/teams/presentation/team_list_page.dart';
import 'admin_navigation.dart';
import 'protected_workspace.dart';

class AdminShell extends StatefulWidget {
  const AdminShell({
    super.key,
    required this.workspace,
    required this.onEnvironment,
  });
  final ProtectedWorkspace workspace;
  final Future<void> Function(Uri) onEnvironment;
  @override
  State<AdminShell> createState() => _AdminShellState();
}

class _AdminShellState extends State<AdminShell> {
  int _tab = 0;
  late final navigation = AdminNavigation(widget.workspace);
  late final List<Widget> _pages = [
    DashboardPage(
      controller: widget.workspace.dashboard,
      username: widget.workspace.admin.username,
      onMatch: (match) => navigation.openMatch(match.id),
      onCreateMatch: navigation.createMatch,
      onCreateTeam: navigation.createTeam,
      onTeams: () => setState(() => _tab = 2),
    ),
    MatchListPage(
      controller: widget.workspace.matches,
      changes: widget.workspace.dependencies.changes,
      onOpenMatch: (match) => navigation.openMatch(match.id),
      onCreate: navigation.createMatch,
    ),
    TeamListPage(
      controller: widget.workspace.teams,
      onOpenTeam: navigation.openTeam,
      onCreate: navigation.createTeam,
    ),
    AccountPage(
      session: widget.workspace.dependencies.session,
      theme: widget.workspace.dependencies.theme,
      buildInfo: widget.workspace.dependencies.buildInfo,
      environment: widget.workspace.dependencies.baseUrl,
      onEnvironment: widget.onEnvironment,
    ),
  ];
  @override
  void initState() {
    super.initState();
    widget.workspace.dashboard.refresh();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: IndexedStack(index: _tab, children: _pages),
    bottomNavigationBar: NavigationBar(
      selectedIndex: _tab,
      onDestinationSelected: (index) => setState(() => _tab = index),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.dashboard_outlined),
          selectedIcon: Icon(Icons.dashboard),
          label: '工作台',
        ),
        NavigationDestination(
          icon: Icon(Icons.sports_soccer_outlined),
          selectedIcon: Icon(Icons.sports_soccer),
          label: '比赛',
        ),
        NavigationDestination(
          icon: Icon(Icons.groups_outlined),
          selectedIcon: Icon(Icons.groups),
          label: '球队',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline),
          selectedIcon: Icon(Icons.person),
          label: '我的',
        ),
      ],
    ),
  );
}
