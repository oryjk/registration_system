import '../../../core/money/money.dart';
import '../../../core/time/beijing_time.dart';
import '../../../design_system/design_system.dart';

String memberRoleLabel(String role) => switch (role) {
  'captain' => '队长',
  'leader' => '领队',
  'vice_captain' => '副队长',
  'member' => '队员',
  _ => '未知角色（$role）',
};
String memberStatusLabel(String status) => switch (status) {
  'active' => '启用',
  'inactive' => '停用',
  'left' => '已离队',
  _ => '未知状态（$status）',
};
StatusTone memberStatusTone(String status) => switch (status) {
  'active' => StatusTone.success,
  'inactive' => StatusTone.warning,
  'left' => StatusTone.neutral,
  _ => StatusTone.danger,
};
String memberBalance(int cents) =>
    cents < 0 ? '欠款 ¥${formatCents(cents.abs())}' : '余额 ¥${formatCents(cents)}';
String memberInstant(DateTime date) {
  final b = BeijingClock.fromInstant(date);
  return '${b.dateKey} ${b.hour.toString().padLeft(2, '0')}:${b.minute.toString().padLeft(2, '0')}（北京时间）';
}
