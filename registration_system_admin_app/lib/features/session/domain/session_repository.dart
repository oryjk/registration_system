import 'admin_session.dart';

abstract interface class SessionRepository {
  Future<AdminSession> login(String username, String password);
  Future<AdminUser> current();
}
