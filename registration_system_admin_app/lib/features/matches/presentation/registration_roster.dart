import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../domain/match_models.dart';

/// A registration row is an account; registrationCount is its occupied places.
class RegistrationRoster extends StatelessWidget {
  const RegistrationRoster({super.key, required this.group});
  final RegistrationGroup group;
  @override
  Widget build(BuildContext context) {
    final attending = group.registrations
        .where((r) => r.status == 'attending')
        .fold(0, (n, r) => n + r.registrationCount);
    return FormSection(
      title: '${group.kindLabel}报名',
      children: [
        Wrap(
          spacing: AdminSpacing.label,
          runSpacing: AdminSpacing.label,
          children: [
            StatusBadge(text: group.statusLabel),
            Text('参赛占用 $attending 人'),
          ],
        ),
        if (group.minPlayers != null || group.maxPlayers != null)
          Text(
            '人数范围：${group.minPlayers ?? '不限'} 至 ${group.maxPlayers ?? '不限'}',
          ),
        if (group.registrations.isEmpty) const Text('暂无报名记录'),
        for (final entry in group.registrations)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AdminSpacing.label),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  foregroundImage: entry.avatarUrl?.isNotEmpty == true
                      ? NetworkImage(entry.avatarUrl!)
                      : null,
                  onForegroundImageError: entry.avatarUrl?.isNotEmpty == true
                      ? (_, _) {}
                      : null,
                  child: const Icon(Icons.person_outline),
                ),
                const SizedBox(width: AdminSpacing.label),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        entry.realName?.trim().isNotEmpty == true
                            ? entry.realName!
                            : entry.nickname.isEmpty
                            ? '未提供姓名'
                            : entry.nickname,
                      ),
                      if (entry.realName?.trim().isNotEmpty == true &&
                          entry.nickname.isNotEmpty)
                        Text(
                          entry.nickname,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      Wrap(
                        spacing: AdminSpacing.label,
                        runSpacing: AdminSpacing.label,
                        children: [
                          StatusBadge(text: entry.statusLabel),
                          Text('报名 ${entry.registrationCount} 人'),
                          Text(entry.paid ? '已支付' : '未支付'),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
