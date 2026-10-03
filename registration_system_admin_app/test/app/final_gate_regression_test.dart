import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:registration_system_admin_app/app/admin_app.dart';
import 'package:registration_system_admin_app/app/app_dependencies.dart';
import 'package:registration_system_admin_app/features/teams/presentation/team_form_page.dart';
import '../support/fake_storage.dart';
import '../support/workspace_transport.dart';

class GateTransport extends WorkspaceTransport {
  bool rejectLogin = false;
  Completer<void>? writeBarrier;
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    if (rejectLogin && request.url.path.endsWith('/auth/login')) {
      return envelope(null, code: 401, status: 401, message: '密码错误');
    }
    if (request.method == 'POST' && request.url.path.endsWith('/teams')) {
      await writeBarrier?.future;
    }
    return super.send(request);
  }
}

AppDependencies dependencies(GateTransport t) => AppDependencies(
  baseUrl: Uri.parse('https://fixture.invalid'),
  transport: t,
  storage: FakeSecureStore(),
  preferences: FakePreferencesStore(),
  buildVersionReader: () async => '1 (1)',
);
String input(WidgetTester t, String name) =>
    t.widget<TextFormField>(find.byKey(Key('login.$name'))).controller!.text;
Future<void> login(WidgetTester t, AppDependencies d) async {
  await t.pumpWidget(AdminApp(dependencies: d));
  await t.pumpAndSettle();
  await d.session.login('fixture-admin', 'fixture-password');
  await t.pumpAndSettle();
}

