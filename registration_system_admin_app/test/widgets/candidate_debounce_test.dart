import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/features/members/application/member_controller.dart';
import 'package:registration_system_admin_app/features/members/presentation/member_candidate_page.dart';
import 'package:registration_system_admin_app/features/members/domain/member_models.dart';
import '../members/fixtures.dart';
import 'member_flow_test.dart' show host;

void main() {
  testWidgets(
    'candidate typing burst clears selection and requests only latest; explicit refresh immediate',
    (t) async {
      final r = FakeMembers();
      final controller = MemberController(repository: r, teamId: 42);
      await controller.load();
      final initial = controller.searchCandidates('');
      r.searches['']!.complete([
        const MemberCandidate(userId: 8, nickname: '候选八'),
      ]);
      await initial;
      await t.pumpWidget(
        host(MemberCandidatePage(controller: controller, loadOnStart: false)),
      );
      await t.tap(find.text('候选八'));
      await t.pump();
      expect(find.textContaining('已选择：'), findsOneWidget);
      await t.enterText(find.byType(TextField).first, '周');
      await t.pump(const Duration(milliseconds: 100));
      expect(find.textContaining('已选择：'), findsNothing);
      await t.enterText(find.byType(TextField).first, '周同');
      await t.pump(const Duration(milliseconds: 100));
      await t.enterText(find.byType(TextField).first, '周同学');
      expect(r.searches.keys, ['']);
      await t.pump(const Duration(milliseconds: 350));
      expect(r.searches.keys, ['', '周同学']);
      r.searches['周同学']!.complete([]);
      await t.pump();
      await t.enterText(find.byType(TextField).first, '立即');
      await t.tap(find.byTooltip('重新查询候选'));
      await t.pump();
      expect(r.searches.containsKey('立即'), isTrue);
      r.searches['立即']!.complete([]);
      await t.pump(const Duration(milliseconds: 400));
      expect(controller.candidateState.loading, isFalse);
      await t.pumpWidget(const SizedBox());
      controller.dispose();
    },
  );
  testWidgets('candidate dispose cancels delayed query', (t) async {
    final r = FakeMembers();
    final c = MemberController(repository: r, teamId: 42);
    await c.load();
    await t.pumpWidget(
      host(MemberCandidatePage(controller: c, loadOnStart: false)),
    );
    await t.enterText(find.byType(TextField).first, '不会发送');
    await t.pumpWidget(const SizedBox());
    await t.pump(const Duration(milliseconds: 500));
    expect(r.searches, isEmpty);
    c.dispose();
  });
}
