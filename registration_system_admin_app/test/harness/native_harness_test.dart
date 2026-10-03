import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/app/admin_shell.dart';
import 'package:registration_system_admin_app/features/matches/presentation/match_list_page.dart';
import 'main.dart';

void main() {
  testWidgets(
    'offline harness launches actual shell and switches actual error/empty scenes',
    (tester) async {
      await tester.pumpWidget(const NativeSceneHarness());
      await tester.pumpAndSettle();
      expect(find.byType(AdminShell), findsOneWidget);
      expect(find.text('周末友谊赛'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('error'), 300);
      await tester.tap(find.text('error'));
      await tester.pumpAndSettle();
      expect(find.byType(MatchListPage), findsOneWidget);
      expect(find.text('读取暂时失败，请重试'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('empty'), 300);
      await tester.tap(find.text('empty'));
      await tester.pumpAndSettle();
      expect(find.byType(MatchListPage), findsOneWidget);
      expect(find.text('周末友谊赛'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
