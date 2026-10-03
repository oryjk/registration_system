import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/design_system/widgets/unsaved_guard.dart';

void main() {
  testWidgets('dirty back cancellation retains route then confirmation exits', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const UnsavedGuard(
                    dirty: true,
                    child: Scaffold(body: Text('编辑内容')),
                  ),
                ),
              ),
              child: const Text('打开'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('打开'));
    await tester.pumpAndSettle();
    final context = tester.element(find.text('编辑内容'));
    await Navigator.of(context).maybePop();
    await tester.pumpAndSettle();
    expect(find.text('放弃未保存的修改？'), findsOneWidget);
    await tester.tap(find.text('取消'));
    await tester.pumpAndSettle();
    expect(find.text('编辑内容'), findsOneWidget);
    await Navigator.of(context).maybePop();
    await tester.pumpAndSettle();
    await tester.tap(find.text('确认'));
    await tester.pumpAndSettle();
    expect(find.text('编辑内容'), findsNothing);
  });
}
