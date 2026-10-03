import 'package:flutter/material.dart';
import '../features/dashboard/application/dashboard_controller.dart';
import '../features/matches/application/match_list_controller.dart';
import '../features/teams/application/team_controller.dart';
import '../features/members/application/member_controller.dart';
import '../features/team_fund/application/fund_controller.dart';
import '../features/team_fund/domain/fund_models.dart';
import '../features/session/application/session_controller.dart';
import '../features/session/domain/admin_session.dart';
import 'app_dependencies.dart';

/// One authenticated generation owns all controllers, routes and transient UI.
/// Retirement is synchronous with session notification, before the next frame.
class ProtectedWorkspace {
  ProtectedWorkspace(this.dependencies)
    : generation = dependencies.session.generation,
      admin = dependencies.session.state.admin! {
    matches = own(MatchListController(repository: dependencies.matches));
    teams = own(
      TeamController(
        repository: dependencies.teams,
        changes: dependencies.changes,
      ),
    );
    dashboard = own(
      DashboardController(
        matches: dependencies.matches,
        health: () async {
          await dependencies.api.request(
            'GET',
            '/health',
            authenticated: false,
            adminPrefix: false,
          );
        },
        changes: dependencies.changes,
      ),
    );
  }
  final AppDependencies dependencies;
  final int generation;
  final AdminUser admin;
  final navigatorKey = GlobalKey<NavigatorState>();
  final messengerKey = GlobalKey<ScaffoldMessengerState>();
  final Set<ChangeNotifier> _controllers = {};
  final Map<int, MemberController> _members = {};
  final Map<FundScope, FundController> _funds = {};
  late final MatchListController matches;
  late final TeamController teams;
  late final DashboardController dashboard;
  bool _disposed = false;
  bool get isCurrent =>
      !_disposed &&
      dependencies.session.state.phase == SessionPhase.signedIn &&
      dependencies.session.generation == generation &&
      dependencies.session.state.admin?.id == admin.id;
  T own<T extends ChangeNotifier>(T controller) {
    _controllers.add(controller);
    return controller;
  }

  void release(ChangeNotifier controller) {
    if (_controllers.remove(controller)) controller.dispose();
  }

  MemberController members(int teamId) => _members.putIfAbsent(
    teamId,
    () => own(
      MemberController(
        repository: dependencies.members,
        teamId: teamId,
        changes: dependencies.changes,
      ),
    ),
  );
  FundController funds(int teamId, int userId) {
    final scope = FundScope(dependencies.baseUrl, admin.id, teamId, userId);
    return _funds.putIfAbsent(
      scope,
      () => own(
        FundController(
          scope: scope,
          repository: dependencies.funds,
          store: dependencies.pendingFunds,
          isCurrent: () => isCurrent,
          changes: dependencies.changes,
        ),
      ),
    );
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    for (final controller in _controllers.toList()) {
      release(controller);
    }
    _members.clear();
    _funds.clear();
  }
}

/// Controller owner for a single route, sharing the workspace teardown registry.
class OwnedRoute extends StatefulWidget {
  const OwnedRoute({
    super.key,
    required this.workspace,
    required this.controller,
    required this.child,
  });
  final ProtectedWorkspace workspace;
  final ChangeNotifier controller;
  final Widget child;
  @override
  State<OwnedRoute> createState() => _OwnedRouteState();
}

class _OwnedRouteState extends State<OwnedRoute> {
  @override
  void dispose() {
    widget.workspace.release(widget.controller);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
