import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/app/admin_app.dart';
import 'package:registration_system_admin_app/app/admin_shell.dart';
import 'package:registration_system_admin_app/app/admin_navigation.dart';
import 'package:registration_system_admin_app/app/app_dependencies.dart';
import 'package:registration_system_admin_app/app/protected_workspace.dart';
import 'package:registration_system_admin_app/core/state/resource_changes.dart';
import 'package:registration_system_admin_app/core/time/beijing_time.dart';
import 'package:registration_system_admin_app/features/matches/application/match_detail_controller.dart';
import 'package:registration_system_admin_app/features/matches/application/match_form_controller.dart';
import 'package:registration_system_admin_app/features/matches/domain/match_draft.dart';
import 'package:registration_system_admin_app/features/matches/presentation/match_list_page.dart';
import 'package:registration_system_admin_app/features/matches/presentation/match_form_page.dart';
import 'package:registration_system_admin_app/features/teams/application/team_controller.dart';
import 'package:registration_system_admin_app/features/teams/domain/team_draft.dart';
import 'package:registration_system_admin_app/features/team_fund/domain/fund_models.dart';
import 'package:registration_system_admin_app/features/team_fund/application/fund_controller.dart';
import 'package:registration_system_admin_app/features/team_fund/presentation/fund_form_page.dart';
import 'package:registration_system_admin_app/features/team_fund/presentation/fund_transactions_page.dart';
import 'package:registration_system_admin_app/features/teams/presentation/team_detail_page.dart';
import '../support/fake_storage.dart';
import '../support/workspace_transport.dart';

AppDependencies fixture(
  WorkspaceTransport transport, {
  FakeSecureStore? storage,
}) => AppDependencies(
  baseUrl: Uri.parse('https://fixture.invalid'),
  transport: transport,
  storage: storage ?? FakeSecureStore(),
  preferences: FakePreferencesStore(),
);
Future<void> login(AppDependencies d) async {
  await d.initialize();
  await d.session.login('运营甲', 'fixture');
}

