import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/app/admin_app.dart';
import 'package:registration_system_admin_app/app/app_dependencies.dart';
import 'package:registration_system_admin_app/features/session/application/session_controller.dart';
import 'package:registration_system_admin_app/features/matches/domain/match_models.dart';
import '../support/fake_storage.dart';
import '../support/workspace_transport.dart';
import 'package:registration_system_admin_app/features/matches/presentation/beijing_time_field.dart';
import 'package:registration_system_admin_app/features/matches/presentation/match_form_page.dart';
import 'package:registration_system_admin_app/features/matches/presentation/match_detail_page.dart';
import 'package:registration_system_admin_app/app/admin_shell.dart';
import 'package:registration_system_admin_app/app/protected_workspace.dart';
import 'package:registration_system_admin_app/features/team_fund/domain/fund_models.dart';

void main() {
  testWidgets(
    'bootstrap shows no protected workspace; 401 clears detail and dialog',
    (tester) async {
      final transport = WorkspaceTransport();
      final dependencies = AppDependencies(
        baseUrl: Uri.parse('https://fixture.invalid'),
        transport: transport,
        storage: FakeSecureStore(),
        preferences: FakePreferencesStore(),
      );
      await tester.pumpWidget(AdminApp(dependencies: dependencies));
      expect(find.text('正在恢复会话'), findsOneWidget);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('login.username')), '运营甲');
      await tester.enterText(
        find.byKey(const Key('login.password')),
        'fixture',
      );
      await tester.tap(find.text('登录'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('周末友谊赛').first);
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('开始比赛'),
        300,
        scrollable: find.byType(Scrollable).last,
      );
      ScaffoldMessenger.of(
        tester.element(find.byType(MatchDetailPage)),
      ).showSnackBar(const SnackBar(content: Text('旧账号操作反馈')));
      await tester.tap(find.text('开始比赛'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      transport.unauthorized = true;
      await expectLater(
        dependencies.matches.list(const MatchQuery()),
        throwsA(isA<Exception>()),
      );
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsNothing);
      expect(find.text('旧账号操作反馈'), findsNothing);
      expect(find.text('开始比赛'), findsNothing);
      expect(find.byKey(const Key('login.username')), findsOneWidget);
      expect(dependencies.session.state.phase, SessionPhase.signedOut);
      await tester.pumpWidget(const SizedBox());
      dependencies.dispose();
    },
  );
  for (final oldStatus in [200, 401]) {
    testWidgets('late detail $oldStatus cannot affect a new administrator', (
      tester,
    ) async {
      final transport = WorkspaceTransport();
      final d = AppDependencies(
        baseUrl: Uri.parse('https://fixture.invalid'),
        transport: transport,
        storage: FakeSecureStore(),
        preferences: FakePreferencesStore(),
      );
      await tester.pumpWidget(AdminApp(dependencies: d));
      await tester.pumpAndSettle();
      await d.session.login('账号甲', 'fixture');
      await tester.pumpAndSettle();
      transport.detailBarrier = Completer<void>();
      transport.detailStatus = oldStatus;
      await tester.tap(find.text('周末友谊赛').first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await d.session.logout();
      await tester.pumpAndSettle();
      transport.adminId = 9002;
      transport.matches.first['name'] = '账号乙专属比赛';
      await d.session.login('账号乙', 'fixture');
      await tester.pumpAndSettle();
      transport.detailBarrier!.complete();
      await tester.pumpAndSettle();
      expect(d.session.state.phase, SessionPhase.signedIn);
      expect(d.session.state.admin!.id, 9002);
      expect(find.text('账号乙专属比赛'), findsWidgets);
      expect(find.text('周末友谊赛'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      d.dispose();
    });
  }
  testWidgets('protected date and time pickers disappear on logout', (
    tester,
  ) async {
    final transport = WorkspaceTransport();
    final d = AppDependencies(
      baseUrl: Uri.parse('https://fixture.invalid'),
      transport: transport,
      storage: FakeSecureStore(),
      preferences: FakePreferencesStore(),
    );
    await tester.pumpWidget(AdminApp(dependencies: d));
    await tester.pumpAndSettle();
    for (final timePicker in [false, true]) {
      await d.session.login('运营甲', 'fixture');
      await tester.pumpAndSettle();
      await tester.tap(find.text('创建比赛').first);
      await tester.pumpAndSettle();
      final field = find.byWidgetPredicate(
        (w) => w is BeijingTimeField && w.label == '开始时间',
      );
      await tester.scrollUntilVisible(
        field,
        200,
        scrollable: find
            .descendant(
              of: find.byType(MatchFormPage),
              matching: find.byType(Scrollable),
            )
            .last,
      );
      await tester.tap(
        find.descendant(of: field, matching: find.byType(OutlinedButton)),
      );
      await tester.pumpAndSettle();
      expect(find.byType(DatePickerDialog), findsOneWidget);
      if (timePicker) {
        await tester.tap(find.text('确定'));
        await tester.pumpAndSettle();
        expect(find.byType(TimePickerDialog), findsOneWidget);
      }
      await d.session.logout();
      await tester.pumpAndSettle();
      expect(find.byType(DatePickerDialog), findsNothing);
      expect(find.byType(TimePickerDialog), findsNothing);
      expect(find.byType(MatchFormPage), findsNothing);
    }
    await tester.pumpWidget(const SizedBox());
    d.dispose();
  });
  testWidgets(
    'environment switch deletes old session before creating new resources; storage failure locks',
    (tester) async {
      final storage = FakeSecureStore();
      final d = AppDependencies(
        baseUrl: Uri.parse('https://fixture.invalid'),
        transport: WorkspaceTransport(),
        storage: storage,
        preferences: FakePreferencesStore(),
      );
      var creations = 0;
      AppDependencies? next;
      await tester.pumpWidget(
        AdminApp(
          dependencies: d,
          environmentFactory: (uri, stores) {
            creations++;
            expect(d.session.token, isNull);
            expect(d.session.state.phase, SessionPhase.signedOut);
            return next = AppDependencies(
              baseUrl: uri,
              transport: WorkspaceTransport(),
              stores: stores,
            );
          },
        ),
      );
      await tester.pumpAndSettle();
      await d.session.login('运营甲', 'fixture');
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(NavigationDestination, '我的'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('切换开发环境'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextField).last,
        'https://other.invalid',
      );
      storage.deleteError = StateError('fixture failure');
      await tester.tap(find.text('切换'));
      await tester.pumpAndSettle();
      expect(creations, 0);
      expect(d.session.state.phase, SessionPhase.recoverableError);
      storage.deleteError = null;
      await d.session.retry();
      await tester.pumpAndSettle();
      await d.session.login('运营甲', 'fixture');
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(NavigationDestination, '我的'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('切换开发环境'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextField).last,
        'https://other.invalid',
      );
      await tester.tap(find.text('切换'));
      await tester.pumpAndSettle();
      expect(creations, 1);
      expect(next!.baseUrl.host, 'other.invalid');
      expect(find.byKey(const Key('login.username')), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      d.dispose();
    },
  );
  testWidgets(
    'stored token during network restore does not authorize protected routes',
    (tester) async {
      final transport = WorkspaceTransport()
        ..currentBarrier = Completer<void>();
      final storage = FakeSecureStore();
      final d = AppDependencies(
        baseUrl: Uri.parse('https://fixture.invalid'),
        transport: transport,
        storage: storage,
        preferences: FakePreferencesStore(),
      );
      storage.values[d.session.tokenKey] = 'fictional-stored-token';
      await tester.pumpWidget(AdminApp(dependencies: d));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(d.session.token, isNotNull);
      expect(d.session.state.phase, SessionPhase.bootstrapping);
      expect(find.text('正在恢复会话'), findsOneWidget);
      expect(find.text('工作台'), findsNothing);
      expect(
        transport.requests.where((r) => r.url.path.endsWith('/matches')),
        isEmpty,
      );
      transport.currentBarrier!.complete();
      await tester.pumpAndSettle();
      expect(d.session.state.phase, SessionPhase.signedIn);
      expect(find.text('工作台'), findsWidgets);
      await tester.pumpWidget(const SizedBox());
      d.dispose();
    },
  );
  testWidgets(
    'environment A B A preserves queued pending persistence across actual navigation',
    (tester) async {
      final storage = _BlockFirstPendingWrite();
      final transports = <WorkspaceTransport>[];
      final dependencies = <AppDependencies>[];
      AppDependencies create(Uri uri, [AppStores? stores]) {
        final transport = WorkspaceTransport()..uncertainFund = true;
        transports.add(transport);
        final d = AppDependencies(
          baseUrl: uri,
          transport: transport,
          stores:
              stores ??
              AppStores(storage: storage, preferences: FakePreferencesStore()),
        );
        dependencies.add(d);
        return d;
      }

      final initial = create(Uri.parse('https://environment-a.invalid'));
      await tester.pumpWidget(
        AdminApp(
          dependencies: initial,
          environmentFactory: (uri, stores) => create(uri, stores),
        ),
      );
      await tester.pumpAndSettle();
      await initial.session.login('同一管理员', 'fixture');
      await tester.pumpAndSettle();
      final original = tester
          .widget<AdminShell>(find.byType(AdminShell))
          .workspace
          .funds(42, 7);
      await original.restore();
      final lateSave = original.submit(
        const FundDraft(
          action: FundAction.credit,
          amountCents: 100,
          receivedOn: '2026-10-03',
          note: '原100分动作',
        ),
      );
      await storage.started.future;
      final oldKey = storage.originalKey;
      Future<void> switchTo(String url) async {
        await tester.tap(find.widgetWithText(NavigationDestination, '我的'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('切换开发环境'));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField).last, url);
        await tester.tap(find.text('切换'));
        await tester.pumpAndSettle();
        await dependencies.last.session.login('同一管理员', 'fixture');
        await tester.pumpAndSettle();
      }

      await switchTo('https://environment-b.invalid');
      await switchTo('https://environment-a.invalid');
      final current = tester
          .widget<AdminShell>(find.byType(AdminShell))
          .workspace
          .funds(42, 7);
      final restoring = current.restore();
      await tester.pump();
      await current.submit(
        const FundDraft(
          action: FundAction.credit,
          amountCents: 500,
          receivedOn: '2026-10-03',
          note: '不应发出的新500分动作',
        ),
      );
      expect(transports.expand((transport) => transport.fundBodies), isEmpty);
      expect(
        current.ready,
        isFalse,
        reason: 'Same-scope read waits behind original secure write',
      );
      storage.release.complete();
      await lateSave;
      await restoring;
      await tester.pumpAndSettle();
      expect(current.pending!.key, oldKey);
      expect(current.pending!.draft.amountCents, 100);
      expect(current.pending!.draft.note, '原100分动作');
      await current.submit(
        const FundDraft(
          action: FundAction.credit,
          amountCents: 500,
          receivedOn: '2026-10-03',
        ),
      );
      expect(transports.expand((transport) => transport.fundBodies), isEmpty);
      expect(
        (await dependencies.last.pendingFunds.read(current.scope))!.key,
        oldKey,
      );
      await tester.pumpWidget(const SizedBox());
      for (final d in dependencies) {
        d.dispose();
      }
    },
  );
  test(
    'default forEnvironment A B A retains the original serializer and payload',
    () async {
      final storage = _BlockFirstPendingWrite();
      final transports = List.generate(3, (_) => WorkspaceTransport());
      final a = AppDependencies(
        baseUrl: Uri.parse('https://environment-a.invalid'),
        transport: transports[0],
        storage: storage,
        preferences: FakePreferencesStore(),
      );
      await a.initialize();
      await a.session.login('同一管理员', 'fixture');
      final oldWorkspace = ProtectedWorkspace(a);
      final oldFund = oldWorkspace.funds(42, 7);
      await oldFund.restore();
      final saving = oldFund.submit(
        const FundDraft(
          action: FundAction.credit,
          amountCents: 100,
          receivedOn: '2026-10-03',
        ),
      );
      await storage.started.future;
      await a.session.logout();
      oldWorkspace.dispose();
      final b = a.forEnvironment(
        Uri.parse('https://environment-b.invalid'),
        transport: transports[1],
      );
      final returned = b.forEnvironment(a.baseUrl, transport: transports[2]);
      expect(identical(a.stores, b.stores), isTrue);
      expect(identical(a.pendingFunds, returned.pendingFunds), isTrue);
      a.dispose();
      b.dispose();
      await returned.initialize();
      await returned.session.login('同一管理员', 'fixture');
      final workspace = ProtectedWorkspace(returned);
      final fund = workspace.funds(42, 7);
      final restoring = fund.restore();
      await Future<void>.delayed(Duration.zero);
      await fund.submit(
        const FundDraft(
          action: FundAction.credit,
          amountCents: 500,
          receivedOn: '2026-10-03',
        ),
      );
      expect(transports.expand((t) => t.fundBodies), isEmpty);
      storage.release.complete();
      await saving;
      await restoring;
      expect(fund.pending!.key, storage.originalKey);
      expect(fund.pending!.draft.amountCents, 100);
      workspace.dispose();
      returned.dispose();
    },
  );
  testWidgets(
    'factory with independent pending serializer is rejected before initialization and disposed',
    (tester) async {
      final d = AppDependencies(
        baseUrl: Uri.parse('https://environment-a.invalid'),
        transport: WorkspaceTransport(),
        storage: FakeSecureStore(),
        preferences: FakePreferencesStore(),
      );
      final wrongTransport = _TrackedTransport();
      AppDependencies? wrong;
      await tester.pumpWidget(
        AdminApp(
          dependencies: d,
          environmentFactory: (uri, stores) => wrong = AppDependencies(
            baseUrl: uri,
            transport: wrongTransport,
            storage: stores.storage,
            preferences: stores.preferences,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await d.session.login('运营甲', 'fixture');
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(NavigationDestination, '我的'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('切换开发环境'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextField).last,
        'https://environment-b.invalid',
      );
      await tester.tap(find.text('切换'));
      await tester.pumpAndSettle();
      expect(wrongTransport.closed, isTrue);
      expect(wrongTransport.requests, isEmpty);
      expect(
        wrong!.session.generation,
        1,
        reason: 'disposed before any restore/init',
      );
      expect(d.session.state.phase, SessionPhase.signedOut);
      expect(find.text('环境切换未完成，请重试或继续当前环境'), findsOneWidget);
      expect(find.byKey(const Key('login.username')), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      d.dispose();
    },
  );
}

class _BlockFirstPendingWrite extends FakeSecureStore {
  final started = Completer<void>(), release = Completer<void>();
  bool first = true;
  late String originalKey;
  @override
  Future<void> write(String key, String value) async {
    if (key.startsWith('admin_app.fund.') && first) {
      first = false;
      originalKey =
          (jsonDecode(value) as Map<String, dynamic>)['key'] as String;
      started.complete();
      await release.future;
    }
    await super.write(key, value);
  }
}

class _TrackedTransport extends WorkspaceTransport {
  bool closed = false;
  @override
  void close() {
    closed = true;
    super.close();
  }
}
