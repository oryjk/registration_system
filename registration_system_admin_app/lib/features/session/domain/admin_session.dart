class AdminUser {
  const AdminUser({
    required this.id,
    required this.username,
    required this.role,
    required this.status,
    required this.isSuperAdmin,
    required this.createdAt,
  });
  final int id;
  final String username;
  final String role;
  final String status;
  final bool isSuperAdmin;
  final DateTime createdAt;
}

class AdminSession {
  const AdminSession({required this.accessToken, required this.admin});
  final String accessToken;
  final AdminUser admin;
}
