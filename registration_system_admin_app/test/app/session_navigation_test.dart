import 'dart:async';
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
          environmentFactory: (uri) {
            creations++;
            expect(d.session.token, isNull);
            expect(d.session.state.phase, SessionPhase.signedOut);
            return next = AppDependencies(
              baseUrl: uri,
              transport: WorkspaceTransport(),
              storage: storage,
              preferences: d.preferences,
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
}
