import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/pages/admin_home_page.dart';
import 'package:registration_system_admin_app/pages/login_page.dart';
import 'package:registration_system_admin_app/services/admin_api_client.dart';
import 'package:registration_system_admin_app/services/admin_api_scope.dart';
import 'package:registration_system_admin_app/services/admin_session.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('shows login page before admin session exists', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(_TestApp(child: const LoginPage()));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('管理端登录'), findsOneWidget);
    expect(find.text('用户名'), findsOneWidget);
    expect(find.text('密码'), findsOneWidget);
  });

  testWidgets('shows admin home entry points', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(_TestApp(child: const AdminHomePage()));

    expect(find.text('管理工作台'), findsOneWidget);
    expect(find.text('创建比赛'), findsAtLeastNWidgets(1));
    expect(find.text('创建球队'), findsAtLeastNWidgets(1));
  });
}

class _TestApp extends StatelessWidget {
  const _TestApp({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: AdminApiScope(
        api: AdminApiClient(
          baseUrl: defaultAdminApiBaseUrl,
          accessToken: 'test-token',
        ),
        store: AdminSessionStore(),
        onSessionChanged: (_) async {},
        child: child,
      ),
    );
  }
}
