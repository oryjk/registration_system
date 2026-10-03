import 'dart:async';
import 'package:registration_system_admin_app/features/session/domain/admin_session.dart';
import 'package:registration_system_admin_app/features/session/domain/session_repository.dart';

final user = AdminUser(
  id: 7,
  username: 'operator',
  role: 'admin',
  status: 'active',
  isSuperAdmin: false,
  createdAt: DateTime.utc(2026),
);

class Repository implements SessionRepository {
  Object? error;
  Completer<AdminSession>? loginPending;
  Completer<AdminUser>? currentPending;
  int logins = 0;
  @override
  Future<AdminUser> current() async {
    if (error != null) throw error!;
    return currentPending == null ? user : currentPending!.future;
  }

  @override
  Future<AdminSession> login(String username, String password) async {
    logins++;
    if (error != null) throw error!;
    return loginPending == null
        ? AdminSession(accessToken: 'new-token', admin: user)
        : loginPending!.future;
  }
}
