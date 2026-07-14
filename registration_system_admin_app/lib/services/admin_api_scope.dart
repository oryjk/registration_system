import 'package:flutter/material.dart';

import 'admin_api_client.dart';
import 'admin_session.dart';

class AdminApiScope extends InheritedWidget {
  const AdminApiScope({
    super.key,
    required this.api,
    required this.store,
    required this.onSessionChanged,
    required super.child,
  });

  final AdminApiClient api;
  final AdminSessionStore store;
  final Future<void> Function(AdminSession? session) onSessionChanged;

  static AdminApiScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AdminApiScope>();
    assert(scope != null, 'AdminApiScope not found in widget tree');
    return scope!;
  }

  @override
  bool updateShouldNotify(AdminApiScope oldWidget) {
    return api != oldWidget.api || store != oldWidget.store;
  }
}
