import 'package:flutter/material.dart';
import '../features/matches/application/match_detail_controller.dart';
import '../features/matches/application/match_form_controller.dart';
import '../features/matches/application/match_list_controller.dart';
import '../features/matches/domain/match_models.dart';
import '../features/matches/presentation/match_detail_page.dart';
import '../features/matches/presentation/match_form_page.dart';
import '../features/matches/presentation/match_list_page.dart';
import '../features/teams/application/team_controller.dart';
import '../features/teams/presentation/team_detail_page.dart';
import '../features/teams/presentation/team_form_page.dart';
import '../features/members/domain/member_models.dart';
import '../features/members/presentation/member_list_page.dart';
import '../features/members/presentation/member_detail_page.dart';
import '../features/members/presentation/member_candidate_page.dart';
import '../features/members/presentation/member_edit_page.dart';
import '../features/team_fund/domain/fund_models.dart';
import '../features/team_fund/presentation/fund_form_page.dart';
import '../features/team_fund/presentation/fund_transactions_page.dart';
import 'protected_workspace.dart';

class AdminNavigation {
  AdminNavigation(this.workspace);
  final ProtectedWorkspace workspace;
  Future<T?> _push<T>(Widget page, String name) {
    if (!workspace.isCurrent) return Future.value();
    return workspace.navigatorKey.currentState!.push<T>(
      MaterialPageRoute(
        builder: (_) => page,
        settings: RouteSettings(name: name),
      ),
    );
  }

  void _pop([Object? result]) {
    if (workspace.isCurrent) workspace.navigatorKey.currentState?.pop(result);
  }

