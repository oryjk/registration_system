import 'package:flutter/material.dart';
import 'app/admin_app.dart';
import 'app/app_dependencies.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final dependencies = AppDependencies(
    baseUrl: Uri.parse(
      const String.fromEnvironment(
        'ADMIN_API_BASE_URL',
        defaultValue: 'https://oryjk.cn:82/regist-v3',
      ),
    ),
  );
  runApp(AdminApp(dependencies: dependencies));
}
