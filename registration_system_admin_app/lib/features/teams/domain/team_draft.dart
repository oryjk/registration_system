import 'team.dart';

/// Null status is a creation draft; editing requires an explicit known status.
class TeamDraft {
  const TeamDraft({required this.name, this.description, this.status});
  factory TeamDraft.fromTeam(Team team) => TeamDraft(
    name: team.name,
    description: team.description,
    status: team.status,
  );
  final String name;
  final String? description, status;
  Map<String, String> validate() => {
    if (name.trim().isEmpty) 'name': '请输入球队名称',
    if (name.trim().runes.length > 120) 'name': '球队名称不能超过 120 个字符',
    if (status != null && !Team.editableStatuses.contains(status))
      'status': '当前球队状态不支持修改',
  };
}
