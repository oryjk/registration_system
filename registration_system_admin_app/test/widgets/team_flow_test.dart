import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/design_system/design_system.dart';
import 'package:registration_system_admin_app/features/teams/application/team_controller.dart';
import 'package:registration_system_admin_app/features/teams/domain/team.dart';
import 'package:registration_system_admin_app/features/teams/presentation/team_detail_page.dart';
import 'package:registration_system_admin_app/features/teams/presentation/team_form_page.dart';
import 'package:registration_system_admin_app/features/teams/presentation/team_list_page.dart';
import '../teams/fake_team_repository.dart';
import '../teams/fixtures.dart';

Widget app(
  Widget home, {
  double scale = 1,
  EdgeInsets keyboard = EdgeInsets.zero,
  bool dark = true,
}) => MaterialApp(
  theme: AdminTheme.build(dark: dark),
  locale: AdminLocalizations.locale,
  supportedLocales: AdminLocalizations.supportedLocales,
  localizationsDelegates: AdminLocalizations.delegates,
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(
      context,
    ).copyWith(textScaler: TextScaler.linear(scale), viewInsets: keyboard),
    child: child!,
  ),
  home: home,
);
Future<void> scrollTo(WidgetTester tester, Finder finder) async {
  if (finder.evaluate().isEmpty) {
    await tester.scrollUntilVisible(
      finder,
      200,
      scrollable: find.byType(Scrollable).last,
    );
  } else {
    await tester.ensureVisible(finder);
  }
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'create returns real server detail and failed save preserves fields',
    (tester) async {
      final r = FakeTeamRepository();
      final c = TeamController(repository: r);
      r.onCreate = (_) => Future.error(
        const ApiError(message: '名称已存在', kind: ApiErrorKind.validation),
      );
      await tester.pumpWidget(
        app(
          Builder(
            builder: (context) => TeamFormPage(
              controller: c,
              onSaved: (created) {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute<void>(
                    builder: (_) => TeamDetailPage(
                      controller: TeamController(
                        repository: r,
                        initialTeam: created,
                      ),
                      id: created.id,
                      onEdit: (_) {},
                      loadOnStart: false,
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      );
      await tester.enterText(find.byType(TextFormField).first, '新建队');
      await tester.enterText(find.byType(TextFormField).last, '本次介绍');
      await tester.tap(find.text('保存球队'));
      await tester.pumpAndSettle();
      expect(find.text('操作失败：名称已存在'), findsOneWidget);
      expect(find.text('新建队'), findsOneWidget);
      expect(find.text('本次介绍'), findsOneWidget);
      r.onCreate = (_) async => team(id: 99, name: '服务器返回名称');
      await tester.tap(find.text('保存球队'));
      await tester.pumpAndSettle();
      expect(find.text('球队详情'), findsOneWidget);
      expect(find.text('服务器返回名称'), findsOneWidget);
      expect(find.text('编号：99'), findsOneWidget);
      expect(r.creates, 2);
      c.dispose();
    },
  );
  testWidgets('dirty back cancels then confirms discarding form', (
    tester,
  ) async {
    final c = TeamController(repository: FakeTeamRepository());
    await tester.pumpWidget(
      app(
        Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => TeamFormPage(controller: c, onSaved: (_) {}),
                ),
              ),
              child: const Text('打开创建'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('打开创建'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, '未保存队');
    await tester.pump();
    await Navigator.of(tester.element(find.byType(TeamFormPage))).maybePop();
    await tester.pumpAndSettle();
    expect(find.text('放弃未保存的修改？'), findsOneWidget);
    await tester.tap(find.text('取消'));
    await tester.pumpAndSettle();
    expect(find.text('未保存队'), findsOneWidget);
    await Navigator.of(tester.element(find.byType(TeamFormPage))).maybePop();
    await tester.pumpAndSettle();
    await tester.tap(find.text('确认'));
    await tester.pumpAndSettle();
    expect(find.text('打开创建'), findsOneWidget);
    c.dispose();
  });
  testWidgets(
    'password hidden toggle clear confirmation and success read failure stay distinct',
    (tester) async {
      final r = FakeTeamRepository();
      final c = TeamController(repository: r, initialTeam: team());
      String? sent;
      r.onPassword = (_, value) async {
        sent = value;
      };
      await tester.pumpWidget(
        app(
          TeamDetailPage(
            controller: c,
            id: 42,
            onEdit: (_) {},
            loadOnStart: false,
          ),
        ),
      );
      final password = find.byKey(const ValueKey('team-password'));
      await scrollTo(tester, password);
      await tester.enterText(password, '新密码');
      expect(
        tester
            .widget<EditableText>(
              find.descendant(
                of: password,
                matching: find.byType(EditableText),
              ),
            )
            .obscureText,
        isTrue,
      );
      await tester.tap(find.byTooltip('显示入队密码'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<EditableText>(
              find.descendant(
                of: password,
                matching: find.byType(EditableText),
              ),
            )
            .obscureText,
        isFalse,
      );
      await scrollTo(tester, find.text('清除密码，开放加入'));
      await tester.tap(find.text('清除密码，开放加入'));
      await tester.pumpAndSettle();
      expect(find.textContaining('球员加入该球队时无需密码'), findsOneWidget);
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      expect(r.passwords, 0);
      r.onGet = (_) async => throw Exception('读取失败');
      await tester.tap(find.text('清除密码，开放加入'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('确认'));
      await tester.pumpAndSettle();
      expect(sent, '');
      expect(r.passwords, 1);

      expect(find.text('操作成功，数据刷新失败。请重试读取，勿重复操作。'), findsOneWidget);
      expect(find.text('读取失败'), findsNothing);
      expect(find.text('Exception: 读取失败'), findsOneWidget);
      c.dispose();
    },
  );
  testWidgets(
    'unknown status has visible fallback no write actions and missing clears stale detail',
    (tester) async {
      final r = FakeTeamRepository();
      final c = TeamController(
        repository: r,
        initialTeam: team(status: 'future'),
      );
      await tester.pumpWidget(
        app(
          TeamDetailPage(
            controller: c,
            id: 42,
            onEdit: (_) {},
            loadOnStart: false,
          ),
        ),
      );
      expect(find.text('未知状态（future）'), findsOneWidget);
      expect(find.text('编辑球队'), findsNothing);
      expect(find.text('设置新密码'), findsNothing);
      expect(find.byTooltip('更多球队操作'), findsNothing);
      expect(find.text('成员管理'), findsNothing);
      r.onGet = (_) async => throw const ApiError(
        message: '球队不存在',
        kind: ApiErrorKind.business,
        httpStatus: 404,
      );
      await c.load(42);
      await tester.pumpAndSettle();
      expect(find.text('星河队'), findsNothing);
      expect(find.text('球队不存在或已删除，请返回列表刷新。'), findsOneWidget);
      c.dispose();
    },
  );
  testWidgets(
    'list empty/filter clear and local search preserve backend query',
    (tester) async {
      final r = FakeTeamRepository();
      final c = TeamController(repository: r);
      r.items = [];
      var creates = 0;
      await tester.pumpWidget(
        app(
          TeamListPage(
            controller: c,
            onOpenTeam: (_) {},
            onCreate: () => creates++,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('暂无球队，创建第一支球队。'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, '创建球队'));
      expect(creates, 1);
      r.items = [team()];
      await c.refresh();
      await tester.pumpAndSettle();
      final lists = r.lists;
      await tester.enterText(find.byType(TextField), '没找到');
      await tester.pumpAndSettle();
      expect(find.text('筛选无结果'), findsOneWidget);
      expect(r.lists, lists);
      await tester.tap(find.text('清除筛选'));
      await tester.pumpAndSettle();
      expect(find.text('星河队'), findsOneWidget);
      c.dispose();
    },
  );
  testWidgets(
    'duplicate submit locked and uncertain result keeps form without replay',
    (tester) async {
      final r = FakeTeamRepository();
      final c = TeamController(repository: r);
      final p = Completer<Team>();
      r.onCreate = (_) => p.future;
      await tester.pumpWidget(
        app(TeamFormPage(controller: c, onSaved: (_) {})),
      );
      await tester.enterText(find.byType(TextFormField).first, '球队');
      await tester.tap(find.text('保存球队'));
      await tester.pump();
      expect(find.text('提交中…'), findsOneWidget);
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      p.completeError(
        const ApiError(
          message: '超时',
          kind: ApiErrorKind.timeout,
          uncertainWrite: true,
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text(TeamController.uncertainGuidance), findsOneWidget);
      expect(find.text('球队'), findsOneWidget);
      expect(r.creates, 1);
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      c.dispose();
    },
  );
  testWidgets(
    '360 390 430 and landscape layouts support long name empty logo keyboard 2x',
    (tester) async {
      for (final size in [
        const Size(360, 800),
        const Size(390, 844),
        const Size(430, 932),
        const Size(844, 390),
      ]) {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1;
        for (final dark in [true, false]) {
          final r = FakeTeamRepository()..items = [team(name: '很长的球队名称' * 12)];
          final c = TeamController(repository: r);
          await tester.pumpWidget(
            app(
              TeamListPage(controller: c, onCreate: () {}, onOpenTeam: (_) {}),
              scale: 2,
              dark: dark,
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull, reason: 'list $size');
          await tester.pumpWidget(
            app(
              TeamDetailPage(
                controller: TeamController(
                  repository: r,
                  initialTeam: r.items.single,
                ),
                id: 42,
                onEdit: (_) {},
                loadOnStart: false,
              ),
              scale: 2,
              dark: dark,
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull, reason: 'detail $size');
          await tester.pumpWidget(
            app(
              TeamFormPage(
                controller: TeamController(repository: r),
                onSaved: (_) {},
              ),
              scale: 2,
              keyboard: EdgeInsets.only(bottom: size.height / 3),
              dark: dark,
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull, reason: 'form $size');
          expect(
            tester.getBottomLeft(find.text('保存球队')).dy,
            lessThan(size.height - size.height / 3),
          );
          c.dispose();
        }
      }
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
    },
  );
  testWidgets(
    'editing status confirms concrete team and payload before returning real result',
    (tester) async {
      final r = FakeTeamRepository();
      final c = TeamController(repository: r, initialTeam: team());
      Team? returned;
      await tester.pumpWidget(
        app(
          TeamFormPage(
            controller: c,
            initialTeam: team(),
            onSaved: (value) => returned = value,
          ),
        ),
      );
      await scrollTo(tester, find.text('冻结'));
      await tester.tap(find.text('冻结'));
      await tester.pump();
      await tester.tap(find.text('保存球队'));
      await tester.pumpAndSettle();
      expect(find.textContaining('星河队'), findsWidgets);
      expect(find.textContaining('从启用改为冻结'), findsOneWidget);
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      expect(r.updates, 0);
      await tester.tap(find.text('保存球队'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('确认'));
      await tester.pumpAndSettle();
      expect(r.updates, 1);
      expect(returned!.status, 'frozen');
      expect(returned!.id, 42);
      c.dispose();
    },
  );
  testWidgets(
    'delete confirmation names team and cancellation does not write; conflict stays visible',
    (tester) async {
      final r = FakeTeamRepository();
      final c = TeamController(repository: r, initialTeam: team());
      await tester.pumpWidget(
        app(
          TeamDetailPage(
            controller: c,
            id: 42,
            onEdit: (_) {},
            loadOnStart: false,
          ),
        ),
      );
      await tester.tap(find.byTooltip('更多球队操作'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('删除球队'));
      await tester.pumpAndSettle();
      expect(find.textContaining('编号 42'), findsOneWidget);
      expect(find.textContaining('已有历史记录会保留'), findsOneWidget);
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      expect(r.deletes, 0);
      r.onDelete = (_) async => throw const ApiError(
        message: '球队存在比赛或申请记录，需先解散后再删除',
        kind: ApiErrorKind.conflict,
        httpStatus: 409,
      );
      await tester.tap(find.byTooltip('更多球队操作'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('删除球队'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('确认'));
      await tester.pumpAndSettle();
      expect(r.deletes, 1);
      expect(find.text('操作失败：球队存在比赛或申请记录，需先解散后再删除'), findsOneWidget);
      expect(find.text('星河队'), findsOneWidget);
      c.dispose();
    },
  );
  testWidgets(
    'in-flight submit blocks back and long error stays scrollable with keyboard',
    (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final r = FakeTeamRepository();
      final c = TeamController(repository: r);
      final pending = Completer<Team>();
      r.onCreate = (_) => pending.future;
      await tester.pumpWidget(
        app(
          Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        TeamFormPage(controller: c, onSaved: (_) {}),
                  ),
                ),
                child: const Text('打开'),
              ),
            ),
          ),
          scale: 2,
          keyboard: const EdgeInsets.only(bottom: 250),
        ),
      );
      await tester.tap(find.text('打开'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, '保留名称');
      await tester.tap(find.text('保存球队'));
      await tester.pump();
      await Navigator.of(tester.element(find.byType(TeamFormPage))).maybePop();
      await tester.pump();
      expect(find.text('放弃未保存的修改？'), findsNothing);
      expect(find.byType(TeamFormPage), findsOneWidget);
      pending.completeError(
        ApiError(message: '很长的校验原因' * 100, kind: ApiErrorKind.validation),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('保留名称'), findsOneWidget);
      expect(find.byType(SingleChildScrollView), findsWidgets);
      c.dispose();
    },
  );
  testWidgets(
    'deleted state and search keyboard remain scrollable in compact 2x landscape',
    (tester) async {
      tester.view.physicalSize = const Size(844, 390);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final r = FakeTeamRepository();
      final c = TeamController(repository: r, initialTeam: team());
      await c.delete(42);
      await tester.pumpWidget(
        app(
          TeamDetailPage(
            controller: c,
            id: 42,
            onEdit: (_) {},
            loadOnStart: false,
          ),
          scale: 2,
          keyboard: const EdgeInsets.only(bottom: 130),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('返回球队列表'), findsOneWidget);
      final list = TeamController(repository: r);
      await tester.pumpWidget(
        app(
          TeamListPage(controller: list, onCreate: () {}, onOpenTeam: (_) {}),
          scale: 2,
          keyboard: const EdgeInsets.only(bottom: 180),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      c.dispose();
      list.dispose();
    },
  );
}