void main() {
  testWidgets(
    'tab changes retain match search and scroll; changes refresh once without loops',
    (tester) async {
      final transport = WorkspaceTransport();
      transport.matches.addAll(
        List.generate(20, (i) => WorkspaceTransport.match('m$i', '周末第$i场')),
      );
      final d = fixture(transport);
      await tester.pumpWidget(AdminApp(dependencies: d));
      await tester.pumpAndSettle();
      await d.session.login('运营甲', 'fixture');
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(NavigationDestination, '比赛'));
      await tester.pumpAndSettle();
      final list = tester.widget<MatchListPage>(find.byType(MatchListPage));
      await list.controller.setFilter(search: '周末', status: 'registering');
      await tester.pumpAndSettle();
      final scroll = find
          .descendant(
            of: find.byType(MatchListPage),
            matching: find.byType(Scrollable),
          )
          .last;
      await tester.drag(scroll, const Offset(0, -800));
      await tester.pumpAndSettle();
      final before = tester.state<ScrollableState>(scroll).position.pixels;
      await tester.tap(find.widgetWithText(NavigationDestination, '球队'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(NavigationDestination, '比赛'));
      await tester.pumpAndSettle();
      expect(list.controller.query.search, '周末');
      expect(list.controller.query.status, 'registering');
      expect(tester.state<ScrollableState>(scroll).position.pixels, before);
      final reads = transport.requests
          .where((r) => r.url.path == '/api/v1/admin/matches')
          .length;
      d.changes.emit(ResourceKind.matches);
      await tester.pumpAndSettle();
      expect(
        transport.requests
            .where((r) => r.url.path == '/api/v1/admin/matches')
            .length,
        reads + 2,
      ); // mounted list + dashboard
      await tester.pump(const Duration(seconds: 1));
      expect(
        transport.requests
            .where((r) => r.url.path == '/api/v1/admin/matches')
            .length,
        reads + 2,
      );
      await tester.pumpWidget(const SizedBox());
      d.dispose();
    },
  );

  test(
    'real repositories/controllers complete operations, restart pending preserves key and payload',
    () async {
      final transport = WorkspaceTransport(), storage = FakeSecureStore();
      final d = fixture(transport, storage: storage);
      await login(d);
      final workspace = ProtectedWorkspace(d);
      final teamForm = workspace.own(
        TeamController(repository: d.teams, changes: d.changes),
      );
      await teamForm.save(TeamDraft(name: '新建球队', description: '测试队'));
      final team = teamForm.savedTeam!;
      final members = workspace.members(team.id);
      await members.load();
      await members.searchCandidates('周');
      await members.addCandidate(members.candidateState.data!.first, 'member');
      expect(members.memberById(8)?.nickname, '新队员小周');
      expect(members.memberById(2), isNull);
      final matchForm = workspace.own(
        MatchFormController(repository: d.matches, changes: d.changes),
      );
      final detail = await matchForm.save(
        MatchDraft(
          name: '新建赛事',
          hostTeamId: team.id,
          startTime: BeijingClock(2026, 10, 4, 16, 0),
          location: '测试场地',
        ),
      );
      expect(detail!.groups.first.registrations, isNotEmpty);
      final match = workspace.own(
        MatchDetailController(
          repository: d.matches,
          id: detail.match.id,
          changes: d.changes,
        ),
      );
      await match.load();
      await match.changeStatus('ongoing');
      await match.saveScore(0, 0);
      await match.changeStatus('ended');
      expect(match.state.data!.match.status, 'ended');
      expect(match.state.data!.match.hostScore, 0);
      expect(match.state.data!.match.awayScore, 0);
      final fund = workspace.funds(team.id, 8);
      await fund.restore();
      await fund.submit(
        FundDraft(
          action: FundAction.credit,
          amountCents: 1000,
          receivedOn: '2026-10-03',
          note: '充值',
        ),
      );
      expect(fund.result!.balanceCents, 3500);
      await fund.submit(
        FundDraft(action: FundAction.consume, amountCents: 300, note: '扣费'),
      );
      await fund.refreshTransactions();
      expect(fund.transactions.first.balanceAfterCents, 3200);
      await fund.submit(
        FundDraft(
          action: FundAction.reversal,
          originalTransactionId: fund.transactions.first.id,
          note: '冲正',
        ),
      );
      expect(fund.result!.balanceCents, 3500);
      transport.uncertainFund = true;
      await fund.submit(
        FundDraft(
          action: FundAction.credit,
          amountCents: 500,
          receivedOn: '2026-10-03',
          note: '重启恢复',
        ),
      );
      final pending = fund.pending!;
      expect(fund.phase, FundPhase.pending);
      workspace.dispose();
      await d.session.logout();
      await d.session.login('运营甲', 'fixture');
      final restarted = ProtectedWorkspace(d);
      final recovered = restarted.funds(team.id, 8);
      await recovered.restore();
      expect(recovered.pending!.key, pending.key);
      expect(recovered.pending!.draft.amountCents, 500);
      final count = transport.fundBodies.length;
      await recovered.submit(
        FundDraft(
          action: FundAction.credit,
          amountCents: 999,
          receivedOn: '2026-10-03',
        ),
      );
      expect(transport.fundBodies.length, count);
      transport.uncertainFund = false;
      await recovered.retryPending();
      expect(transport.fundBodies.last['idempotency_key'], pending.key);
      expect(transport.fundBodies.last['amount_cents'], 500);
      expect(recovered.result!.duplicated, isTrue);
      restarted.dispose();
      d.dispose();
    },
  );

  testWidgets(
    'uncertain match write opens real query and remains locked after returning',
    (tester) async {
      final transport = WorkspaceTransport();
      final d = fixture(transport);
      await login(d);
      final workspace = ProtectedWorkspace(d);
      final nav = AdminNavigation(workspace);
      await tester.pumpWidget(
        MaterialApp(
          home: Navigator(
            key: workspace.navigatorKey,
            onGenerateRoute: (_) => MaterialPageRoute<void>(
              builder: (_) => const Scaffold(body: Text('fixture home')),
            ),
          ),
        ),
      );
      transport.uncertainMatch = true;
      final opening = nav.createMatch();
      await tester.pumpAndSettle();
      final form = tester.widget<MatchFormPage>(find.byType(MatchFormPage));
      await form.controller.save(
        MatchDraft(
          name: '待核实',
          hostTeamId: 42,
          startTime: BeijingClock(2026, 10, 4, 16, 0),
          location: '场地',
        ),
      );
      await tester.pumpAndSettle();
      expect(form.controller.writeOutcomeUncertain, isTrue);
      await tester.tap(find.text('查看列表或详情核实结果'));
      await tester.pumpAndSettle();
      expect(find.byType(MatchListPage), findsOneWidget);
      expect(
        transport.requests.any(
          (r) => r.method == 'GET' && r.url.path.endsWith('/matches'),
        ),
        isTrue,
      );
      workspace.navigatorKey.currentState!.pop();
      await tester.pumpAndSettle();
      expect(form.controller.writeOutcomeUncertain, isTrue);
      expect(find.text('已核实未生效，解锁提交'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      // The form was intentionally left locked; no automatic write replay.
      expect(
        transport.requests
            .where((r) => r.method == 'POST' && r.url.path.endsWith('/matches'))
            .length,
        1,
      );
      // Navigator teardown need not complete abandoned route result futures.
      opening.ignore();
      await tester.pumpWidget(const SizedBox());
      workspace.dispose();
      d.dispose();
    },
  );
  testWidgets(
    'logout during fund persistence cannot dispatch under next account and keeps old pending',
    (tester) async {
      final storage = _BlockingFundStore(), transport = WorkspaceTransport();
      final d = fixture(transport, storage: storage);
      await tester.pumpWidget(AdminApp(dependencies: d));
      await tester.pumpAndSettle();
      await d.session.login('账号甲', 'fixture');
      await tester.pumpAndSettle();
      // Use the actual protected shell-owned workspace and its scoped controllers.
      final shell = tester.widget<AdminShell>(find.byType(AdminShell));
      final fund = shell.workspace.funds(42, 7);
      await fund.restore();
      final saving = fund.submit(
        FundDraft(
          action: FundAction.credit,
          amountCents: 1000,
          receivedOn: '2026-10-03',
        ),
      );
      await storage.started.future;
      await d.session.logout();
      await tester.pumpAndSettle();
      transport.adminId = 9002;
      await d.session.login('账号乙', 'fixture');
      await tester.pumpAndSettle();
      storage.release.complete();
      await saving;
      await tester.pumpAndSettle();
      expect(transport.fundBodies, isEmpty);
      final second = tester
          .widget<AdminShell>(find.byType(AdminShell))
          .workspace
          .funds(42, 7);
      await second.restore();
      expect(second.pending, isNull);
      expect(await d.pendingFunds.read(fund.scope), isNotNull);
      await tester.pumpWidget(const SizedBox());
      d.dispose();
    },
  );
  testWidgets(
    'create-team completion opens real detail; fund form shares history and returns after confirmed write',
    (tester) async {
      final transport = WorkspaceTransport();
      // Both forms use real pages and their submission/navigation callbacks.
      final dependencies = fixture(transport);
      await login(dependencies);
      final workspace = ProtectedWorkspace(dependencies);
      final navigation = AdminNavigation(workspace);
      await tester.pumpWidget(
        MaterialApp(
          home: Navigator(
            key: workspace.navigatorKey,
            onGenerateRoute: (_) => MaterialPageRoute<void>(
              builder: (_) => const Scaffold(body: Text('fixture home')),
            ),
          ),
        ),
      );
      final creating = navigation.createTeam();
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, '页面创建球队');
      await tester.tap(find.text('保存球队'));
      await tester.pumpAndSettle();
      expect(find.byType(TeamDetailPage), findsOneWidget);
      expect(find.text('页面创建球队'), findsWidgets);
      workspace.navigatorKey.currentState!.pop();
      await tester.pumpAndSettle();
      await creating;
      final team = await dependencies.teams.get(42),
          members = workspace.members(42);
      await members.load();
      final member = members.memberById(7)!;
      final history = navigation.openFunds(team, member);
      await tester.pumpAndSettle();
      final historyController = tester
          .widget<FundTransactionsPage>(find.byType(FundTransactionsPage))
          .controller;
      await tester.tap(find.text('登记收款'));
      await tester.pumpAndSettle();
      expect(
        identical(
          tester.widget<FundFormPage>(find.byType(FundFormPage)).controller,
          historyController,
        ),
        isTrue,
      );
      final amount = find.byKey(const Key('fundAmount'));
      await tester.scrollUntilVisible(
        amount,
        200,
        scrollable: find
            .descendant(
              of: find.byType(FundFormPage),
              matching: find.byType(Scrollable),
            )
            .last,
      );
      await tester.enterText(amount, '12.34');
      await tester.tap(find.text('确认收款登记'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      await tester.tap(find.text('确认'));
      await tester.pumpAndSettle();
      expect(find.byType(FundFormPage), findsNothing);
      expect(find.byType(FundTransactionsPage), findsOneWidget);
      expect(transport.fundBodies.single['user_id'], 7);
      expect(transport.fundBodies.single['amount_cents'], 1234);
      expect(historyController.transactions.single.balanceAfterCents, 3734);
      final firstKey = transport.fundBodies.single['idempotency_key'];
      await tester.tap(find.text('消费扣费'));
      await tester.pumpAndSettle();
      final consumeForm = tester.widget<FundFormPage>(
        find.byType(FundFormPage),
      );
      expect(identical(consumeForm.controller, historyController), isTrue);
      expect(find.text('本项已完成'), findsNothing);
      expect(find.text('确认消费扣费'), findsOneWidget);
      // Earlier confirmed state must not finish this new form or dispatch a write.
      expect(transport.fundBodies.length, 1);
      await tester.scrollUntilVisible(
        amount,
        200,
        scrollable: find
            .descendant(
              of: find.byType(FundFormPage),
              matching: find.byType(Scrollable),
            )
            .last,
      );
      await tester.enterText(amount, '2.50');
      final note = find.byKey(const Key('fundNote'));
      await tester.scrollUntilVisible(
        note,
        200,
        scrollable: find
            .descendant(
              of: find.byType(FundFormPage),
              matching: find.byType(Scrollable),
            )
            .last,
      );
      await tester.enterText(note, '场地费');
      await tester.tap(find.text('确认消费扣费'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('确认'));
      await tester.pumpAndSettle();
      expect(find.byType(FundFormPage), findsNothing);
      expect(transport.fundBodies.length, 2);
      expect(transport.fundBodies.last['idempotency_key'], isNot(firstKey));
      expect(transport.fundBodies.last['amount_cents'], 250);
      expect(transport.fundBodies.last['user_id'], 7);
      expect(historyController.result!.transactionId, 2);
      expect(historyController.result!.balanceCents, 3484);
      expect(historyController.transactions.first.id, 2);
      expect(historyController.transactions.first.amountCents, -250);

      workspace.navigatorKey.currentState!.pop();
      await tester.pumpAndSettle();
      await history;
      await tester.pumpWidget(const SizedBox());
      workspace.dispose();
      dependencies.dispose();
    },
  );
}

class _BlockingFundStore extends FakeSecureStore {
  final started = Completer<void>(), release = Completer<void>();
  @override
  Future<void> write(String key, String value) async {
    if (key.startsWith('admin_app.fund.')) {
      if (!started.isCompleted) started.complete();
      await release.future;
    }
    await super.write(key, value);
  }
}
