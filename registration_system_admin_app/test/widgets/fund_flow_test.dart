import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/design_system/design_system.dart';
import 'package:registration_system_admin_app/features/team_fund/application/fund_controller.dart';
import 'package:registration_system_admin_app/features/team_fund/data/secure_pending_fund_store.dart';
import 'package:registration_system_admin_app/features/team_fund/domain/fund_models.dart';
import 'package:registration_system_admin_app/features/team_fund/presentation/fund_form_page.dart';
import 'package:registration_system_admin_app/features/team_fund/presentation/fund_transactions_page.dart';
import '../team_fund/fixtures.dart';

Widget host(Widget page, {double scale = 1}) => MaterialApp(
  theme: AdminTheme.build(dark: true),
  locale: AdminLocalizations.locale,
  supportedLocales: AdminLocalizations.supportedLocales,
  localizationsDelegates: AdminLocalizations.delegates,
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
    child: child!,
  ),
  home: page,
);
FundFormPage form(
  FundController c, {
  FundAction mode = FundAction.credit,
  FundTransaction? original,
  String name = '成员七',
}) => FundFormPage(
  controller: c,
  action: mode,
  memberName: name,
  teamName: '球队四二',
  balanceCents: -150,
  original: original,
  loadOnStart: false,
);
Future<void> showField(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder,
    200,
    scrollable: find
        .descendant(
          of: find.byType(ListView).first,
          matching: find.byType(Scrollable),
        )
        .first,
  );
  await tester.pumpAndSettle();
}

