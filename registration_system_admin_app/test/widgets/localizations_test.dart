import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/design_system/admin_localizations.dart';

void main() {
  testWidgets('shared localization supplies Chinese picker actions', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: AdminLocalizations.locale,
        localizationsDelegates: AdminLocalizations.delegates,
        supportedLocales: AdminLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => showDatePicker(
                context: context,
                initialDate: DateTime(2026, 10, 3),
                firstDate: DateTime(2026),
                lastDate: DateTime(2027),
              ),
              child: const Text('选择日期'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('选择日期'));
    await tester.pumpAndSettle();
    expect(find.text('取消'), findsOneWidget);
    expect(find.text('确定'), findsOneWidget);
  });
}