void main() {
  testWidgets(
    'explicit teardown resets failed login even without an intermediate rendered frame',
    (t) async {
      final d = dependencies(GateTransport()..rejectLogin = true);
      await t.pumpWidget(AdminApp(dependencies: d));
      await t.pumpAndSettle();
      await t.enterText(
        find.byKey(const Key('login.username')),
        'fixture-admin',
      );
      await t.enterText(
        find.byKey(const Key('login.password')),
        'fixture-password',
      );
      await t.tap(find.text('登录'));
      await t.pumpAndSettle();
      expect(input(t, 'username'), 'fixture-admin');
      await d.session.logout();
      await t.pumpAndSettle();
      expect(input(t, 'username'), isEmpty);
      expect(input(t, 'password'), isEmpty);
      await t.pumpWidget(const SizedBox());
      d.dispose();
    },
  );
  testWidgets(
    'AdminApp failed login retains both fields then retry succeeds and logout resets',
    (t) async {
      final transport = GateTransport()..rejectLogin = true;
      final d = dependencies(transport);
      await t.pumpWidget(AdminApp(dependencies: d));
      await t.pumpAndSettle();
      await t.enterText(
        find.byKey(const Key('login.username')),
        'fixture-admin',
      );
      await t.enterText(
        find.byKey(const Key('login.password')),
        'wrong-fixture-password',
      );
      await t.tap(find.text('登录'));
      await t.pumpAndSettle();
      expect(find.text('密码错误'), findsOneWidget);
      expect(input(t, 'username'), 'fixture-admin');
      expect(input(t, 'password'), 'wrong-fixture-password');
      transport.rejectLogin = false;
      await t.enterText(
        find.byKey(const Key('login.password')),
        'correct-fixture-password',
      );
      await t.tap(find.text('登录'));
      await t.pumpAndSettle();
      expect(find.text('创建球队'), findsWidgets);
      await d.session.logout();
      await t.pumpAndSettle();
      expect(input(t, 'username'), isEmpty);
      expect(input(t, 'password'), isEmpty);
      await t.pumpWidget(const SizedBox());
      d.dispose();
    },
  );
  testWidgets('AdminApp environment teardown resets login form', (t) async {
    final d = dependencies(GateTransport());
    AppDependencies? next;
    await t.pumpWidget(
      AdminApp(
        dependencies: d,
        environmentFactory: (uri, stores) => next = AppDependencies(
          baseUrl: uri,
          stores: stores,
          transport: GateTransport(),
        ),
      ),
    );
    await t.pumpAndSettle();
    await t.enterText(find.byKey(const Key('login.username')), 'fixture-admin');
    await t.enterText(
      find.byKey(const Key('login.password')),
      'fixture-password',
    );
    await t.tap(find.text('登录'));
    await t.pumpAndSettle();
    await t.tap(find.widgetWithText(NavigationDestination, '我的'));
    await t.pumpAndSettle();
    await t.tap(find.text('切换开发环境'));
    await t.pumpAndSettle();
    await t.enterText(find.byType(TextField).last, 'https://other.invalid');
    await t.tap(find.text('切换'));
    await t.pumpAndSettle();
    expect(next!.baseUrl.host, 'other.invalid');
    expect(input(t, 'username'), isEmpty);
    expect(input(t, 'password'), isEmpty);
    await t.pumpWidget(const SizedBox());
    d.dispose();
  });
  testWidgets(
    'AdminApp system back dirty cancel and confirm respects nested guard',
    (t) async {
      final d = dependencies(GateTransport());
      await login(t, d);
      await t.tap(find.text('创建球队').first);
      await t.pumpAndSettle();
      await t.enterText(find.byType(TextFormField).first, '未保存球队');
      await t.pumpAndSettle();
      await t.binding.handlePopRoute();
      await t.pumpAndSettle();
      expect(find.byType(TeamFormPage), findsOneWidget);
      expect(find.text('放弃未保存的修改？'), findsOneWidget);
      await t.tap(find.text('取消'));
      await t.pumpAndSettle();
      expect(find.byType(TeamFormPage), findsOneWidget);
      await t.binding.handlePopRoute();
      await t.pumpAndSettle();
      await t.tap(find.text('确认'));
      await t.pumpAndSettle();
      expect(find.byType(TeamFormPage), findsNothing);
      await t.pumpWidget(const SizedBox());
      d.dispose();
    },
  );
  testWidgets('AdminApp system back cannot abandon in-flight write', (t) async {
    final transport = GateTransport()..writeBarrier = Completer<void>();
    final d = dependencies(transport);
    await login(t, d);
    await t.tap(find.text('创建球队').first);
    await t.pumpAndSettle();
    await t.enterText(find.byType(TextFormField).first, '正在创建球队');
    await t.ensureVisible(find.text('保存球队'));
    await t.tap(find.text('保存球队'));
    await t.pump();
    await t.pump(const Duration(milliseconds: 100));
    await t.binding.handlePopRoute();
    await t.pump();
    expect(find.byType(TeamFormPage), findsOneWidget);
    expect(find.byType(AlertDialog), findsNothing);
    transport.writeBarrier!.complete();
    await t.pumpAndSettle();
    expect(find.text('正在创建球队'), findsWidgets);
    await t.pumpWidget(const SizedBox());
    d.dispose();
  });
  testWidgets(
    'AdminApp system back dismisses ordinary nested dialog and clean form; root bubbles',
    (t) async {
      final d = dependencies(GateTransport());
      await login(t, d);
      await t.tap(find.text('创建球队').first);
      await t.pumpAndSettle();
      unawaited(
        showDialog<void>(
          context: t.element(find.byType(TeamFormPage)),
          useRootNavigator: false,
          builder: (_) => const AlertDialog(title: Text('普通弹窗')),
        ),
      );
      await t.pumpAndSettle();
      await t.binding.handlePopRoute();
      await t.pumpAndSettle();
      expect(find.text('普通弹窗'), findsNothing);
      expect(find.byType(TeamFormPage), findsOneWidget);
      await t.binding.handlePopRoute();
      await t.pumpAndSettle();
      expect(find.byType(TeamFormPage), findsNothing);
      expect(await t.binding.handlePopRoute(), isFalse);
      expect(find.text('创建球队'), findsWidgets);
      await t.pumpWidget(const SizedBox());
      d.dispose();
    },
  );
}
