import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/core/state/resource_changes.dart';
import 'package:registration_system_admin_app/design_system/design_system.dart';
import 'package:registration_system_admin_app/features/matches/application/match_list_controller.dart';
import 'package:registration_system_admin_app/features/matches/application/match_detail_controller.dart';
import 'package:registration_system_admin_app/features/matches/application/match_form_controller.dart';
import 'package:registration_system_admin_app/features/matches/data/match_response_mapper.dart';
import 'package:registration_system_admin_app/features/matches/presentation/match_list_page.dart';
import 'package:registration_system_admin_app/features/matches/domain/match_repository.dart';
import 'package:registration_system_admin_app/features/matches/presentation/beijing_time_field.dart';
import 'package:registration_system_admin_app/features/matches/presentation/active_team_field.dart';
import 'package:registration_system_admin_app/core/time/beijing_time.dart';
import '../teams/fixtures.dart' as teams_fixtures;
import 'package:registration_system_admin_app/features/matches/presentation/match_detail_page.dart';
import 'package:registration_system_admin_app/features/matches/presentation/match_form_page.dart';
import '../matches/fixtures.dart';
import '../teams/fake_team_repository.dart';

Widget app(
  Widget home, {
  bool dark = true,
  double scale = 1,
  EdgeInsets keyboard = EdgeInsets.zero,
}) => MaterialApp(
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(
      context,
    ).copyWith(textScaler: TextScaler.linear(scale), viewInsets: keyboard),
    child: child!,
  ),
  theme: AdminTheme.build(dark: dark),
  locale: AdminLocalizations.locale,
  supportedLocales: AdminLocalizations.supportedLocales,
  localizationsDelegates: AdminLocalizations.delegates,
  home: home,
);
Future<void> scrollTo(WidgetTester t, Finder f) async {
  if (f.evaluate().isEmpty) {
    await t.scrollUntilVisible(
      f,
      300,
      scrollable: find.byType(Scrollable).last,
    );
  } else {
    await t.ensureVisible(f);
  }
  await t.pumpAndSettle();
}

Finder field(String label) => find.byWidgetPredicate(
  (w) => w is TextField && w.decoration?.labelText == label,
);

class CaptureRepository extends FakeMatchRepository {
  MatchDraft? submitted;
  @override
  Future<MatchDetail> create(MatchDraft draft) {
    submitted = draft;
    return super.create(draft);
  }

  @override
  Future<MatchDetail> update(String id, MatchDraft draft) {
    submitted = draft;
    return super.update(id, draft);
  }
}

