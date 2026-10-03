import 'member_models.dart';

abstract final class MemberValidation {
  static Map<String, String> profile(String? name, String? phone) => {
    if ((name?.trim().runes.length ?? 0) > 120) 'realName': '姓名最多 120 个字符',
    if ((phone?.trim().runes.length ?? 0) > 32) 'phone': '电话最多 32 个字符',
  };
  static bool role(String role) => Member.assignableRoles.contains(role);
  static bool status(String status) => Member.statuses.contains(status);
}
