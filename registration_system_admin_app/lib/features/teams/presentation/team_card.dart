import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../domain/team.dart';

String teamStatusLabel(String status) => switch (status) {
  'active' => '启用',
  'frozen' => '冻结',
  'dissolved' => '已解散',
  'deleted' => '已删除',
  _ => '未知状态（$status）',
};
StatusTone teamStatusTone(String status) => switch (status) {
  'active' => StatusTone.success,
  'frozen' => StatusTone.warning,
  'dissolved' || 'deleted' => StatusTone.danger,
  _ => StatusTone.neutral,
};

class TeamLogo extends StatelessWidget {
  const TeamLogo({super.key, required this.team});
  final Team team;
  @override
  Widget build(BuildContext context) {
    final fallback = Icon(
      Icons.shield_outlined,
      color: AdminColors.of(context).muted,
    );
    final url = team.logoUrl?.trim();
    return ClipRRect(
      borderRadius: BorderRadius.circular(AdminComponents.controlRadius),
      child: SizedBox(
        width: AdminComponents.touchTarget,
        height: AdminComponents.touchTarget,
        child: ColoredBox(
          color: AdminColors.of(context).inset,
          child: url == null || url.isEmpty
              ? fallback
              : Image.network(
                  url,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => fallback,
                ),
        ),
      ),
    );
  }
}

class TeamCard extends StatelessWidget {
  const TeamCard({super.key, required this.team, required this.onTap});
  final Team team;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AdminComponents.panelRadius),
      child: Padding(
        padding: const EdgeInsets.all(AdminComponents.panelPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TeamLogo(team: team),
                const SizedBox(width: AdminSpacing.field),
                Expanded(
                  child: Text(
                    team.name,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AdminSpacing.field),
            Wrap(
              spacing: AdminSpacing.field,
              runSpacing: AdminSpacing.label,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                StatusBadge(
                  text: teamStatusLabel(team.status),
                  tone: teamStatusTone(team.status),
                ),
                Text(
                  team.memberCount == null
                      ? '成员数未提供'
                      : '${team.memberCount} 位成员',
                ),
              ],
            ),
            const SizedBox(height: AdminSpacing.label),
            Text(
              '队长：${team.captain?.realName?.trim().isNotEmpty == true ? team.captain!.realName! : team.captain?.nickname ?? (team.captainId == null ? '未任命' : '资料未提供')}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    ),
  );
}