void main() {
  testWidgets('search status and pagination query real repository', (t) async {
    final r = FakeMatchRepository();
    final c = MatchListController(repository: r);
    await t.pumpWidget(
      app(MatchListPage(controller: c, onOpenMatch: (_) {}, onCreate: () {})),
    );
    r.lists.last.result.complete(page(1, ['m1']));
    await t.pumpAndSettle();
    await t.enterText(find.byType(TextField), '周末');
    await t.testTextInput.receiveAction(TextInputAction.search);
    await t.pump();
    expect(r.lists.last.query.search, '周末');
    r.lists.last.result.complete(page(1, ['m2']));
    await t.pumpAndSettle();
    await t.tap(find.text('进行中'));
    await t.pump();
    expect(r.lists.last.query.status, 'ongoing');
    r.lists.last.result.complete(page(1, ['m3']));
    await t.pumpAndSettle();
    await t.ensureVisible(find.text('加载更多'));
    await t.tap(find.text('加载更多'));
    await t.pump();
    expect(r.lists.last.query.page, 2);
    r.lists.last.result.complete(page(2, ['m4'], total: 21));
    await t.pumpAndSettle();
    c.dispose();
  });
  testWidgets('zero score visible and ordinary admin has no delete', (t) async {
    final r = FakeMatchRepository();
    final c = MatchDetailController(repository: r, id: 'match-1');
    await t.pumpWidget(app(MatchDetailPage(controller: c, onEdit: (_) {})));
    final json = detailJson(status: 'ongoing');
    (json['match'] as Map)['host_score'] = 0;
    (json['match'] as Map)['away_score'] = 0;
    r.reads.last.complete(MatchResponseMapper.detail(json));
    await t.pumpAndSettle();
    expect(find.text('0 : 0'), findsOneWidget);
    expect(find.text('删除比赛'), findsNothing);
    c.dispose();
  });
  testWidgets('unknown match status offers no dangerous actions', (t) async {
    final r = FakeMatchRepository();
    final c = MatchDetailController(
      repository: r,
      id: 'match-1',
      isSuperAdmin: true,
    );
    await t.pumpWidget(app(MatchDetailPage(controller: c, onEdit: (_) {})));
    r.reads.last.complete(detail(status: 'future'));
    await t.pumpAndSettle();
    expect(find.text('编辑比赛'), findsNothing);
    expect(find.text('开始比赛'), findsNothing);
    expect(find.text('删除比赛'), findsNothing);
    c.dispose();
  });
  testWidgets('create validation no write and active team load failure retry', (
    t,
  ) async {
    final r = FakeMatchRepository();
    final teams = FakeTeamRepository();
    teams.onList = (_) => Future.error(
      const ApiError(message: '球队读取失败', kind: ApiErrorKind.network),
    );
    final c = MatchFormController(repository: r);
    await t.pumpWidget(
      app(
        MatchFormPage(
          controller: c,
          teamRepository: teams,
          onSaved: (_) {},
          onCheckOutcome: () async {},
        ),
      ),
    );
    await t.pumpAndSettle();
    await t.tap(find.text('保存比赛'));
    await t.pumpAndSettle();
    expect(r.commands, isEmpty);
    expect(find.text('请输入比赛名称'), findsOneWidget);
    expect(find.textContaining('球队读取失败'), findsOneWidget);
    expect(find.text('重试读取球队'), findsOneWidget);
    c.dispose();
  });
  testWidgets('success then refresh failure keeps read-only recovery', (
    t,
  ) async {
    final r = FakeMatchRepository();
    final changes = ResourceChanges();
    final c = MatchDetailController(
      repository: r,
      id: 'match-1',
      changes: changes,
    );
    await t.pumpWidget(
      app(MatchDetailPage(controller: c, onEdit: (_) {}, changes: changes)),
    );
    r.reads.last.complete(detail());
    await t.pumpAndSettle();
    await scrollTo(t, find.text('开始比赛'));
    await t.tap(find.text('开始比赛'));
    await t.pumpAndSettle();
    expect(find.textContaining('测试比赛'), findsWidgets);
    await t.tap(find.text('确认'));
    await t.pump();
    r.writes.last.complete(detail(status: 'ongoing'));
    await t.pump();
    await t.pump();
    r.reads.last.completeError(
      const ApiError(message: '读取失败', kind: ApiErrorKind.network),
    );
    await t.pumpAndSettle();
    expect(find.textContaining('操作成功，数据刷新失败'), findsOneWidget);
    expect(r.commands, ['status:ongoing']);
    await t.tap(find.text('重试读取详情'));
    await t.pump();
    expect(r.commands, ['status:ongoing']);
    r.reads.last.complete(detail(status: 'ongoing'));
    await t.pumpAndSettle();
    c.dispose();
    changes.dispose();
  });
  testWidgets(
    'editing clears nullable values while preserving locked rules and precision',
    (t) async {
      final r = CaptureRepository();
      final c = MatchFormController(repository: r, id: 'match-1');
      await t.pumpWidget(
        app(
          MatchFormPage(
            controller: c,
            teamRepository: FakeTeamRepository(),
            initialDetail: detail(),
            onSaved: (_) {},
            onCheckOutcome: () async {},
          ),
        ),
      );
      expect(find.text('发布模式：散人对手'), findsOneWidget);
      await scrollTo(t, find.text('清空报名开始时间'));
      await t.tap(find.text('清空报名开始时间'));
      await t.pumpAndSettle();
      await scrollTo(t, find.text('清空报名截止时间'));
      await t.tap(find.text('清空报名截止时间'));
      await t.pumpAndSettle();
      for (final label in ['纬度（选填）', '经度（选填）', '比赛说明（选填）', '主队球服颜色（选填）']) {
        await scrollTo(t, field(label));
        await t.enterText(field(label), '');
      }
      await t.tap(find.text('保存比赛'));
      await t.pump();
      expect(r.submitted!.registrationStartAt, isNull);
      expect(r.submitted!.registrationEndAt, isNull);
      expect(r.submitted!.locationLatitude, isNull);
      expect(r.submitted!.locationLongitude, isNull);
      expect(r.submitted!.description, isNull);
      expect(r.submitted!.hostColor, '');
      expect(r.submitted!.publicationMode, 'online_individual');
      expect(r.submitted!.hostTeamId, 12);
      expect(
        r.submitted!.startTime!.toUtc(),
        DateTime.parse('2026-10-04T01:30:15.123456Z'),
      );
      r.writes.last.complete(detail());
      await t.pumpAndSettle();
      c.dispose();
    },
  );
  testWidgets('pickup hides unsupported capacity and preserves it on save', (
    t,
  ) async {
    final r = CaptureRepository();
    final c = MatchFormController(repository: r, id: 'match-1');
    await t.pumpWidget(
      app(
        MatchFormPage(
          controller: c,
          teamRepository: FakeTeamRepository(),
          initialDetail: detail(mode: 'online_pickup'),
          onSaved: (_) {},
          onCheckOutcome: () async {},
        ),
      ),
    );
    expect(field('主队报名上限（选填）'), findsNothing);
    await t.tap(find.text('保存比赛'));
    await t.pump();
    expect(r.submitted!.hostCapacityLimit, isNull);
    expect(r.commands, ['update:match-1']);
    r.writes.last.complete(detail(mode: 'online_pickup'));
    await t.pumpAndSettle();
    c.dispose();
  });
  testWidgets('actual active teams only and query failure can retry', (
    t,
  ) async {
    final r = FakeMatchRepository();
    final teams = FakeTeamRepository();
    String? status;
    teams.onList = (s) {
      status = s;
      return Future.error(
        const ApiError(message: '断网', kind: ApiErrorKind.network),
      );
    };
    final c = MatchFormController(repository: r);
    await t.pumpWidget(
      app(
        MatchFormPage(
          controller: c,
          teamRepository: teams,
          onSaved: (_) {},
          onCheckOutcome: () async {},
        ),
      ),
    );
    await t.pumpAndSettle();
    expect(status, 'active');
    teams.onList = (_) async => [
      teams_fixtures.team(id: 42, name: '真实主队'),
      teams_fixtures.team(id: 43, name: '停用主队', status: 'frozen'),
    ];
    await scrollTo(t, find.text('重试读取球队'));
    await t.tap(find.text('重试读取球队'));
    await t.pumpAndSettle();
    await scrollTo(t, find.text('选择主队'));
    await t.tap(find.text('选择主队'));
    await t.pumpAndSettle();
    expect(find.text('真实主队'), findsOneWidget);
    expect(find.text('停用主队'), findsNothing);
    await t.tap(find.text('真实主队'));
    await t.pumpAndSettle();
    expect(find.text('真实主队'), findsOneWidget);
    c.dispose();
  });
  testWidgets(
    'missing and initial read failure recover by reading or returning',
    (t) async {
      final r = FakeMatchRepository();
      final c = MatchDetailController(repository: r, id: 'match-1');
      int returned = 0;
      await t.pumpWidget(
        app(
          MatchDetailPage(
            controller: c,
            onEdit: (_) {},
            onReturnToList: () => returned++,
          ),
        ),
      );
      r.reads.last.completeError(
        const ApiError(message: '读取失败', kind: ApiErrorKind.network),
      );
      await t.pumpAndSettle();
      expect(find.text('读取失败'), findsOneWidget);
      await t.tap(find.text('重试'));
      await t.pump();
      r.reads.last.completeError(
        const ApiError(
          message: '不存在',
          kind: ApiErrorKind.business,
          httpStatus: 404,
        ),
      );
      await t.pumpAndSettle();
      expect(find.textContaining('比赛不存在'), findsOneWidget);
      await t.tap(find.text('返回比赛列表'));
      expect(returned, 1);
      expect(find.text('重试读取详情'), findsOneWidget);
      c.dispose();
    },
  );
  testWidgets(
    'delete confirmation cancellation sends no request and names actual match',
    (t) async {
      final r = FakeMatchRepository();
      final c = MatchDetailController(
        repository: r,
        id: 'match-1',
        isSuperAdmin: true,
      );
      await t.pumpWidget(app(MatchDetailPage(controller: c, onEdit: (_) {})));
      r.reads.last.complete(detail());
      await t.pumpAndSettle();
      await t.tap(find.byTooltip('更多比赛操作'));
      await t.pumpAndSettle();
      await t.tap(find.text('删除比赛'));
      await t.pumpAndSettle();
      expect(find.textContaining('测试比赛'), findsWidgets);
      expect(find.textContaining('match-1'), findsWidgets);
      await t.tap(find.text('取消'));
      await t.pumpAndSettle();
      expect(r.commands, isEmpty);
      c.dispose();
    },
  );
  testWidgets(
    'dirty guard preserves fields on cancel and blocks in-flight back',
    (t) async {
      final r = CaptureRepository();
      final c = MatchFormController(repository: r, id: 'match-1');
      await t.pumpWidget(
        app(
          Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => MatchFormPage(
                      controller: c,
                      teamRepository: FakeTeamRepository(),
                      initialDetail: detail(),
                      onSaved: (_) {},
                      onCheckOutcome: () async {},
                    ),
                  ),
                ),
                child: const Text('打开编辑'),
              ),
            ),
          ),
        ),
      );
      await t.tap(find.text('打开编辑'));
      await t.pumpAndSettle();
      await t.enterText(field('比赛名称'), '新比赛名称');
      await t.pump();
      await Navigator.of(t.element(find.byType(MatchFormPage))).maybePop();
      await t.pumpAndSettle();
      expect(find.text('放弃未保存的修改？'), findsOneWidget);
      await t.tap(find.text('取消'));
      await t.pumpAndSettle();
      expect(find.text('新比赛名称'), findsOneWidget);
      await t.tap(find.text('保存比赛'));
      await t.pump();
      await Navigator.of(t.element(find.byType(MatchFormPage))).maybePop();
      await t.pump();
      expect(find.text('放弃未保存的修改？'), findsNothing);
      expect(find.byType(MatchFormPage), findsOneWidget);
      expect(r.commands, ['update:match-1']);
      r.writes.last.complete(detail());
      await t.pumpAndSettle();
      c.dispose();
    },
  );
  testWidgets(
    'uncertain form stays locked until viewing outcome and explicit no-effect acknowledgement',
    (t) async {
      final r = CaptureRepository();
      final c = MatchFormController(repository: r, id: 'match-1');
      int checks = 0;
      await t.pumpWidget(
        app(
          MatchFormPage(
            controller: c,
            teamRepository: FakeTeamRepository(),
            initialDetail: detail(),
            onSaved: (_) {},
            onCheckOutcome: () async {
              checks++;
            },
          ),
        ),
      );
      await t.tap(find.text('保存比赛'));
      await t.pump();
      r.writes.last.completeError(
        const ApiError(
          message: '超时',
          kind: ApiErrorKind.timeout,
          uncertainWrite: true,
        ),
      );
      await t.pumpAndSettle();
      expect(c.writeOutcomeUncertain, true);
      expect(find.text('已核实未生效，解锁提交'), findsNothing);
      await t.tap(find.text('查看列表或详情核实结果'));
      await t.pumpAndSettle();
      expect(checks, 1);
      expect(c.writeOutcomeUncertain, true);
      expect(r.commands.length, 1);
      await t.tap(find.text('已核实未生效，解锁提交'));
      await t.pumpAndSettle();
      await t.tap(find.text('取消'));
      await t.pumpAndSettle();
      expect(c.writeOutcomeUncertain, true);
      await t.tap(find.text('已核实未生效，解锁提交'));
      await t.pumpAndSettle();
      await t.tap(find.text('确认'));
      await t.pumpAndSettle();
      expect(c.writeOutcomeUncertain, false);
      expect(r.commands.length, 1);
      c.dispose();
    },
  );
  testWidgets(
    'resource changes refresh mounted list and detail and stop after disposal',
    (t) async {
      final r = FakeMatchRepository();
      final changes = ResourceChanges();
      final list = MatchListController(repository: r);
      final c = MatchDetailController(repository: r, id: 'match-1');
      await t.pumpWidget(
        app(
          Column(
            children: [
              Expanded(
                child: MatchListPage(
                  controller: list,
                  changes: changes,
                  onOpenMatch: (_) {},
                  onCreate: () {},
                ),
              ),
              Expanded(
                child: MatchDetailPage(
                  controller: c,
                  changes: changes,
                  onEdit: (_) {},
                ),
              ),
            ],
          ),
        ),
      );
      r.lists.last.result.complete(page(1, ['m'], total: 1));
      r.reads.last.complete(detail());
      await t.pumpAndSettle();
      changes.emit(ResourceKind.matches);
      await t.pump();
      expect(r.lists.length, 2);
      expect(r.reads.length, 2);
      r.lists.last.result.complete(page(1, ['m'], total: 1));
      r.reads.last.complete(detail());
      await t.pumpAndSettle();
      await t.pumpWidget(app(const Text('离开页面')));
      changes.emit(ResourceKind.matches);
      await t.pumpAndSettle();
      expect(r.lists.length, 2);
      expect(r.reads.length, 2);
      list.dispose();
      c.dispose();
      changes.dispose();
    },
  );
  testWidgets('background read preserves unsaved score inputs', (t) async {
    final r = FakeMatchRepository();
    final c = MatchDetailController(repository: r, id: 'match-1');
    await t.pumpWidget(app(MatchDetailPage(controller: c, onEdit: (_) {})));
    r.reads.last.complete(detail(status: 'ongoing'));
    await t.pumpAndSettle();
    await scrollTo(t, field('主队比分'));
    await t.enterText(field('主队比分'), '2');
    final reload = c.load();
    r.reads.last.complete(detail(status: 'ongoing'));
    await reload;
    await t.pumpAndSettle();
    expect(t.widget<TextField>(field('主队比分')).controller!.text, '2');
    c.dispose();
  });
  testWidgets(
    'roster additions and removals retain dirty scores and update detail',
    (t) async {
      final r = FakeMatchRepository();
      final c = MatchDetailController(repository: r, id: 'match-1');
      await t.pumpWidget(app(MatchDetailPage(controller: c, onEdit: (_) {})));
      final first = detail(status: 'ongoing');
      r.reads.last.complete(first);
      await t.pumpAndSettle();
      await scrollTo(t, field('主队比分'));
      await t.enterText(field('主队比分'), '2');
      await t.enterText(field('客队比分'), '1');
      for (final addGroup in [true, false]) {
        final status = addGroup ? 'ended' : 'ongoing';
        final name = addGroup ? '新增分组后的比赛' : '移除分组后的比赛';
        final json = detailJson(status: status);
        (json['match'] as Map)['name'] = name;
        final updatedMatch = MatchResponseMapper.detail(json).match;
        final reload = c.load();
        r.reads.last.complete(
          MatchDetail(
            match: updatedMatch,
            groups: addGroup
                ? [
                    ...first.groups,
                    RegistrationGroup(
                      id: 'new-guest',
                      kind: 'guest_team',
                      teamId: 13,
                      minPlayers: null,
                      maxPlayers: 8,
                      status: 'open',
                      registrations: [],
                    ),
                  ]
                : [],
          ),
        );
        await reload;
        await t.pumpAndSettle();
        await scrollTo(t, field('主队比分'));
        expect(t.widget<TextField>(field('主队比分')).controller!.text, '2');
        expect(t.widget<TextField>(field('客队比分')).controller!.text, '1');
        await t.drag(find.byType(ListView), const Offset(0, 3000));
        await t.pumpAndSettle();
        await scrollTo(t, find.text(name));
        expect(find.text(name), findsOneWidget);
        expect(find.text(addGroup ? '已结束' : '进行中'), findsOneWidget);
        expect(c.state.data!.groups.length, addGroup ? 2 : 0);
        await scrollTo(t, field('主队比分'));
        expect(t.widget<TextField>(field('主队比分')).controller!.text, '2');
        expect(t.widget<TextField>(field('客队比分')).controller!.text, '1');
      }
      await t.pumpWidget(app(const Text('离开页面')));
      c.dispose();
    },
  );
  testWidgets(
    'Beijing date and time pickers are Chinese and convert wall clock explicitly',
    (t) async {
      BeijingClock? selected;
      await t.pumpWidget(
        app(
          Scaffold(
            body: BeijingTimeField(
              label: '测试时间',
              value: BeijingClock(2026, 10, 4, 9, 30),
              onChanged: (v) => selected = v,
            ),
          ),
        ),
      );
      await t.tap(find.text('2026-10-04 09:30（北京时间）'));
      await t.pumpAndSettle();
      expect(find.text('选择日期（北京时间）'), findsOneWidget);
      await t.tap(find.text('确定'));
      await t.pumpAndSettle();
      expect(find.text('选择时间（北京时间）'), findsOneWidget);
      await t.tap(find.text('确定'));
      await t.pumpAndSettle();
      expect(selected!.toUtc(), DateTime.utc(2026, 10, 4, 1, 30));
    },
  );
  testWidgets(
    'create uses selected real team and server result with no replay on success',
    (t) async {
      final r = CaptureRepository();
      final c = MatchFormController(repository: r);
      MatchDetail? saved;
      await t.pumpWidget(
        app(
          MatchFormPage(
            controller: c,
            teamRepository: FakeTeamRepository(),
            onSaved: (d) => saved = d,
            onCheckOutcome: () async {},
          ),
        ),
      );
      await t.pumpAndSettle();
      await t.enterText(field('比赛名称'), '真实新比赛');
      await scrollTo(t, find.text('选择主队'));
      await t.tap(find.text('选择主队'));
      await t.pumpAndSettle();
      await t.tap(find.text('星河队'));
      await t.pumpAndSettle();
      await scrollTo(t, find.text('开始时间'));
      await t.tap(find.text('未设置，点击选择').first);
      await t.pumpAndSettle();
      await t.tap(find.text('确定'));
      await t.pumpAndSettle();
      await t.tap(find.text('确定'));
      await t.pumpAndSettle();
      await scrollTo(t, field('场地名称'));
      await t.enterText(field('场地名称'), '真实场地');
      await t.tap(find.text('保存比赛'));
      await t.pump();
      expect(r.submitted!.hostTeamId, 42);
      expect(r.commands, ['create']);
      r.writes.last.complete(detail(id: 'server-created'));
      await t.pumpAndSettle();
      expect(saved!.match.id, 'server-created');
      await t.tap(find.text('保存比赛'));
      await t.pump();
      expect(r.commands, ['create']);
      c.dispose();
    },
  );
  testWidgets('score form validates and cancellation never sends writes', (
    t,
  ) async {
    final r = FakeMatchRepository();
    final c = MatchDetailController(repository: r, id: 'match-1');
    await t.pumpWidget(app(MatchDetailPage(controller: c, onEdit: (_) {})));
    r.reads.last.complete(detail(status: 'ongoing'));
    await t.pumpAndSettle();
    await scrollTo(t, find.text('保存比分'));
    await t.tap(find.text('保存比分'));
    await t.pumpAndSettle();
    expect(find.text('请输入 0 到 999 的整数'), findsNWidgets(2));
    await t.enterText(field('主队比分'), '0');
    await t.enterText(field('客队比分'), '0');
    await scrollTo(t, find.text('保存比分'));
    await t.tap(find.text('保存比分'));
    await t.pumpAndSettle();
    expect(find.textContaining('测试比赛'), findsWidgets);
    await t.tap(find.text('取消'));
    await t.pumpAndSettle();
    expect(r.commands, isEmpty);
    c.dispose();
  });
  testWidgets(
    'mobile sizes landscape keyboard and 2x long content remain scrollable',
    (t) async {
      for (final width in [360.0, 390.0, 430.0, 844.0]) {
        t.view.physicalSize = Size(width, width == 844 ? 390 : 844);
        t.view.devicePixelRatio = 1;
        for (final dark in [true, false]) {
          final r = FakeMatchRepository();
          final form = MatchFormController(repository: r, id: 'match-1');
          await t.pumpWidget(
            app(
              MatchFormPage(
                controller: form,
                teamRepository: FakeTeamRepository(),
                initialDetail: detail(),
                onSaved: (_) {},
                onCheckOutcome: () async {},
              ),
              dark: dark,
              scale: 2,
              keyboard: const EdgeInsets.only(bottom: 120),
            ),
          );
          await t.pumpAndSettle();
          await scrollTo(t, field('客队球服颜色（选填）'));
          expect(t.takeException(), isNull);
          expect(find.text('保存比赛').hitTestable(), findsOneWidget);
          await t.pumpWidget(app(const Text('离开')));
          form.dispose();
          final c = MatchDetailController(repository: r, id: 'match-1');
          final json = detailJson();
          (json['match'] as Map)['name'] = '非常长的比赛名称与组织信息' * 12;
          await t.pumpWidget(
            app(
              MatchDetailPage(controller: c, onEdit: (_) {}),
              dark: dark,
              scale: 2,
            ),
          );
          r.reads.last.complete(MatchResponseMapper.detail(json));
          await t.pumpAndSettle();
          expect(t.takeException(), isNull);
          await scrollTo(t, find.text('取消比赛'));
          expect(t.takeException(), isNull);
          final reload = c.load();
          r.reads.last.completeError(
            ApiError(message: '很长的读取失败原因' * 90, kind: ApiErrorKind.network),
          );
          await reload;
          await t.pumpAndSettle();
          expect(t.takeException(), isNull);
          await t.pumpWidget(app(const Text('离开')));
          c.dispose();
          final list = MatchListController(repository: r);
          await t.pumpWidget(
            app(
              MatchListPage(
                controller: list,
                onOpenMatch: (_) {},
                onCreate: () {},
              ),
              dark: dark,
              scale: 2,
            ),
          );
          r.lists.last.result.complete(page(1, [], total: 0));
          await t.pumpAndSettle();
          expect(t.takeException(), isNull);
          await t.pumpWidget(app(const Text('离开')));
          list.dispose();
        }
      }
      t.view.resetPhysicalSize();
      t.view.resetDevicePixelRatio();
    },
  );
  testWidgets('team selection sheet survives landscape keyboard and 2x text', (
    t,
  ) async {
    t.view.physicalSize = const Size(844, 390);
    t.view.devicePixelRatio = 1;
    final teams = FakeTeamRepository();
    teams.items = [teams_fixtures.team(name: '很长的真实球队名称' * 15)];
    await t.pumpWidget(
      app(
        Scaffold(
          body: ActiveTeamField(
            repository: teams,
            value: null,
            onChanged: (_) {},
          ),
        ),
        scale: 2,
        keyboard: const EdgeInsets.only(bottom: 120),
      ),
    );
    await t.pumpAndSettle();
    await t.tap(find.text('选择主队'));
    await t.pumpAndSettle();
    expect(t.takeException(), isNull);
    await t.enterText(find.byType(TextField), '无匹配');
    await t.pumpAndSettle();
    expect(t.takeException(), isNull);
    t.view.resetPhysicalSize();
    t.view.resetDevicePixelRatio();
  });
}
