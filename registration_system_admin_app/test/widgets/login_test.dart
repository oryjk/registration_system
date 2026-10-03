import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/design_system/admin_theme.dart';
import 'package:registration_system_admin_app/features/session/presentation/login_page.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/features/session/application/session_controller.dart';
import '../support/fake_session_repository.dart' show Repository;
import '../support/fake_storage.dart';

void main() {
  testWidgets(
    'login validates, hides password, locks submission and retains failed input',
    (tester) async {
      final repo = Repository()..loginPending = Completer();
      final session = SessionController(
        repository: repo,
        storage: FakeSecureStore(),
        environment: Uri.parse('https://example.test'),
      );
      await session.restore();
      await tester.pumpWidget(
        MaterialApp(
          theme: AdminTheme.build(dark: true),
          home: LoginPage(controller: session),
        ),
      );
      await tester.tap(find.text('登录'));
      await tester.pump();
      expect(find.text('请输入用户名'), findsOneWidget);
      expect(repo.logins, 0);
      await tester.enterText(
        find.byKey(const Key('login.username')),
        'operator',
      );
      await tester.enterText(
        find.byKey(const Key('login.password')),
        'password',
      );
      expect(
        tester
            .widget<EditableText>(
              find.descendant(
                of: find.byKey(const Key('login.password')),
                matching: find.byType(EditableText),
              ),
            )
            .obscureText,
        isTrue,
      );
      await tester.tap(find.text('登录'));
      await tester.pump();
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      expect(find.text('提交中…'), findsOneWidget);
      repo.loginPending!.completeError(
        const ApiError(message: '账号或密码错误', kind: ApiErrorKind.unauthorized),
      );
      await tester.pumpAndSettle();
      expect(find.text('账号或密码错误'), findsOneWidget);
      expect(find.text('operator'), findsOneWidget);
      expect(find.text('password'), findsOneWidget);
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNotNull,
      );
    },
  );
  for (final width in [360.0, 390.0, 430.0, 844.0]) {
    testWidgets(
      'login remains scrollable at width $width and 2x text with keyboard',
      (tester) async {
        tester.view.resetPhysicalSize();
        tester.view.physicalSize = Size(width, 390);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final session = SessionController(
          repository: Repository(),
          storage: FakeSecureStore(),
          environment: Uri.parse('https://example.test'),
        );
        await session.restore();
        await tester.pumpWidget(
          MaterialApp(
            theme: AdminTheme.build(dark: false),
            home: MediaQuery(
              data: MediaQueryData(
                size: Size(width, 390),
                textScaler: TextScaler.linear(2),
                viewInsets: const EdgeInsets.only(bottom: 100),
              ),
              child: LoginPage(controller: session),
            ),
          ),
        );
        await tester.pump();
        expect(tester.takeException(), isNull);
        expect(find.byType(SingleChildScrollView), findsOneWidget);
      },
    );
  }
}