Future<void> enterField(
  WidgetTester tester,
  Finder finder,
  String value,
) async {
  await showField(tester, finder);
  await tester.enterText(finder, value);
  await tester.pumpAndSettle();
}

Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'restored pending exposes original payload locks amount and new actions; explicit retry',
    (tester) async {
      final s = SecurePendingFundStore(MemorySecureStore()),
          r = FakeFunds()
            ..failure = const ApiError(
              message: '超时',
              kind: ApiErrorKind.timeout,
            );
      await s.save(action());
      final c = FundController(scope: scope, repository: r, store: s);
      await c.restore();
      await tester.pumpWidget(host(form(c)));
      await tester.pumpAndSettle();
      expect(r.calls, isEmpty);
      expect(find.textContaining('有一笔记账结果待确认'), findsOneWidget);
      expect(
        tester
            .widget<TextFormField>(find.byKey(const Key('fundAmount')))
            .enabled,
        false,
      );
      await tapVisible(tester, find.text('重试原请求'));
      expect(r.calls.single.draft, draft);
      expect(r.calls.single.key, 'original');
      await tester.pumpWidget(
        host(
          FundTransactionsPage(
            controller: c,
            memberName: '成员七',
            teamName: '球队四二',
            balanceCents: -150,
            onCredit: () {},
            onConsume: () {},
            loadOnStart: false,
          ),
        ),
      );
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '登记收款'))
            .onPressed,
        isNull,
      );
      c.dispose();
    },
  );
  testWidgets(
    'credit confirmation cancel zero requests then success/read failure prevents repeated form write',
    (tester) async {
      final r = FakeFunds()..readFailure = StateError('读取失败');
      final controller = FundController(
        scope: scope,
        repository: r,
        store: SecurePendingFundStore(MemorySecureStore()),
      );
      await controller.restore();
      await tester.pumpWidget(host(form(controller)));
      await enterField(tester, find.byKey(const Key('fundAmount')), '29.00');
      await enterField(tester, find.byKey(const Key('fundNote')), '线下款');
      await tapVisible(tester, find.text('确认收款登记'));
      expect(find.textContaining('用户 7'), findsWidgets);
      await tapVisible(tester, find.text('取消'));
      expect(r.calls, isEmpty);
      await tapVisible(tester, find.text('确认收款登记'));
      await tapVisible(tester, find.text('确认'));
      expect(r.calls.single.draft.amountCents, 2900);
      expect(find.text('本项已完成'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '本项已完成'))
            .onPressed,
        isNull,
      );
      expect(find.text('欠款 ¥1.20'), findsWidgets);
      r.readFailure = null;
      await tapVisible(tester, find.text('重试读取流水'));
      expect(r.calls.length, 1);
      controller.dispose();
    },
  );
  testWidgets(
    'history renders source whitelist and real reversal navigation callback',
    (tester) async {
      final r = FakeFunds()
        ..pages.add([
          transaction(9),
          transaction(8, source: 'match_settlement'),
          transaction(7, reversed: 10),
        ]);
      final c = FundController(
        scope: scope,
        repository: r,
        store: SecurePendingFundStore(MemorySecureStore()),
      );
      await c.restore();
      await c.refreshTransactions();
      FundTransaction? selected;
      await tester.pumpWidget(
        host(
          FundTransactionsPage(
            controller: c,
            memberName: '成员七',
            teamName: '球队四二',
            balanceCents: -150,
            onReverse: (t) => selected = t,
            loadOnStart: false,
          ),
        ),
      );
      expect(find.text('余额 ¥29.00'), findsOneWidget);
      expect(find.text('冲正此流水'), findsOneWidget);
      await tapVisible(tester, find.text('冲正此流水'));
      expect(selected!.id, 9);
      c.dispose();
    },
  );
  testWidgets(
    'reversal requires reason and confirms original member amount impact',
    (tester) async {
      final original = transaction(9),
          r = FakeFunds()..pages.add([transaction(9)]);
      final c = FundController(
        scope: scope,
        repository: r,
        store: SecurePendingFundStore(MemorySecureStore()),
      );
      await c.restore();
      await c.refreshTransactions();
      await tester.pumpWidget(
        host(form(c, mode: FundAction.reversal, original: original)),
      );
      await tapVisible(tester, find.text('确认流水冲正'));
      expect(r.calls, isEmpty);
      expect(find.text('请填写原因'), findsWidgets);
      await enterField(tester, find.byKey(const Key('fundNote')), '重复登记');
      await tapVisible(tester, find.text('确认流水冲正'));
      expect(find.textContaining('原流水 #9'), findsWidgets);
      expect(find.textContaining('扣回 ¥29.00'), findsWidgets);
      expect(find.textContaining('用户 7'), findsWidgets);
      await tapVisible(tester, find.text('确认'));
      expect(r.calls.single.draft.originalTransactionId, 9);
      expect(r.calls.single.draft.amountCents, 0);
      expect(find.text('本项已完成'), findsOneWidget);
      c.dispose();
    },
  );
  testWidgets(
    'original becoming reversed during confirmation suppresses request',
    (tester) async {
      final r = FakeFunds()..pages.add([transaction(9)]);
      final controller = FundController(
        scope: scope,
        repository: r,
        store: SecurePendingFundStore(MemorySecureStore()),
      );
      await controller.restore();
      await controller.refreshTransactions();
      await tester.pumpWidget(
        host(
          form(controller, mode: FundAction.reversal, original: transaction(9)),
        ),
      );
      await enterField(tester, find.byKey(const Key('fundNote')), '纠错');
      await tapVisible(tester, find.text('确认流水冲正'));
      r.pages.add([transaction(9, reversed: 10)]);
      await controller.refreshTransactions();
      await tapVisible(tester, find.text('确认'));
      expect(r.calls, isEmpty);
      controller.dispose();
    },
  );
  testWidgets('consume required reason and exact cents with no date', (
    tester,
  ) async {
    final r = FakeFunds();
    final controller = FundController(
      scope: scope,
      repository: r,
      store: SecurePendingFundStore(MemorySecureStore()),
    );
    await controller.restore();
    await tester.pumpWidget(host(form(controller, mode: FundAction.consume)));
    await enterField(tester, find.byKey(const Key('fundAmount')), '0.29');
    await tapVisible(tester, find.text('确认消费扣费'));
    expect(r.calls, isEmpty);
    expect(find.text('请填写原因'), findsWidgets);
    await enterField(tester, find.byKey(const Key('fundNote')), '饮水');
    await tapVisible(tester, find.text('确认消费扣费'));
    await tapVisible(tester, find.text('确认'));
    expect(r.calls.single.draft.amountCents, 29);
    expect(r.calls.single.draft.receivedOn, isNull);
    controller.dispose();
  });
  testWidgets(
    'forms long errors 2x text keyboard at 360 390 430 and landscape',
    (tester) async {
      for (final size in [
        const Size(360, 780),
        const Size(390, 844),
        const Size(430, 932),
        const Size(844, 390),
      ]) {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1;
        final r = FakeFunds()
          ..failure = ApiError(
            message: '网络错误，请核对原记账记录。' * 30,
            kind: ApiErrorKind.timeout,
          );
        final controller = FundController(
          scope: scope,
          repository: r,
          store: SecurePendingFundStore(MemorySecureStore()),
        );
        await controller.submit(draft);
        await tester.pumpWidget(
          host(form(controller, name: '很长的球员名字' * 6), scale: 2),
        );
        await tester.pumpAndSettle();
        expect(find.byType(FundFormPage), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        controller.dispose();
        final editable = FundController(
          scope: scope,
          repository: FakeFunds(),
          store: SecurePendingFundStore(MemorySecureStore()),
        );
        await editable.restore();
        await tester.pumpWidget(host(form(editable), scale: 2));
        await tester.pumpAndSettle();
        await showField(tester, find.byKey(const Key('fundNote')));
        await enterField(tester, find.byKey(const Key('fundNote')), '测试');
        tester.view.viewInsets = FakeViewPadding(bottom: size.height / 3);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        editable.dispose();
        tester.view.resetViewInsets();
      }
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    },
  );
  testWidgets(
    'credit date picker persists pure calendar date in original payload',
    (tester) async {
      final r = FakeFunds(),
          c = FundController(
            scope: scope,
            repository: r,
            store: SecurePendingFundStore(MemorySecureStore()),
          );
      await c.restore();
      await tester.pumpWidget(host(form(c)));
      await enterField(tester, find.byKey(const Key('fundAmount')), '29.00');
      final dateButton = find.textContaining('收款日期：');
      await tapVisible(tester, dateButton);
      expect(find.byType(DatePickerDialog), findsOneWidget);
      await tester.tap(find.text('15').last);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, '确定'));
      await tester.pumpAndSettle();
      final date = tester.widget<Text>(dateButton).data!.split('：').last;
      expect(date, matches(RegExp(r'^\d{4}-\d{2}-15$')));
      await tapVisible(tester, find.text('确认收款登记'));
      await tapVisible(tester, find.text('确认'));
      expect(r.calls.single.draft.receivedOn, date);
      c.dispose();
    },
  );
  testWidgets(
    'dirty form cancel exit keeps inputs then confirmed discard sends no write',
    (tester) async {
      final r = FakeFunds(),
          c = FundController(
            scope: scope,
            repository: r,
            store: SecurePendingFundStore(MemorySecureStore()),
          );
      await c.restore();
      await tester.pumpWidget(
        host(
          Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () => Navigator.of(
                  context,
                ).push(MaterialPageRoute<void>(builder: (_) => form(c))),
                child: const Text('打开记账'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('打开记账'));
      await tester.pumpAndSettle();
      await enterField(tester, find.byKey(const Key('fundAmount')), '29.00');
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('放弃未保存的修改？'), findsOneWidget);
      await tapVisible(tester, find.text('取消'));
      expect(find.byType(FundFormPage), findsOneWidget);
      expect(r.calls, isEmpty);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tapVisible(tester, find.text('确认'));
      expect(find.text('打开记账'), findsOneWidget);
      expect(r.calls, isEmpty);
      c.dispose();
    },
  );
}
