import 'package:flutter/material.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/design_system/design_system.dart';
import 'package:registration_system_admin_app/features/members/application/member_controller.dart';
import 'package:registration_system_admin_app/features/members/presentation/member_list_page.dart';
import 'package:registration_system_admin_app/features/members/presentation/member_detail_page.dart';
import '../members/fixtures.dart';
import 'package:registration_system_admin_app/features/members/presentation/member_candidate_page.dart';
import 'package:registration_system_admin_app/features/members/presentation/member_edit_page.dart';
import 'package:registration_system_admin_app/features/members/domain/member_models.dart';

Widget host(Widget child, {double scale = 1}) => MaterialApp(
  theme: AdminTheme.build(dark: true),
  locale: AdminLocalizations.locale,
  supportedLocales: AdminLocalizations.supportedLocales,
  localizationsDelegates: AdminLocalizations.delegates,
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
    child: child!,
  ),
  home: child,
);
void main() {
  testWidgets(
    'candidate selected from results confirms cancel without add then submits once',
    (tester) async {
      final r = FakeMembers();
      final c = MemberController(repository: r, teamId: 42);
      await c.load();
      final search = c.searchCandidates('');
      r.searches['']!.complete([
        const MemberCandidate(userId: 8, nickname: '候选八'),
      ]);
      await search;
      await tester.pumpWidget(
        host(MemberCandidatePage(controller: c, loadOnStart: false)),
      );
      await tester.tap(find.text('候选八'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('添加选中球员'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('添加选中球员'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      expect(r.writes, 0);
      await tester.tap(find.text('添加选中球员'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('确认'));
      await tester.pumpAndSettle();
      expect(r.writes, 1);
      expect(find.text('成员已添加，请返回列表'), findsOneWidget);
      c.dispose();
    },
  );
  testWidgets(
    'profile save separate from role and cannot replay after refresh failure',
    (tester) async {
      final r = FakeMembers();
      final c = MemberController(repository: r, teamId: 42);
      await c.load();
      await tester.pumpWidget(
        host(
          MemberEditPage(
            controller: c,
            userId: 7,
            mode: MemberEditMode.profile,
          ),
        ),
      );
      await tester.enterText(find.widgetWithText(TextFormField, '姓名'), '新姓名');
      await tester.ensureVisible(find.text('保存球员资料'));
      await tester.pumpAndSettle();
      r.readError = Exception('刷新失败');
      await tester.tap(find.text('保存球员资料'));
      await tester.pumpAndSettle();
      expect(r.profiles, 1);
      expect(r.writes, 0);
      expect(find.text('本项已保存'), findsOneWidget);
      final button = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, '本项已保存'),
      );
      expect(button.onPressed, isNull);
      c.dispose();
    },
  );
  testWidgets(
    'member confirmation cancel sends no removal; success read failure offers read recovery',
    (tester) async {
      final r = FakeMembers();
      final c = MemberController(repository: r, teamId: 42);
      await c.load();
      await tester.pumpWidget(
        host(
          MemberDetailPage(
            controller: c,
            userId: 7,
            onEditMember: (_) {},
            onEditProfile: (_) {},
          ),
        ),
      );
      expect(find.text('欠款 ¥1.50'), findsOneWidget);
      expect(find.text('非付费会员'), findsOneWidget);
      await tester.ensureVisible(find.text('移除成员'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('移除成员'));
      await tester.pumpAndSettle();
      expect(find.textContaining('未开始且未支付'), findsOneWidget);
      expect(find.textContaining('球员7'), findsWidgets);
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      expect(r.writes, 0);
      await tester.tap(find.text('移除成员'));
      await tester.pumpAndSettle();
      r.readError = Exception('读取失败');
      await tester.tap(find.text('确认'));
      await tester.pumpAndSettle();
      expect(r.writes, 1);
      expect(find.textContaining('操作成功，数据刷新失败'), findsOneWidget);
      r.readError = null;
      await tester.tap(find.byTooltip('刷新成员'));
      await tester.pumpAndSettle();
      expect(r.writes, 1);
      c.dispose();
    },
  );
  testWidgets('empty list and status filter use actual loaded data', (
    tester,
  ) async {
    final r = FakeMembers()..value = management(members: []);
    final c = MemberController(repository: r, teamId: 42);
    await c.load();
    await tester.pumpWidget(
      host(
        MemberListPage(
          controller: c,
          onMember: (_) {},
          onAdd: () {},
          loadOnStart: false,
        ),
      ),
    );
    expect(find.text('暂无成员，可从真实球员查询中添加'), findsOneWidget);
    r.value = management(
      members: [
        member(id: 7, paid: true),
        member(id: 8, status: 'inactive'),
      ],
    );
    await c.load();
    await tester.pumpAndSettle();
    expect(find.text('付费会员'), findsOneWidget);
    expect(find.text('球员8'), findsOneWidget);
    await tester.tap(find.widgetWithText(ChoiceChip, '启用'));
    await tester.pumpAndSettle();
    expect(find.text('球员8'), findsNothing);
    expect(find.text('球员7'), findsOneWidget);
    c.dispose();
  });
  testWidgets('long names and 2x text fit phone widths and landscape', (
    tester,
  ) async {
    final r = FakeMembers()
      ..value = management(members: [member(name: '很长的成员姓名' * 15)]);
    final c = MemberController(repository: r, teamId: 42);
    await c.load();
    for (final size in [
      const Size(360, 780),
      const Size(390, 844),
      const Size(430, 932),
      const Size(844, 390),
    ]) {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      await tester.pumpWidget(
        host(
          MemberListPage(
            controller: c,
            onMember: (_) {},
            onAdd: () {},
            loadOnStart: false,
          ),
          scale: 2,
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
    c.dispose();
  });
  testWidgets(
    'captain changed while confirmation is open cannot revoke replacement',
    (tester) async {
      final r = FakeMembers()
        ..value = management(
          captainId: 7,
          members: [
            member(role: 'captain'),
            member(id: 8),
          ],
        );
      final c = MemberController(repository: r, teamId: 42);
      await c.load();
      await tester.pumpWidget(
        host(
          MemberDetailPage(
            controller: c,
            userId: 7,
            onEditMember: (_) {},
            onEditProfile: (_) {},
          ),
        ),
      );
      await tester.scrollUntilVisible(find.text('取消队长'), 250);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('取消队长'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('取消队长'));
      await tester.pumpAndSettle();
      r.value = management(
        captainId: 8,
        members: [
          member(),
          member(id: 8, role: 'captain'),
        ],
      );
      await c.load();
      await tester.pumpAndSettle();
      await tester.tap(find.text('确认'));
      await tester.pumpAndSettle();
      expect(r.writes, 0);
      expect(find.text('队长已变更，请刷新后重新确认'), findsOneWidget);
      c.dispose();
    },
  );
  testWidgets('verified applied profile form stays saved without replay', (
    tester,
  ) async {
    final r = FakeMembers();
    final c = MemberController(repository: r, teamId: 42);
    await c.load();
    await tester.pumpWidget(
      host(
        MemberEditPage(controller: c, userId: 7, mode: MemberEditMode.profile),
      ),
    );
    await tester.enterText(find.widgetWithText(TextFormField, '姓名'), '新姓名');
    await tester.pumpAndSettle();
    r.writeError = const ApiError(
      message: '响应丢失',
      kind: ApiErrorKind.server,
      uncertainWrite: true,
    );
    await tester.tap(find.text('保存球员资料'));
    await tester.pumpAndSettle();
    expect(c.writeOutcomeUncertain, isTrue);
    c.acknowledgeOutcomeChecked(applied: true);
    await tester.pumpAndSettle();
    expect(find.text('本项已保存'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, '本项已保存'))
          .onPressed,
      isNull,
    );
    expect(r.profiles, 1);
    c.dispose();
  });

  testWidgets('profile dirty back cancellation preserves input', (
    tester,
  ) async {
    final r = FakeMembers();
    final c = MemberController(repository: r, teamId: 42);
    await c.load();
    await tester.pumpWidget(
      MaterialApp(
        theme: AdminTheme.build(dark: true),
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => MemberEditPage(
                    controller: c,
                    userId: 7,
                    mode: MemberEditMode.profile,
                  ),
                ),
              ),
              child: const Text('打开资料'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('打开资料'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, '姓名'), '待保存');
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();
    expect(find.text('放弃未保存的修改？'), findsOneWidget);
    await tester.tap(find.text('取消'));
    await tester.pumpAndSettle();
    expect(find.text('待保存'), findsOneWidget);
    expect(r.profiles, 0);
    c.dispose();
  });
  testWidgets('profile long write error and keyboard fit 2x text', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetViewInsets);
    final r = FakeMembers();
    final c = MemberController(repository: r, teamId: 42);
    await c.load();
    for (final size in [
      const Size(360, 780),
      const Size(390, 844),
      const Size(430, 932),
      const Size(844, 390),
    ]) {
      tester.view.physicalSize = size;
      tester.view.viewInsets = FakeViewPadding(
        bottom: size.height > 400 ? 280 : 150,
      );
      await tester.pumpWidget(
        host(
          MemberEditPage(
            key: ValueKey(size),
            controller: c,
            userId: 7,
            mode: MemberEditMode.profile,
          ),
          scale: 2,
        ),
      );
      await tester.enterText(find.widgetWithText(TextFormField, '姓名'), '修改姓名');
      await tester.pumpAndSettle();
      r.writeError = ApiError(
        message: '详细失败原因' * 100,
        kind: ApiErrorKind.conflict,
      );
      await c.saveProfile(r.value.members.first, '修改姓名', null);
      await tester.pumpAndSettle();
      expect(find.textContaining('详细失败原因'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }
    c.dispose();
  });
}