  void _savedMessage(String message) {
    if (!workspace.isCurrent) return;
    workspace.messengerKey.currentState?.showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Widget _owned(ChangeNotifier controller, Widget child) =>
      OwnedRoute(workspace: workspace, controller: controller, child: child);
  Future<MatchDetail?> openMatch(String id) {
    if (!workspace.isCurrent) return Future.value();
    final controller = workspace.own(
      MatchDetailController(
        repository: workspace.dependencies.matches,
        id: id,
        isSuperAdmin: workspace.admin.isSuperAdmin,
        changes: workspace.dependencies.changes,
      ),
    );
    return _push(
      _owned(
        controller,
        MatchDetailPage(
          controller: controller,
          changes: workspace.dependencies.changes,
          onEdit: (detail) => editMatch(detail),
          onDeleted: () => _pop(),
          onReturnToList: () => _pop(),
        ),
      ),
      'match/$id',
    );
  }

  Future<void> createMatch() async => _matchForm();
  Future<void> editMatch(MatchDetail detail) async => _matchForm(detail);
  Future<void> _matchForm([MatchDetail? detail]) async {
    if (!workspace.isCurrent) return;
    final controller = workspace.own(
      MatchFormController(
        repository: workspace.dependencies.matches,
        id: detail?.match.id,
        changes: workspace.dependencies.changes,
      ),
    );
    final result = await _push<MatchDetail>(
      _owned(
        controller,
        MatchFormPage(
          controller: controller,
          teamRepository: workspace.dependencies.teams,
          initialDetail: detail,
          onSaved: (result) => _pop(result),
          onCheckOutcome: () async {
            if (detail != null) {
              await openMatch(detail.match.id);
            } else {
              await openMatchQuery();
            }
          },
        ),
      ),
      detail == null ? 'match/create' : 'match/${detail.match.id}/edit',
    );
    if (result != null && workspace.isCurrent) {
      _savedMessage('比赛已保存');
      if (detail == null) await openMatch(result.match.id);
    }
  }

  /// Dedicated real read route. Awaiting return leaves uncertain form locked.
  Future<void> openMatchQuery() async {
    if (!workspace.isCurrent) return;
    final controller = workspace.own(
      MatchListController(repository: workspace.dependencies.matches),
    );
    await _push<void>(
      _owned(
        controller,
        MatchListPage(
          controller: controller,
          changes: workspace.dependencies.changes,
          onOpenMatch: (match) => openMatch(match.id),
          onCreate: createMatch,
        ),
      ),
      'matches/check-outcome',
    );
  }

  Future<Team?> openTeam(Team team) {
    if (!workspace.isCurrent) return Future.value();
    final controller = workspace.own(
      TeamController(
        repository: workspace.dependencies.teams,
        changes: workspace.dependencies.changes,
        initialTeam: team,
      ),
    );
    return _push(
      _owned(
        controller,
        TeamDetailPage(
          controller: controller,
          id: team.id,
          onEdit: (team) => editTeam(team),
          onMembers: openMembers,
          onFund: openMembers,
          onDeleted: () => _pop(),
        ),
      ),
      'team/${team.id}',
    );
  }

  Future<void> createTeam() async => _teamForm();
  Future<void> editTeam(Team team) async => _teamForm(team);
  Future<void> _teamForm([Team? team]) async {
    if (!workspace.isCurrent) return;
    final controller = workspace.own(
      TeamController(
        repository: workspace.dependencies.teams,
        changes: workspace.dependencies.changes,
        initialTeam: team,
      ),
    );
    final result = await _push<Team>(
      _owned(
        controller,
        TeamFormPage(
          controller: controller,
          initialTeam: team,
          onSaved: (result) => _pop(result),
        ),
      ),
      team == null ? 'team/create' : 'team/${team.id}/edit',
    );
    if (result != null && workspace.isCurrent) {
      _savedMessage('球队已保存');
      if (team == null) await openTeam(result);
    }
  }

  Future<void> openMembers(Team team) async {
    if (!workspace.isCurrent) return;
    final controller = workspace.members(team.id);
    await _push<void>(
      MemberListPage(
        controller: controller,
        onMember: (member) => openMember(team, member.userId),
        onAdd: () => _push<void>(
          MemberCandidatePage(controller: controller, onAdded: () => _pop()),
          'team/${team.id}/members/add',
        ),
      ),
      'team/${team.id}/members',
    );
  }

  Future<void> openMember(Team team, int userId) async {
    if (!workspace.isCurrent) return;
    final controller = workspace.members(team.id);
    await _push<void>(
      MemberDetailPage(
        controller: controller,
        userId: userId,
        onEditMember: (member) =>
            _editMember(team, member, MemberEditMode.membership),
        onEditProfile: (member) =>
            _editMember(team, member, MemberEditMode.profile),
        onFund: (member) => openFunds(team, member),
        onRemoved: () => _pop(),
      ),
      'team/${team.id}/member/$userId',
    );
  }

  Future<void> _editMember(
    Team team,
    Member member,
    MemberEditMode mode,
  ) async {
    if (!workspace.isCurrent) return;
    await _push<void>(
      MemberEditPage(
        controller: workspace.members(team.id),
        userId: member.userId,
        mode: mode,
        onSaved: () => _pop(),
      ),
      'team/${team.id}/member/${member.userId}/edit',
    );
  }

  Future<void> openFunds(Team team, Member member) async {
    if (!workspace.isCurrent) return;
    final controller = workspace.funds(team.id, member.userId);
    await _push<void>(
      FundTransactionsPage(
        controller: controller,
        memberName: member.displayName,
        teamName: team.name,
        balanceCents: member.balanceCents,
        avatarUrl: member.avatarUrl,
        onCredit: () => fundForm(team, member, FundAction.credit),
        onConsume: () => fundForm(team, member, FundAction.consume),
        onReverse: (transaction) =>
            fundForm(team, member, FundAction.reversal, original: transaction),
      ),
      'team/${team.id}/member/${member.userId}/funds',
    );
  }

  Future<void> fundForm(
    Team team,
    Member member,
    FundAction action, {
    FundTransaction? original,
  }) async {
    if (!workspace.isCurrent) return;
    final controller = workspace.funds(team.id, member.userId);
    await _push<void>(
      FundFormPage(
        controller: controller,
        action: action,
        memberName: member.displayName,
        teamName: team.name,
        balanceCents: controller.balanceCents ?? member.balanceCents,
        avatarUrl: member.avatarUrl,
        original: original,
        onSaved: () => _pop(),
      ),
      'team/${team.id}/member/${member.userId}/funds/${action.name}',
    );
    if (workspace.isCurrent) await controller.refreshTransactions();
  }
}
